import json
import logging
import os
import time
import urllib.request

from fastapi import FastAPI, Request, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
from .api.router import router
from .db import db_instance
from fastapi.middleware.cors import CORSMiddleware

log_level_name = os.getenv("LOG_LEVEL", "INFO").upper()
log_level = getattr(logging, log_level_name, logging.INFO)
logging.basicConfig(
    level=log_level,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)

app = FastAPI(title="StockAI API", version="1.0.0")

HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total",
    "Total HTTP requests processed by backend",
    ["method", "handler", "status"],
)
HTTP_REQUEST_DURATION = Histogram(
    "http_request_duration_seconds",
    "HTTP request duration in seconds",
    ["method", "handler"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)
HTTP_REQUESTS_IN_PROGRESS = Gauge(
    "http_requests_in_progress",
    "HTTP requests currently in progress",
    ["method", "handler"],
)

FRONTEND_UP = Gauge("webstock_frontend_up", "Frontend health status (1=Healthy, 0=Down)")
FRONTEND_UPTIME = Gauge("webstock_frontend_uptime_seconds", "Frontend process uptime in seconds")
FRONTEND_RESPONSE_TIME = Gauge("webstock_frontend_response_time_seconds", "Frontend healthcheck latency in seconds")
SCYLLA_CONNECTED = Gauge("webstock_scylla_connected", "ScyllaDB connection state (1=Connected, 0=Disconnected)")

def update_platform_health_metrics():
    # Probe ScyllaDB
    session = db_instance.get_session()
    is_scylla = False
    if session is not None and not getattr(session, "is_shutdown", False):
        try:
            session.execute("SELECT now() FROM system.local;")
            is_scylla = True
        except Exception:
            pass
    SCYLLA_CONNECTED.set(1 if is_scylla else 0)

    # Probe Frontend
    try:
        t0 = time.perf_counter()
        req = urllib.request.urlopen("http://webstock-frontend:3000/api/health", timeout=2)
        dur = time.perf_counter() - t0
        FRONTEND_RESPONSE_TIME.set(dur)
        if req.status == 200:
            FRONTEND_UP.set(1)
            data = json.loads(req.read().decode())
            FRONTEND_UPTIME.set(float(data.get("uptime", 0)))
        else:
            FRONTEND_UP.set(0)
    except Exception:
        FRONTEND_UP.set(0)

# --- Explicit CORS Configuration for Credentials & Cookies ---
allowed_origins = [
    "https://stock.kytran.io.vn",
    "https://api.kytran.io.vn",
    "http://localhost:3000",
    "http://localhost:3005",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3005",
]
env_origins = os.getenv("CORS_ALLOWED_ORIGINS", "")
if env_origins:
    custom_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    allowed_origins.extend(custom_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.kytran\.io\.vn",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.middleware("http")
async def prometheus_http_middleware(request: Request, call_next):
    method = request.method
    path = request.url.path
    if path.startswith("/stocks/historical/"):
        handler = "/stocks/historical/{symbol}"
    elif path.startswith("/stocks/realtime/"):
        handler = "/stocks/realtime/{symbol}"
    elif path.startswith("/stocks/news/"):
        handler = "/stocks/news/{symbol}"
    elif path.startswith("/stocks/financial/"):
        handler = "/stocks/financial/{symbol}"
    elif path.startswith("/stocks/"):
        parts = path.split("/")
        handler = f"/stocks/{parts[2]}" if len(parts) > 2 else path
    else:
        handler = path

    HTTP_REQUESTS_IN_PROGRESS.labels(method=method, handler=handler).inc()
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration = time.perf_counter() - start_time
        status = str(response.status_code)
        HTTP_REQUEST_DURATION.labels(method=method, handler=handler).observe(duration)
        HTTP_REQUESTS_TOTAL.labels(method=method, handler=handler, status=status).inc()
        return response
    except Exception as e:
        duration = time.perf_counter() - start_time
        HTTP_REQUEST_DURATION.labels(method=method, handler=handler).observe(duration)
        HTTP_REQUESTS_TOTAL.labels(method=method, handler=handler, status="500").inc()
        raise e
    finally:
        HTTP_REQUESTS_IN_PROGRESS.labels(method=method, handler=handler).dec()


app.include_router(router, prefix="")


@app.get("/metrics", tags=["monitoring"])
async def root_metrics():
    update_platform_health_metrics()
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"])
async def health_check():
    session = db_instance.get_session()
    scylla_healthy = False
    details = {}

    if session is not None and not getattr(session, "is_shutdown", False):
        try:
            session.execute("SELECT now() FROM system.local;")
            scylla_healthy = True
            details["scylladb"] = "connected"
        except Exception as e:
            details["scylladb"] = f"error: {str(e)}"
    else:
        details["scylladb"] = "disconnected"

    status_str = "healthy" if scylla_healthy else "unhealthy"
    status_code = 200 if scylla_healthy else 503

    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=status_code,
        content={
            "status": status_str,
            "timestamp": time.time(),
            "details": details,
        },
    )


@app.on_event("startup")
async def startup_event():
    from .api.routers.stocks import manager
    db_instance.connect()
    manager.start_background_cdc()


@app.on_event("shutdown")
async def shutdown_event():
    from .api.routers.stocks import manager
    await manager.shutdown_background_cdc()
    db_instance.close()
