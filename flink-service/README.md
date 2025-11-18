# Flink Service

## Mục đích
Service xử lý stream dữ liệu chứng khoán thời gian thực sử dụng Apache Flink. Đọc dữ liệu từ Kafka, xử lý và tổng hợp dữ liệu, sau đó lưu vào ScyllaDB.

## Cấu trúc
```
flink-service/
├── src/main/java/com/stock/
│   └── StockProcessingJob.java    # Job chính xử lý stream
├── jars/                           # Các connector và library
├── Dockerfile                      # Image Flink + Python + Cassandra
├── docker-compose.yml              # JobManager + TaskManager
└── pom.xml                         # Maven dependencies
```

## Chức năng
- **Nguồn dữ liệu**: Kafka topic `yfinance` (format Avro)
- **Xử lý**:
  - Lọc dữ liệu hợp lệ (price > 0, volume > 0, change_percent < 50%)
  - Tổng hợp theo ngày: open, close, high, low, volume, vwap
  - Tổng hợp theo phút: dữ liệu OHLCV theo interval 1m
- **Đích**: ScyllaDB với 4 bảng:
  - `stock_prices`: Dữ liệu tick raw
  - `stock_latest_prices`: Giá mới nhất theo symbol
  - `stock_daily_summary`: Tổng hợp theo ngày
  - `stock_prices_agg`: Tổng hợp theo phút

## Cách sử dụng

### Build
```bash
mvn clean package
```

### Chạy service
```bash
docker-compose up -d
```

### Truy cập Flink UI
- URL: http://localhost:8088
- Metrics: http://localhost:9091

### Submit job thủ công
```bash
docker exec -it jobmanager flink run \
  /opt/flink/usrlib/target/flink-consumer-1.0.jar
```

## Cấu hình

### Flink
- Parallelism: 12
- TaskManager slots: 16
- Version: 1.17.1

### Kafka
- Bootstrap servers: broker-1:19092, broker-2:19092, broker-3:19092
- Consumer group: flink-java-reader
- Schema Registry: http://schema-registry:8081

### ScyllaDB
- Nodes: scylla-node1, scylla-node2, scylla-node3
- Port: 9042
- Keyspace: stock_data

## Ghi chú phát triển
- Code Java 11
- Sử dụng Flink State để tổng hợp dữ liệu theo key (symbol)
- Async write vào ScyllaDB để tối ưu throughput
- Chỉ xử lý dữ liệu market_hours = 1 cho tổng hợp
- Làm tròn giá đến 2 chữ số thập phân
- Network: `financi-network` (external)

