# Flink Service - Stock Real-time Processing

Hệ thống xử lý dữ liệu cổ phiếu real-time sử dụng Apache Flink, Kafka và ScyllaDB.

## Tổng quan

Service này tiêu thụ dữ liệu cổ phiếu real-time từ Kafka topic `yfinance`, xử lý và tổng hợp dữ liệu theo nhiều mức độ (raw, latest, 1-minute, daily), sau đó lưu trữ vào ScyllaDB để phục vụ cho các API và phân tích.

## Kiến trúc

### Thành phần chính

- **Apache Flink 1.17.1**: Stream processing engine
- **Kafka**: Message broker (topic: yfinance)
- **ScyllaDB/Cassandra**: Time-series database
- **Confluent Schema Registry**: Quản lý Avro schemas

### Luồng xử lý dữ liệu

```
Kafka (yfinance topic)
    ↓
Flink Table API (filtering & validation)
    ↓
DataStream Processing
    ├── Raw Stream → stock_prices (giá thô từng tick)
    ├── Latest Stream → stock_latest_prices (giá mới nhất)
    ├── Minute Aggregation → stock_prices_agg (OHLCV 1-phút)
    └── Daily Aggregation → stock_daily_summary (OHLCV ngày)
```

## Cấu trúc thư mục

```
flink-service/
├── flink_consumer.py       # Main job logic
├── pom.xml                 # Maven dependencies (Java connectors)
├── Dockerfile              # Flink image với Python support
├── docker-compose.yml      # JobManager + TaskManager
├── jars/                   # Flink connectors (Kafka, Cassandra...)
└── src/                    # Java source code (nếu có)
```

## Yêu cầu hệ thống

- Docker & Docker Compose
- Java 11+ (để build Maven project)
- Python 3.8+
- Network access đến: Kafka brokers, Schema Registry, ScyllaDB nodes

## Cài đặt

### 1. Build Maven project

```bash
cd flink-service
mvn clean package
```

Artifacts sẽ được sinh ra trong `target/` và copy vào `jars/`.

### 2. Build Docker image

```bash
docker build -t flink-service:1.17.1 .
```

### 3. Khởi chạy services

```bash
docker compose up -d
```

Services bao gồm:
- **jobmanager**: Port 8088 (Flink Web UI)
- **taskmanager**: 16 task slots, auto-scaling

## Cấu hình

### Kafka Consumer

- **Bootstrap servers**: `broker-1:19092,broker-2:19092,broker-3:19092`
- **Topic**: `yfinance`
- **Group ID**: `flink-simple-reader`
- **Format**: Avro với Confluent Schema Registry
- **Startup mode**: `latest-offset`

### ScyllaDB Connection

- **Nodes**: `scylla-node1`, `scylla-node2`, `scylla-node3`
- **Port**: 9042
- **Keyspace**: `stock_data`
- **Protocol version**: 4
- **Load balancing**: DCAwareRoundRobinPolicy

### Flink Configuration

- **Parallelism**: 12
- **Task slots**: 16
- **Metrics reporter**: Prometheus (port 9091)

## Xử lý dữ liệu

### 1. Raw Stock Prices (`stock_prices`)

Lưu trữ tất cả ticks giao dịch không qua xử lý:
- symbol, timestamp, price, change, change_percent
- day_volume, last_size, exchange, market_hours
- quote_type, price_hint

### 2. Latest Prices (`stock_latest_prices`)

Giá mới nhất của mỗi symbol (keyed by symbol, reduce operation).

### 3. Minute Aggregation (`stock_prices_agg`)

Tổng hợp OHLCV (Open, High, Low, Close, Volume) theo từng phút:
- Stateful processing với tumbling window 1 phút
- VWAP (Volume Weighted Average Price)
- Bucket: `YYYY-MM-DD HH:MM`

### 4. Daily Summary (`stock_daily_summary`)

Tổng hợp OHLCV theo ngày giao dịch:
- Stateful processing với TTL 2 ngày
- Continuous updates (mỗi tick đều update state)
- Final aggregation vào cuối ngày

## Monitoring

### Flink Web UI

Truy cập: `http://localhost:8088`

- Job status & metrics
- Task parallelism
- Checkpoints & savepoints
- BackPressure monitoring

### Prometheus Metrics

Endpoint: `http://localhost:9091/metrics`

Metrics bao gồm:
- Job uptime & restarts
- Records processed/s
- Checkpointing duration
- Task backpressure

## Chạy Job

### Submit Python job

```bash
docker exec -it jobmanager /opt/flink/bin/flink run \
  --python /opt/flink/usrlib/flink_consumer.py \
  --parallelism 12
```

### Stop job

```bash
docker exec -it jobmanager /opt/flink/bin/flink cancel <JOB_ID>
```

### Savepoint (cho maintenance)

```bash
# Tạo savepoint
docker exec -it jobmanager /opt/flink/bin/flink savepoint <JOB_ID> /opt/flink/savepoints/

# Resume từ savepoint
docker exec -it jobmanager /opt/flink/bin/flink run \
  --fromSavepoint /opt/flink/savepoints/<SAVEPOINT_PATH> \
  --python /opt/flink/usrlib/flink_consumer.py
```

## Troubleshooting

### Job không start được

- Kiểm tra Kafka connectivity: `telnet broker-1 19092`
- Kiểm tra Schema Registry: `curl http://schema-registry:8081/subjects`
- Xem logs: `docker logs jobmanager` hoặc `docker logs taskmanager`

### ScyllaDB connection timeout

- Kiểm tra network: `docker exec jobmanager ping scylla-node1`
- Verify keyspace: `docker exec scylla-node1 cqlsh -e "DESCRIBE KEYSPACE stock_data"`

### High backpressure

- Scale TaskManager: `docker compose up -d --scale taskmanager=3`
- Tăng parallelism trong job
- Optimize ScyllaDB write throughput

## Performance Tuning

### Flink Optimization

- Checkpoint interval: 5 phút (production nên là 30s-1m)
- State backend: RocksDB cho state lớn
- Network buffers: tăng nếu có high throughput

### ScyllaDB Optimization

- Sử dụng `execute_async()` để tăng throughput
- Connection pooling: 4 executor threads
- Compression: enabled

## Dependencies chính

### Java (Maven)

- `flink-streaming-java` 1.17.1
- `flink-connector-kafka` 1.17.1
- `flink-avro-confluent-registry` 1.17.1
- `cassandra-driver-core` 3.11.3

### Python

- `apache-flink` 1.17.1
- `cassandra-driver` (latest)

## Network

Service chạy trên network `financi-network` (external).

Các service cần có sẵn:
- Kafka brokers (broker-1, broker-2, broker-3)
- Schema Registry
- ScyllaDB nodes (scylla-node1, scylla-node2, scylla-node3)

## License

Proprietary - Stock AI Project

