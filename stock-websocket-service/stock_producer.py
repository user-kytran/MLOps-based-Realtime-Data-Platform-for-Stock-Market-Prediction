import signal, asyncio, logging, os, time, sys, json
from confluent_kafka.admin import AdminClient, NewTopic
from confluent_kafka import SerializingProducer
from confluent_kafka.serialization import StringSerializer
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroSerializer
import yfinance as yf
from yfinance.config import YfConfig
import yfinance.live as yf_live
from prometheus_client import start_http_server, Counter, Gauge, Histogram, Info

# Patch async_connect để tắt keepalive ping timeout (1011) do Yahoo Finance không phản hồi ping
_original_async_connect = yf_live.async_connect
async def _patched_async_connect(url, **kwargs):
    kwargs.setdefault('ping_interval', None)
    kwargs.setdefault('ping_timeout', None)
    kwargs.setdefault('close_timeout', 10)
    return await _original_async_connect(url, **kwargs)

yf_live.async_connect = _patched_async_connect

# Patch AsyncWebSocket.listen để khi socket đứt thì raise ra ngoài cho vòng lặp của StockDataProducer
# tạo mới đối tượng yf.AsyncWebSocket và gửi lại bản tin subscribe đầy đủ
async def _clean_listen(self, message_handler=None):
    await self._connect()
    self._message_handler = message_handler

    if self._heartbeat_task is None or self._heartbeat_task.done():
        self._heartbeat_task = asyncio.create_task(self._periodic_subscribe())

    try:
        async for message in self._ws:
            message_json = json.loads(message)
            encoded_data = message_json.get("message", "")
            decoded_message = self._decode_message(encoded_data)
            if self._message_handler:
                if asyncio.iscoroutinefunction(self._message_handler):
                    await self._message_handler(decoded_message)
                else:
                    self._message_handler(decoded_message)
    finally:
        if self._heartbeat_task:
            self._heartbeat_task.cancel()
        if self._ws is not None:
            try:
                await self._ws.close()
            except Exception:
                pass
            self._ws = None

yf_live.AsyncWebSocket.listen = _clean_listen

yf.set_tz_cache_location("/home/obito/.cache/py-yfinance")
YfConfig.debug.hide_exceptions = True


HEALTHCHECK_FILE = "/tmp/healthy"

PRODUCER_ID = os.getenv("PRODUCER_ID", os.getenv("HOSTNAME", "stock-producer"))
METRICS_PORT = int(os.getenv("METRICS_PORT", "8000"))

METRIC_WS_CONNECTED = Gauge(
    "stock_producer_websocket_connected",
    "WebSocket connection state (1=Connected, 0=Disconnected)",
    ["producer_id"]
)
METRIC_MSGS_TOTAL = Counter(
    "stock_producer_messages_total",
    "Total messages streamed into Kafka",
    ["producer_id", "symbol"]
)
METRIC_ERRORS_TOTAL = Counter(
    "stock_producer_errors_total",
    "Total producer errors",
    ["producer_id", "error_type"]
)
METRIC_SEND_LATENCY = Histogram(
    "stock_producer_kafka_send_latency_seconds",
    "Latency of produce operation to Kafka in seconds",
    ["producer_id"],
    buckets=(0.0005, 0.001, 0.002, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0)
)
METRIC_CONSECUTIVE_FAILURES = Gauge(
    "stock_producer_consecutive_failures",
    "Consecutive reconnection failure count",
    ["producer_id"]
)
METRIC_LAST_MSG_TIMESTAMP = Gauge(
    "stock_producer_last_message_timestamp_seconds",
    "Timestamp of last received message",
    ["producer_id"]
)
METRIC_SYMBOLS_TRACKED = Gauge(
    "stock_producer_symbols_tracked",
    "Number of symbols tracked by this producer",
    ["producer_id"]
)
METRIC_PRODUCER_INFO = Info(
    "stock_producer",
    "Metadata about stock producer instance",
    ["producer_id"]
)



def check_websocket_open(ws_obj) -> bool:
    """Kiểm tra an toàn xem WebSocket nội bộ có đang ở trạng thái OPEN không"""
    if ws_obj is None:
        return False
    inner_ws = getattr(ws_obj, '_ws', None)
    if inner_ws is None:
        return False
    state = getattr(inner_ws, 'state', None)
    if state is not None:
        if hasattr(state, 'name'):
            return state.name == 'OPEN'
        return state == 1
    if hasattr(inner_ws, 'closed'):
        return not inner_ws.closed
    return getattr(inner_ws, 'close_code', None) is None

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

schema_registry_conf = {'url': os.getenv('SCHEMA_REGISTRY_URL')}
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
        self.msg_count = 0
        self.last_log_time = time.time()
        self.last_msg_time = time.time()
        
        bootstrap = bootstrap or os.getenv('KAFKA_BOOTSTRAP_SERVERS')
        self.admin = AdminClient({'bootstrap.servers': bootstrap})
        if topic not in self.admin.list_topics(timeout=5).topics:
            self.admin.create_topics([NewTopic(topic, num_partitions=partitions, replication_factor=replication)])
        
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

        METRIC_PRODUCER_INFO.labels(producer_id=PRODUCER_ID).info({
            "topic": self.topic,
            "symbols_count": str(len(self.symbols))
        })
        METRIC_SYMBOLS_TRACKED.labels(producer_id=PRODUCER_ID).set(len(self.symbols))
        METRIC_WS_CONNECTED.labels(producer_id=PRODUCER_ID).set(0)
        METRIC_CONSECUTIVE_FAILURES.labels(producer_id=PRODUCER_ID).set(0)
    
    def _signal_handler(self, signum, frame):
        logger.info(f"Nhận signal {signum}, đang shutdown...")
        self.shutdown_event.set()

    def _send(self, msg: dict):
        mapped_data = {
            "symbol": msg.get("id", ""),
            "price": float(msg.get("price", 0.0)),
            "timestamp": str(msg.get("time", "")),
            "exchange": msg.get("exchange", ""),
            "quote_type": int(msg.get("quote_type", 0)),
            "market_hours": int(msg.get("market_hours", 0)),
            "change_percent": float(msg.get("change_percent", 0.0)),
            "day_volume": int(msg.get("day_volume", 0)),
            "change": float(msg.get("change", 0.0)),
            "last_size": int(msg.get("last_size", 0)),
            "price_hint": str(msg.get("price_hint", "")),
            "producer_timestamp": int(time.time() * 1000)
        }
        try:
            t0 = time.perf_counter()
            self.producer.produce(topic=self.topic, value=mapped_data)
            self.producer.poll(0)
            latency = time.perf_counter() - t0
            METRIC_SEND_LATENCY.labels(producer_id=PRODUCER_ID).observe(latency)
            METRIC_MSGS_TOTAL.labels(producer_id=PRODUCER_ID, symbol=mapped_data.get('symbol', '')).inc()
            now = time.time()
            METRIC_LAST_MSG_TIMESTAMP.labels(producer_id=PRODUCER_ID).set(now)
            self.msg_count += 1
            self.last_msg_time = now
            if now - self.last_log_time >= 30:
                logger.info(f"Đã stream {self.msg_count} bản ghi vào Kafka (gần nhất: {mapped_data.get('symbol')} - giá {mapped_data.get('price')})")
                self.last_log_time = now
        except Exception as e:
            METRIC_ERRORS_TOTAL.labels(producer_id=PRODUCER_ID, error_type="kafka_produce_error").inc()
            logger.error(f"Lỗi khi produce message vào Kafka: {e}")

    async def _healthcheck_watchdog(self):
        """Task chạy ngầm định kỳ mỗi 10s cập nhật timestamp vào file nếu WebSocket đang OPEN"""
        logger.info("[Healthcheck] Watchdog task đã bắt đầu...")
        while not self.shutdown_event.is_set():
            try:
                is_open = check_websocket_open(self.ws)
                METRIC_WS_CONNECTED.labels(producer_id=PRODUCER_ID).set(1 if is_open else 0)
                if is_open:
                    with open(HEALTHCHECK_FILE, "w") as f:
                        f.write(str(time.time()))
                else:
                    logger.debug("[Healthcheck] Socket chưa OPEN, bỏ qua cập nhật heartbeat.")
            except Exception as e:
                logger.debug(f"[Healthcheck] Lỗi ghi heartbeat: {e}")
            await asyncio.sleep(10)

    async def run(self):
        watchdog_task = asyncio.create_task(self._healthcheck_watchdog())
        min_delay = 3
        max_delay = 60
        retry_delay = min_delay
        consecutive_failures = 0
        max_consecutive_failures = 15

        try:
            while not self.shutdown_event.is_set():
                try:
                    logger.info(f"Đang kết nối WebSocket cho {len(self.symbols)} symbols...")
                    self.ws = yf.AsyncWebSocket(verbose=False)
                    await self.ws.subscribe(self.symbols)
                    logger.info("Subscribe thành công")

                    # Reset thời gian chờ và bộ đếm lỗi khi kết nối thành công
                    retry_delay = min_delay
                    consecutive_failures = 0
                    METRIC_WS_CONNECTED.labels(producer_id=PRODUCER_ID).set(1)
                    METRIC_CONSECUTIVE_FAILURES.labels(producer_id=PRODUCER_ID).set(0)

                    async def message_handler(msg):
                        await asyncio.to_thread(self._send, msg)

                    await self.ws.listen(message_handler)

                except Exception as e:
                    consecutive_failures += 1
                    METRIC_WS_CONNECTED.labels(producer_id=PRODUCER_ID).set(0)
                    METRIC_CONSECUTIVE_FAILURES.labels(producer_id=PRODUCER_ID).set(consecutive_failures)
                    METRIC_ERRORS_TOTAL.labels(producer_id=PRODUCER_ID, error_type="websocket_disconnect").inc()
                    logger.warning(f"WebSocket mất kết nối: {e}. Thử lại sau {retry_delay} giây (Lần lỗi: {consecutive_failures})...")
                    try:
                        if self.ws:
                            await self.ws.close()
                    except Exception:
                        pass
                    self.ws = None

                    # Crash-on-Failure: Nếu lỗi liên tục quá 15 lần mà không hồi phục -> Thoát để Docker/Autoheal tái tạo container sạch sẽ
                    if consecutive_failures >= max_consecutive_failures:
                        logger.critical(f"Đã thử kết nối {consecutive_failures} lần thất bại liên tiếp. Thoát để restart container...")
                        sys.exit(1)

                    await asyncio.sleep(retry_delay)
                    retry_delay = min(max_delay, retry_delay * 2)

        finally:
            watchdog_task.cancel()
            if os.path.exists(HEALTHCHECK_FILE):
                try:
                    os.remove(HEALTHCHECK_FILE)
                except Exception:
                    pass

        
async def main():
    logger.info(f"Khởi chạy Prometheus metrics server tại port {METRICS_PORT} cho {PRODUCER_ID}...")
    try:
        start_http_server(METRICS_PORT)
        logger.info(f"Prometheus metrics endpoint sẵn sàng tại http://0.0.0.0:{METRICS_PORT}/metrics")
    except Exception as e:
        logger.warning(f"Không thể khởi chạy metrics server: {e}")

    # Lấy symbols từ environment variable
    symbols_env = os.getenv('SYMBOLS', '')
    if symbols_env:
        symbols = symbols_env.split(',')
    else:
        symbols = []
    
    logger.info(f"Khởi động Stock WebSocket Producer với {len(symbols)} symbols...")
    streamer = StockDataProducer(symbols=symbols, partitions=12, replication=3)
    await streamer.run()

if __name__ == "__main__":
    asyncio.run(main())
