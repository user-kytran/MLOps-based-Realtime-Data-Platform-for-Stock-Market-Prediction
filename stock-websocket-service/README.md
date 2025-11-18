# Stock WebSocket Service

## Mục đích
Producer service stream dữ liệu chứng khoán real-time từ Yahoo Finance WebSocket vào Kafka. Chia 300+ symbols thành 3 producers chạy song song để tối ưu throughput.

## Cấu trúc
```
stock-websocket-service/
├── stock_producer.py          # Main producer với yfinance WebSocket
├── docker-compose.yml         # 3 producer containers
├── Dockerfile                 # Multi-stage build với librdkafka
├── requirements.txt           # confluent-kafka, yfinance, avro
└── cron_docker.log           # Service logs
```

### Producers
- **stock-producer-1**: 100 symbols đầu (AAA.VN → GIL.VN)
- **stock-producer-2**: 100 symbols giữa (GMD.VN → PTL.VN)
- **stock-producer-3**: 100 symbols cuối (PVD.VN → YEG.VN)

## Chức năng

### Data Flow
1. **Subscribe WebSocket**: yfinance AsyncWebSocket cho danh sách symbols
2. **Receive Messages**: Real-time stock price updates
3. **Transform**: Map fields sang Avro schema
4. **Add Timestamp**: producer_timestamp (milliseconds)
5. **Serialize**: Avro format với Schema Registry
6. **Produce**: Kafka topic `yfinance` với key=symbol

### Avro Schema
```json
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
```

### Kafka Configuration
- **Topic**: yfinance
- **Partitions**: 12
- **Replication Factor**: 3
- **Acks**: all (đảm bảo durability)
- **Retries**: 3

## Cách sử dụng

### Khởi động service
```bash
docker compose up -d
```

### Kiểm tra logs
```bash
docker logs -f stock-producer-1
docker logs -f stock-producer-2
docker logs -f stock-producer-3
```

### Dừng service
```bash
docker compose down
```

### Restart một producer
```bash
docker restart stock-producer-1
```

### Xem messages trong Kafka
```bash
docker exec broker-1 kafka-console-consumer \
  --bootstrap-server broker-1:19092 \
  --topic yfinance \
  --from-beginning \
  --max-messages 10
```

### Kiểm tra topic
```bash
docker exec broker-1 kafka-topics \
  --bootstrap-server broker-1:19092 \
  --describe --topic yfinance
```

## Quy ước

### Environment Variables
**Required**:
- `KAFKA_BOOTSTRAP_SERVERS`: Kafka brokers
- `SCHEMA_REGISTRY_URL`: Schema Registry endpoint
- `SYMBOLS`: Comma-separated stock symbols

**Ví dụ**:
```bash
KAFKA_BOOTSTRAP_SERVERS=broker-1:19092,broker-2:19092,broker-3:19092
SCHEMA_REGISTRY_URL=http://schema-registry:8081
SYMBOLS=VCB.VN,HPG.VN,FPT.VN
```

### Symbol Format
- Vietnam stocks: `{CODE}.VN` (ví dụ: VCB.VN, HPG.VN)
- Total: 300+ symbols
- Chia đều cho 3 producers (~100 symbols/producer)

### Topic Settings
- Auto-create nếu chưa tồn tại
- Partitions: 12 (có thể tuning theo load)
- Replication: 3 (high availability)

### Network
- Network: `financi-network` (external)
- Phải kết nối được Kafka cluster và Schema Registry

### Cache
- yfinance cache: `/home/obito/.cache/py-yfinance`
- Mount volume để persist cache

## Ghi chú phát triển

### Thêm symbols mới
Sửa `docker-compose.yml`, thêm symbol vào env `SYMBOLS`:
```yaml
environment:
  - SYMBOLS=VCB.VN,HPG.VN,NEW.VN
```

### Thay đổi số producers
Hiện tại: 3 producers. Để thêm:
```yaml
stock-producer-4:
  build: .
  environment:
    - SYMBOLS=...
```

### Tuning performance
**Tăng partitions**:
```python
StockDataProducer(symbols=symbols, partitions=24, replication=3)
```

**Tăng batch size**:
```python
self.producer = SerializingProducer({
    'linger.ms': 100,
    'batch.size': 16384
})
```

### Signal handling
- SIGINT (Ctrl+C): Graceful shutdown
- SIGTERM: Docker stop graceful shutdown
- Producer flush trước khi exit

### Error handling
**WebSocket disconnect**:
- Auto retry connection
- Nếu fail: kill process để container restart

**Kafka error**:
- Retries: 3
- Acks: all (ensure delivery)

**Schema Registry error**:
- Check connection trước khi produce
- Schema tự động register nếu chưa có

### Monitoring
```bash
docker stats stock-producer-1 stock-producer-2 stock-producer-3

docker exec stock-producer-1 ps aux
```

### Troubleshooting

**Producer không start**:
```bash
docker logs stock-producer-1
```
- Check Kafka connection
- Verify Schema Registry accessible
- Check symbols format

**Không nhận data**:
- Verify Yahoo Finance WebSocket working
- Check market hours (VN market: 9:00-15:00 UTC+7)
- Test với ít symbols trước

**High memory usage**:
- Giảm số symbols per producer
- Tăng số producers
- Adjust yfinance cache size

**Topic creation failed**:
- Check Kafka cluster healthy
- Verify replication factor <= số brokers
- Check user permissions

### Build image
```bash
docker build -t stock-producer:latest .
```

### Run standalone (development)
```bash
export KAFKA_BOOTSTRAP_SERVERS=localhost:29092
export SCHEMA_REGISTRY_URL=http://localhost:8082
export SYMBOLS=VCB.VN,HPG.VN
python stock_producer.py
```

### Dependencies
- Python 3.11
- librdkafka (C library)
- confluent-kafka-python
- yfinance với AsyncWebSocket support
- Schema Registry client

### Performance Tips
- 1 producer có thể handle ~100-150 symbols
- WebSocket connection limit: check yfinance docs
- Kafka throughput: ~10K-50K messages/s per producer
- Latency: <10ms từ WebSocket → Kafka

