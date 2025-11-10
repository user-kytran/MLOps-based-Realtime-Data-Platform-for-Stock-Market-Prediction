from fastapi import FastAPI
from .api.router import router
from .db import db_instance
from fastapi.middleware.cors import CORSMiddleware
import asyncio
# from .api.routers.stocks import kafka_consumer_task

app = FastAPI()

# --- Thêm CORS middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="")

# Quản lý lifecycle
@app.on_event("startup")
def startup_event():
    db_instance.connect()
    # asyncio.create_task(kafka_consumer_task("cdc_stock_latest_prices.stock_data.stock_latest_prices"))


@app.on_event("shutdown")
def shutdown_event():
    db_instance.close()