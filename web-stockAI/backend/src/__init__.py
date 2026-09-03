import logging
import os

from fastapi import FastAPI
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

app.include_router(router, prefix="")


@app.get("/health", tags=["health"])
@app.get("/api/health", tags=["health"])
async def health_check():
    import time
    from fastapi.responses import JSONResponse

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