# MLOps based Realtime Data Platform for Stock Market Prediction

Hệ thống streaming dữ liệu thời gian thực tích hợp quy trình MLOps nhằm dự đoán biến động giá của chỉ số VNIndex.
## Tổng quan hệ thống

Platform streaming và phân tích dữ liệu chứng khoán Việt Nam từ sàn yfanance real-time với khả năng xử lý 100+ msg/s, latency p95 <195ms.

**Tech Stack chính:**
- Stream Processing: Apache Flink, Kafka
- Database: ScyllaDB (time-series), PostgreSQL (warehouse)
- Backend: FastAPI + WebSocket
- Frontend: Next.js 14 + TypeScript
- Orchestration: Apache Airflow
- Monitoring: Prometheus, Grafana

## Kiến trúc hệ thống
![Alt text](image/pipeline.svg)

## Components

### 1. stock-websocket-service
**Chức năng:** Producer service streaming stock prices từ Yahoo Finance vào Kafka

**Tech:** Python + yfinance + confluent-kafka

**Đặc điểm:**
- 3 producer instances (load balancing)
- Avro serialization với Schema Registry
- Auto-reconnect khi WebSocket drop
- Producer timestamp tracking cho latency measurement

**Ports:** None (internal only)

**Data output:** Kafka topic `yfinance` với 285 mã chứng khoán VN

---

### 2. kafka-service
**Chức năng:** Event streaming infrastructure với KRaft mode

**Tech:** Apache Kafka 3.x (KRaft), Schema Registry, Kafka UI

**Đặc điểm:**
- 3 controllers + 3 brokers (high availability)
- Schema Registry cho Avro schemas
- Kafka UI cho monitoring

**Ports:**
- Brokers: 29092, 39092, 49092
- Schema Registry: 8082
- Kafka UI: 8080

**Topics:**
- `yfinance`: Real-time stock prices

---

### 3. flink-service
**Chức năng:** Stream processing và real-time aggregation

**Tech:** Apache Flink 1.17.1 + Python

**Đặc điểm:**
- Stateful processing với RocksDB
- Tumbling window aggregations
- Multi-sink architecture (4 tables)
- Parallelism: 12, Task slots: 16

**Ports:**
- Flink Web UI: 8088
- Prometheus metrics: 9091

**Processing:**
- Raw prices → `stock_prices`
- Latest prices → `stock_latest_prices`
- 1-minute OHLCV → `stock_prices_agg`
- Daily summary → `stock_daily_summary`

---

### 4. scylla-service
**Chức năng:** Time-series database với CDC enabled

**Tech:** ScyllaDB/Cassandra

**Đặc điểm:**
- 3-node cluster (RF=3)
- CDC enabled cho real-time streaming
- Auto-setup với Python script
- NetworkTopologyStrategy replication

**Ports:**
- Node1: 9042, 9180
- Node2: 9043, 9181
- Node3: 9044, 9182

**Tables:**
- `stock_prices`: Raw ticks (CDC enabled)
- `stock_latest_prices`: Latest per symbol (CDC enabled)
- `stock_prices_agg`: OHLCV aggregated
- `stock_daily_summary`: Daily summary
- `stock_news`: News content

---

### 5. scylla-cdc-printer
**Chức năng:** CDC logs real-time cho websocket backend

**Tech:** Rust + scylla-cdc

**Đặc điểm:**
- Ultra-realtime mode (latency ~30ms)
- Latency calculation từ producer_timestamp
- Performance cao với async tokio
- Multiple operational modes

**Sử dụng:**
```bash
./run_ultra_realtime.sh stock_data stock_prices localhost
```

---

### 6. warehouse
**Chức năng:** PostgreSQL data warehouse cho analytics và ML training

**Tech:** TimescaleDB (PostgreSQL 14)

**Đặc điểm:**
- Snowflake schema (1 dim + 3 facts)
- Optimized cho ML training data
- Historical data storage
- Analytics-ready structure

**Ports:** 5433 (external), 5432 (internal)

**Schema:**
- `dim_stock`: Dimension table
- `fact_daily_prices`: OHLCV training data
- `fact_news`: News content + sentiment
- `fact_predictions`: ML predictions

---

### 7. task_daily
**Chức năng:** Airflow ETL pipeline cho batch processing

**Tech:** Apache Airflow 2.7 + LocalExecutor

**Đặc điểm:**
- Daily dump ScyllaDB → Warehouse
- News crawling + sentiment analysis
- Scheduled DAGs với retry logic
- Web UI monitoring

**Ports:** 8087 (Airflow Web UI)

**DAGs:**
- `dump_to_warehouse`: Daily @ 00:00 UTC
- `DAGs_newstock`: News crawl @ every 6h

---

### 8. scylla-monitoring
**Chức năng:** Monitoring stack cho ScyllaDB cluster và Latency monitoring

**Tech:** Prometheus + Grafana

**Đặc điểm:**
- Pre-configured dashboards
- CDC latency monitoring
- Cluster health metrics
- Custom stock-specific dashboards

**Ports:**
- Prometheus: 9090
- Grafana: 3000

---

### 9. web-stockAI
**Chức năng:** Full-stack web application với real-time UI

**Tech:** FastAPI (backend) + Next.js 14 (frontend)

**Đặc điểm:**
- Real-time WebSocket streaming
- CDC latency monitoring
- Prometheus metrics export
- Cloudflare Tunnel cho production
- Beautiful UI với shadcn/ui

**Ports:**
- Backend: 8005
- Frontend: 3005

**Features:**
- Real-time stock table
- Historical charts (multiple timeframes)
- Top movers, top volume
- News aggregation
- AI predictions (future)

---

## Quick Start

### Prerequisites
```bash
docker --version  # 20.10+
docker compose version  # v2+
```

### 1. Tạo network
```bash
docker network create financi-network
```

### 2. Khởi động từng service theo thứ tự

**Step 1: ScyllaDB**
```bash
cd scylla-service
docker compose up -d
```

**Step 2: Kafka**
```bash
cd kafka-service
docker compose up -d
# Chờ brokers ready (~1 phút)
docker logs broker-1 | grep "Started"
```

**Step 3: Stock Producers**
```bash
cd stock-websocket-service
docker compose up -d
docker logs -f stock-producer-1
```

**Step 4: Flink**
```bash
cd flink-service
docker compose up -d
# Submit job
docker exec jobmanager flink run -c com.stock.StockProcessingJob /opt/flink/usrlib/jars/flink-consumer-1.0.jar
```

**Step 5: Warehouse**
```bash
cd warehouse
docker compose up -d
```

**Step 6: Airflow**
```bash
cd task_daily
docker compose up -d
# Access: http://localhost:8087 (admin/admin)
```

**Step 8: Web UI**
```bash
cd web-stockAI
docker compose up -d
# Access: http://localhost:3005
```

**Step 9: Monitoring**
```bash
cd scylla-monitoring&& \
python3 update_dashboard_timezone.py && \
./kill-all.sh && \
./start-all.sh \
-v 5.2 \
-d prometheus_data \
-D "--network=financi-network -e TZ=Asia/Ho_Chi_Minh" \
-s ./prometheus/scylla_servers.yml \
-c "TZ=Asia/Ho_Chi_Minh" \
-c "GF_DATE_FORMATS_DEFAULT_TIMEZONE=Asia/Ho_Chi_Minh" \
--auto-restart \
--no-alertmanager \
--no-loki \
--no-renderer
# Grafana: http://localhost:3000
# Prometheus: http://localhost:9090
```

### Metrics
```bash
# Prometheus targets
curl http://localhost:9090/api/v1/targets

# Flink metrics
curl http://localhost:9091/metrics

# Backend metrics
curl http://localhost:8005/stocks/metrics

# Grafana dashboards
open http://localhost:3000
```

---

## Performance Metrics

**Throughput:**
- Stock producers: ~500-1000 msg/s (3 instances)
- Kafka: ~10K msg/s per broker
- Flink: ~5K records/s processing
- ScyllaDB: ~20K writes/s

**Latency:**
- Producer → Kafka: <50ms
- Kafka → Flink: <100ms
- Flink → ScyllaDB: <200ms
- End-to-end: <500ms (P95)
- CDC → WebSocket: <100ms

**Availability:**
- ScyllaDB: 99.9% (RF=3)
- Kafka: 99.9% (3 brokers)
- Flink: Single point (có thể scale)

## Backup & Recovery

### ScyllaDB
```bash
# Export
scylla-service/dump_scylla.sh
```

### Warehouse
```bash
# Dump
docker exec warehouse-db pg_dump -U warehouse_user warehouse > backup.sql

# Restore
docker exec -i warehouse-db psql -U warehouse_user warehouse < backup.sql
```

---

## Scaling

### Horizontal Scaling
**Kafka:** Thêm brokers vào cluster
**Flink:** Scale taskmanager: `docker compose up -d --scale taskmanager=3`
**Stock Producers:** Thêm producer instances với symbol list khác
**ScyllaDB:** Thêm nodes vào cluster

### Vertical Scaling
**ScyllaDB:** Tăng `--memory` và `--smp`
**Flink:** Tăng task slots và parallelism
**Airflow:** Tăng workers và parallelism

---

## Resource Requirements

### Minimum (Development)
- RAM: 16GB
- CPU: 8 cores
- Disk: 50GB SSD

### Recommended (Production)
- RAM: 32GB+
- CPU: 16 cores+
- Disk: 200GB+ NVMe SSD
- Network: 1Gbps+

### Per Service
- ScyllaDB: 3GB RAM, 3 cores per node
- Kafka: 2GB RAM, 2 cores per broker
- Flink: 4GB RAM, 4 cores
- PostgreSQL: 2GB RAM, 2 cores
- Airflow: 2GB RAM, 2 cores
- Web Backend: 1GB RAM, 2 cores
- Web Frontend: 1GB RAM, 2 cores


## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Data Source | Yahoo Finance WebSocket API |
| Message Queue | Apache Kafka (KRaft) |
| Stream Processing | Apache Flink 1.17.1 |
| Database (Time-series) | ScyllaDB |
| Database (Warehouse) | PostgreSQL/TimescaleDB |
| ETL Orchestration | Apache Airflow 2.7 |
| Backend API | FastAPI + Uvicorn |
| Frontend | Next.js 14 + React 18 |
| Monitoring | Prometheus + Grafana |
| Deployment | Docker + Docker Compose |
| Language | Python, TypeScript, Rust |

---

**Version:** 1.0.0  
**Last Updated:** November 2025

