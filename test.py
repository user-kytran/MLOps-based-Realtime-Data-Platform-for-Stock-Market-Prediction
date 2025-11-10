import pandas as pd
import asyncio
import logging
import os
import signal
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import SerializingProducer
from confluent_kafka.serialization import StringSerializer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import yfinance as yf
import random
import time
from datetime import datetime, timezone

yf.set_tz_cache_location("/home/obito/.cache/py-yfinance")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

schema_registry_conf = {'url': os.getenv('SCHEMA_REGISTRY_URL', 'http://localhost:8082')}
schema_registry_client = SchemaRegistryClient(schema_registry_conf)
user_schema_str = """
{
  "namespace": "finance.avro",
  "type": "record",
  "name": "stock",
  "fields": [
    {"name": "symbol", "type": "string"},
    {"name": "price", "type": "float"},
    {"name": "timestamp", "type": "string"},
    {"name": "exchange", "type": "string"},
    {"name": "quote_type", "type": "int"},
    {"name": "market_hours", "type": "int"},
    {"name": "change_percent", "type": "float"},
    {"name": "day_volume", "type": "int"},
    {"name": "change", "type": "float"},
    {"name": "last_size", "type": "int"},
    {"name": "price_hint", "type": "string"},
    {"name": "producer_timestamp", "type": "long"}
  ]
}
"""

class StockDataProducer:
    def __init__(self, bootstrap=None, topic='yfinance', symbols=None, partitions=16, replication=5):
        self.topic = topic
        self.symbols = symbols or []
        self.shutdown_event = asyncio.Event()
        self.ws = None
        
        bootstrap = bootstrap or os.getenv('KAFKA_BOOTSTRAP_SERVERS', 'localhost:29092,localhost:39092,localhost:49092')
        self.admin = AdminClient({'bootstrap.servers': bootstrap})
        if topic not in self.admin.list_topics(timeout=5).topics:
            self.admin.create_topics([NewTopic(topic, num_partitions=partitions, replication_factor=replication)])
        self._ensure_topic(topic, partitions, replication)
        self.avro_serializer = AvroSerializer(
            schema_registry_client=schema_registry_client,
            schema_str=user_schema_str,
            to_dict=lambda obj, ctx: obj
        )
        self.producer = SerializingProducer({
            'bootstrap.servers': bootstrap, 
            'acks': 'all', 
            'retries': 3,
            'key.serializer': StringSerializer('utf_8'),
            'value.serializer': self.avro_serializer
        })
        
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _ensure_topic(self, topic, partitions=12, replication=3):
        topics = self.admin.list_topics(timeout=10).topics
        if topic in topics:
            logger.info(f"Topic {topic} đã tồn tại, sử dụng lại.")
            return
        logger.info(f"Tạo mới topic {topic} ...")
        fs = self.admin.create_topics([NewTopic(topic, num_partitions=partitions, replication_factor=replication)])
        for t, f in fs.items():
            try:
                f.result()
                logger.info(f"Topic {t} đã được tạo thành công.")
            except Exception as e:
                logger.warning(f"Lỗi tạo topic {t}: {e}")
    
    def _signal_handler(self, signum, frame):
        logger.info(f"Nhận signal {signum}, đang shutdown...")
        self.shutdown_event.set()
        
    def _send_one(self, msg: dict):
        """Gửi 1 record vào Kafka"""
        self.producer.produce(topic=self.topic, value=msg)
        self.producer.poll(0)

    async def run_mock_data(self, duration_minutes=5, interval_seconds=0.3):
        """Giả lập 2 cổ phiếu gửi liên tục trong duration_minutes"""
        end_time = time.time() + duration_minutes * 60
        symbols = self.symbols or ["AAPL", "MSFT"]

        logger.info(f"🚀 Bắt đầu giả lập dữ liệu trong {duration_minutes} phút cho {symbols} ...")
        while time.time() < end_time and not self.shutdown_event.is_set():
            for sym in symbols:
                price = round(random.uniform(100, 350), 2)
                change = round(random.uniform(-2, 2), 2)
                change_percent = round((change / price) * 100, 2)
                day_volume = random.randint(100_000, 1_000_000)
                last_size = random.randint(10, 500)
                from datetime import datetime, timezone

                # Ví dụ ngày cố định: 2025-01-01 08:30:00 UTC
                fixed_dt = datetime(2025, 1, 1, 8, 30, 0, tzinfo=timezone.utc)
                fixed_ms = str(int(fixed_dt.timestamp() * 1000))

                record = {
                    "symbol": sym,
                    "price": price,
                    "timestamp": fixed_ms,
                    "exchange": "NASDAQ",
                    "quote_type": 1,
                    "market_hours": 1,
                    "change_percent": change_percent,
                    "day_volume": day_volume,
                    "change": change,
                    "last_size": last_size,
                    "price_hint": "2",
                    "producer_timestamp": int(time.time() * 1000)
                }
                # print(record)
                self.producer.produce(
                    topic=self.topic,
                    key=sym,
                    value=record
                )
                logger.info(f"📤 Gửi: {record}")

            self.producer.flush()
            # break
            await asyncio.sleep(interval_seconds)

        logger.info("⏹️ Đã kết thúc giả lập dữ liệu.")

if __name__ == "__main__":
    producer = StockDataProducer(topic="yfinance",symbols=["TEST1", "TEST2"])
    asyncio.run(producer.run_mock_data(duration_minutes=10, interval_seconds=1))
