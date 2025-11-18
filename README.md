# Hệ thống Stock Trading Real-time với AI Prediction

Hệ thống phân tích và dự đoán chứng khoán real-time sử dụng streaming architecture với Apache Flink, ScyllaDB CDC, và Machine Learning models. Thu thập dữ liệu từ Yahoo Finance WebSocket, xử lý stream, lưu trữ phân tán, và cung cấp predictions với Transformer/LSTM models.

![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python)
![Java](https://img.shields.io/badge/Java-11-007396?logo=java)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Rust](https://img.shields.io/badge/Rust-Latest-000000?logo=rust)

---

## Mục lục

- [Giới thiệu](#giới-thiệu)
- [Kiến trúc hệ thống](#kiến-trúc-hệ-thống)
- [Tính năng](#tính-năng)
- [Công nghệ](#công-nghệ)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Chạy hệ thống](#chạy-hệ-thống)
- [Services](#services)
- [Monitoring](#monitoring)
- [Database Schema](#database-schema)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)
- [Triển khai](#triển-khai)
- [License](#license)

---

## Giới thiệu

Hệ thống xử lý và phân tích dữ liệu chứng khoán real-time cho thị trường Việt Nam (300+ symbols). Giải quyết bài toán:

- **Latency thấp**: Streaming data từ source đến UI < 100ms
- **High throughput**: Xử lý 10K+ events/s
- **Scalability**: Architecture phân tán, dễ scale horizontal
- **AI/ML Integration**: Dự đoán giá với Transformer và LSTM
- **Real-time Analytics**: Dashboard với CDC streaming từ ScyllaDB

**Đối tượng sử dụng**: Traders, nhà đầu tư, analysts cần theo dõi thị trường real-time và predictions.

---

## Kiến trúc hệ thống

![Architecture](image/pipeline.svg)


### Components

1. **Data Ingestion**: WebSocket producers → Kafka (Avro schema)
2. **Stream Processing**: Flink jobs (filtering, aggregation, windowing)
3. **Storage Layer**: 
   - ScyllaDB: Real-time OLTP, CDC enabled
   - PostgreSQL: Data warehouse, star schema
4. **CDC Streaming**: Rust-based CDC printer → WebSocket → UI
5. **ML Pipeline**: Airflow DAGs → Feature engineering → PyTorch training
6. **Web Application**: FastAPI backend + Next.js frontend

---

## Tính năng

### Real-time Features
- Live stock prices streaming qua WebSocket
- CDC latency tracking (producer → consumer)
- Real-time charts (candlestick, line, area)
- Price alerts và notifications

### Analytics & Aggregation
- OHLCV aggregation (1m, 5m, 1h, 1d intervals)
- Daily summary (open, close, high, low, volume, VWAP)
- Market hours filtering
- Top movers, volume leaders

### AI/ML Predictions
- Alpha formula generation với Google Gemini LLM
- Transformer và LSTM models
- Multi-stock parallel training (GPU accelerated)
- Confidence scoring
- Weights & Biases tracking

### News & Sentiment
- News crawling từ nguồn tin VN
- PDF analysis với Gemini AI
- Sentiment scoring (-1 to 1)
- Stock-news correlation

### Monitoring & Observability
- Prometheus metrics
- Grafana dashboards (ScyllaDB + Stock CDC)
- Airflow DAG monitoring
- Flink UI (jobs, metrics, backpressure)

---

## Công nghệ

### Core Stack
- **Languages**: Python 3.11, Java 11, TypeScript, Rust
- **Stream Processing**: Apache Flink 1.17.1
- **Message Queue**: Kafka 3.x (KRaft mode), Schema Registry
- **Databases**: 
  - ScyllaDB 5.2 (CDC enabled)
  - PostgreSQL 14 + TimescaleDB
- **Orchestration**: Apache Airflow 2.10.0

### Backend & API
- **Python**: FastAPI, Uvicorn, cassandra-driver, yfinance
- **Java**: Flink connector, Cassandra connector
- **Rust**: scylla-cdc, tokio

### Frontend
- **Framework**: Next.js 14 (App Router), React 18
- **Styling**: Tailwind CSS 4, shadcn/ui
- **Charts**: Recharts
- **State**: React hooks, WebSocket API

### ML/AI
- **Frameworks**: PyTorch 2.x (CUDA 12.1), TensorFlow
- **LLM**: Google Gemini (LangChain)
- **Tracking**: Weights & Biases
- **Models**: Transformer, LSTM (custom architectures)

### Infrastructure
- **Containerization**: Docker, Docker Compose
- **Monitoring**: Prometheus, Grafana
- **Networking**: Cloudflare Tunnel
- **CI/CD**: Docker multi-stage builds

---

## Cài đặt

### Prerequisites

```bash
# Required
- Docker >= 20.10
- Docker Compose >= v2
- 16GB RAM minimum
- 50GB disk space
- NVIDIA GPU (optional, cho training)

# Network
docker network create financi-network
```

### Clone Project

```bash
git clone <repository-url>
cd main
```

### Environment Setup

Mỗi service cần file `.env` riêng. Tham khảo `.env.example` trong từng folder.

**Kafka & Schema Registry**: Không cần config (auto-setup)

**ScyllaDB**: Auto-setup với `scylla-service/scylla_setup.py`

**Backend**: `web-stockAI/backend/.env`
```bash
CASSANDRA_HOST=["scylla-node1","scylla-node2","scylla-node3"]
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=stock_data
```

**Prediction API**: `stock-prediction/.env`
```bash
GOOGLE_API_KEY=your_gemini_key
POSTGRES_URL=postgresql://warehouse_user:warehouse_pass@warehouse-db:5432/warehouse
symbols=VCB.VN,HPG.VN,FPT.VN,...
```

**Airflow**: `task-daily-service/dags/.env`
```bash
SCYLLA_NODE1=scylla-node1
TRAINING_API_URL=http://kytran_prediction_api:8006/stock-prediction
GOOGLE_API_KEY=your_gemini_key
```

---

## Cấu hình

### Network Setup

```bash
docker network create financi-network
```

### Kafka Topics

Topics tự động tạo khi producers start. Manual create:

```bash
docker exec broker-1 kafka-topics \
  --bootstrap-server broker-1:19092 \
  --create --topic yfinance \
  --partitions 12 --replication-factor 3
```

### ScyllaDB Schema

Schema tự động tạo qua `scylla-setup` container. Manual run:

```bash
docker compose -f scylla-service/docker-compose.yml restart scylla-setup
```

---

## Chạy hệ thống

### Khởi động đầy đủ (recommended order)

```bash
# 1. Kafka cluster
cd kafka-service
docker compose up -d

# 2. ScyllaDB cluster
cd ../scylla-service
docker compose up -d

# 3. Stock producers
cd ../stock-websocket-service
docker compose up -d

# 4. Flink processing
cd ../flink-service
docker compose up -d

# 5. Warehouse
cd ../warehouse
docker compose up -d

# 6. Airflow
cd ../task-daily-service
docker compose up -d

# 7. Prediction API
cd ../stock-prediction
docker compose up -d

# 8. Web application
cd ../web-stockAI
docker compose up -d --build

# 9. Monitoring
cd ../scylla-monitoring
./restart-with-stock.sh
```

### Khởi động nhanh (parallel)

```bash
# Script tự động (tạo file này nếu cần)
./start-all-services.sh
```

### Kiểm tra services

```bash
docker ps
docker compose ps
```

### Truy cập

- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:8005/docs
- **Flink UI**: http://localhost:8088
- **Kafka UI**: http://localhost:8080
- **Airflow**: http://localhost:8087 (admin/admin)
- **Grafana**: http://localhost:1020
- **Prometheus**: http://localhost:9090
- **Prediction API**: http://localhost:8006/docs

---

## Services

### 1. Stock WebSocket Service

**Producer** lấy dữ liệu real-time từ Yahoo Finance, gửi vào Kafka.

```bash
cd stock-websocket-service
docker compose up -d
docker logs -f stock-producer-1
```

- 3 producers: 100 symbols/producer
- Topic: `yfinance` (Avro format)
- Latency: < 10ms

[Chi tiết →](stock-websocket-service/README.md)

---

### 2. Kafka Service

**Message broker** với KRaft mode (không cần Zookeeper).

```bash
cd kafka-service
docker compose up -d
```

- 3 controllers, 3 brokers
- Schema Registry: http://localhost:8082
- Kafka UI: http://localhost:8080

[Chi tiết →](kafka-service/README.md)

---

### 3. Flink Service

**Stream processing** đọc từ Kafka, xử lý và ghi vào ScyllaDB.

```bash
cd flink-service
mvn clean package
docker compose up -d
```

- Flink UI: http://localhost:8088
- Parallelism: 12
- 4 sinks: stock_prices, stock_latest_prices, stock_daily_summary, stock_prices_agg

[Chi tiết →](flink-service/README.md)

---

### 4. ScyllaDB Service

**NoSQL database** cluster 3 nodes với CDC enabled.

```bash
cd scylla-service
docker compose up -d
docker exec scylla-node1 nodetool status
```

- Keyspace: `stock_data` (RF=3)
- CDC TTL: 120s
- Tables: stock_prices, stock_latest_prices, stock_daily_summary, stock_prices_agg, stock_news

[Chi tiết →](scylla-service/README.md)

---

### 5. Scylla CDC Printer

**Rust tool** đọc CDC logs từ ScyllaDB để stream real-time.

```bash
cd scylla-cdc-printer
cargo build --release
./run_ultra_realtime.sh stock_data stock_prices localhost
```

- Ultra low latency mode: < 100ms
- Latency tracking với producer_timestamp

[Chi tiết →](scylla-cdc-printer/README.md)

---

### 6. Warehouse

**PostgreSQL** data warehouse với star schema cho ML training.

```bash
cd warehouse
docker compose up -d
docker exec -it warehouse-db psql -U warehouse_user -d warehouse
```

- TimescaleDB extension
- Star schema: dim_stock, fact_daily_prices, fact_news, fact_predictions

[Chi tiết →](warehouse/README.md)

---

### 7. Task Daily Service

**Airflow** chạy scheduled tasks: ETL, news crawling, trigger predictions.

```bash
cd task-daily-service
docker compose up -d
```

- Airflow UI: http://localhost:8087
- 3 DAGs: warehouse ETL, prediction trigger, news crawler

[Chi tiết →](task-daily-service/README.md)

---

### 8. Stock Prediction

**ML API** dự đoán giá với PyTorch models (Transformer/LSTM).

```bash
cd stock-prediction
docker compose up -d
docker logs -f kytran_prediction_api
```

- API: http://localhost:8006
- GPU accelerated (CUDA 12.1)
- Alpha generation với Google Gemini

[Chi tiết →](stock-prediction/README.md)

---

### 9. Web StockAI

**Frontend + Backend** cho real-time dashboard.

```bash
cd web-stockAI
docker compose up -d --build
```

- Frontend: http://localhost:3005
- Backend: http://localhost:8005
- WebSocket streaming với CDC integration

[Chi tiết →](web-stockAI/README.md)

---

### 10. Scylla Monitoring

**Prometheus + Grafana** monitoring stack.

```bash
cd scylla-monitoring
./restart-with-stock.sh
```

- Grafana: http://localhost:1020
- Prometheus: http://localhost:9090
- Dashboards: ScyllaDB + Stock CDC Latency

[Chi tiết →](scylla-monitoring/README.md)

---

## Monitoring

### Prometheus Metrics

```bash
# ScyllaDB metrics
curl http://localhost:9090/api/v1/query?query=scylla_transport_requests

# Stock CDC latency
curl http://localhost:8005/stocks/metrics | grep cdc_latency_ms

# Flink metrics
curl http://localhost:9091/metrics
```

### Grafana Dashboards

- **Scylla Overview**: CPU, memory, disk, network
- **Scylla Advanced**: Query latency, cache hit rate
- **Stock CDC Latency**: Real-time CDC processing latency
- **Flink Jobs**: Task metrics, backpressure

### Logs

```bash
# Backend
docker logs -f webstock-backend

# Flink JobManager
docker logs -f jobmanager

# Airflow Scheduler
docker logs -f airflow-scheduler

# Kafka Broker
docker logs -f broker-1

# ScyllaDB
docker logs -f scylla-node1
```

---

## Database Schema

### ScyllaDB Tables

**stock_prices** (CDC enabled)
```sql
PRIMARY KEY (symbol, timestamp)
Columns: price, volume, change, change_percent, market_hours, producer_timestamp
CDC: enabled, TTL 120s
```

**stock_latest_prices** (CDC enabled)
```sql
PRIMARY KEY (symbol)
Columns: price, timestamp, change, change_percent
CDC: enabled, TTL 120s
```

**stock_daily_summary**
```sql
PRIMARY KEY (symbol, trade_date)
Columns: open, high, low, close, volume, vwap, change, change_percent
```

**stock_prices_agg**
```sql
PRIMARY KEY ((symbol, bucket_date, interval), ts)
Columns: open, high, low, close, volume
Intervals: 1m, 5m, 1h, 1d
```

**stock_news**
```sql
PRIMARY KEY (stock_code, date, article_id)
Columns: content, sentiment_score, source_url
```

### PostgreSQL Warehouse (Star Schema)

**dim_stock**
```sql
PRIMARY KEY (stock_code)
Columns: exchange, quote_type
```

**fact_daily_prices**
```sql
PRIMARY KEY (stock_code, trade_date)
Columns: open, high, low, close, volume, vwap
FOREIGN KEY (stock_code) REFERENCES dim_stock
```

**fact_news**
```sql
PRIMARY KEY (stock_code, news_date, article_id)
Columns: content, sentiment_score
```

**fact_predictions**
```sql
PRIMARY KEY (stock_code, prediction_date)
Columns: predicted_price, model_version, confidence_score
```

---

## API Documentation

### Stock Backend API

**Base URL**: http://localhost:8005

#### Endpoints

**GET** `/stocks/get_reference`
```json
Response: [
  {
    "symbol": "VCB.VN",
    "exchange": "HOSE",
    "quote_type": 1
  }
]
```

**GET** `/stocks/historical/{symbol}?days=30`
```json
Response: {
  "symbol": "VCB.VN",
  "data": [
    {
      "trade_date": "2025-11-17",
      "open": 85.0,
      "high": 86.5,
      "low": 84.5,
      "close": 86.0,
      "volume": 1000000
    }
  ]
}
```

**GET** `/stocks/intraday/{symbol}`

**GET** `/stocks/daily_summary/{symbol}`

**GET** `/stocks/predictions/{symbol}`

**GET** `/stocks/metrics` - Prometheus metrics

**WS** `/stocks/ws/stocks_realtime` - WebSocket stream

[Swagger UI →](http://localhost:8005/docs)

---

### Prediction API

**Base URL**: http://localhost:8006

**POST** `/stock-prediction`
```json
Request: {
  "prediction_date": "2025-11-20"
}

Response: {
  "status": "success",
  "total_stocks": 200,
  "success_count": 195,
  "results_file": "results/predictions_20251117.json"
}
```

[Swagger UI →](http://localhost:8006/docs)

---

## Troubleshooting

### Kafka không start

```bash
# Check logs
docker logs broker-1

# Verify network
docker network inspect financi-network

# Restart
cd kafka-service
docker compose restart
```

### ScyllaDB cluster không form

```bash
# Check status
docker exec scylla-node1 nodetool status

# Check gossip
docker exec scylla-node1 nodetool gossipinfo

# Restart cluster
cd scylla-service
docker compose restart
```

### Flink job failed

```bash
# Check Flink UI
http://localhost:8088

# Check logs
docker logs jobmanager
docker logs taskmanager-1

# Resubmit job
docker exec jobmanager flink run /opt/flink/usrlib/target/flink-consumer-1.0.jar
```

### Frontend không load data

```bash
# Verify backend API
curl http://localhost:8005/stocks/get_reference

# Check browser console (F12)
# Verify API URL in frontend/lib/config.ts

# Rebuild
cd web-stockAI
docker compose down
docker compose up -d --build
```

### WebSocket disconnect

```bash
# Check CDC printer
docker exec webstock-backend ps aux | grep scylla-cdc-printer

# Check ScyllaDB CDC
docker exec scylla-node1 cqlsh -e "DESCRIBE TABLE stock_data.stock_prices;"

# Verify: cdc = {'enabled': true}

# Check backend logs
docker logs webstock-backend | grep CDC
```

### Prediction API timeout

```bash
# Check GPU
nvidia-smi

# Check logs
docker logs kytran_prediction_api

# Verify Gemini API key
echo $GOOGLE_API_KEY

# Test API
curl -X POST http://localhost:8006/stock-prediction \
  -H "Content-Type: application/json" \
  -d '{"prediction_date":"2025-11-18"}'
```

### Airflow DAG không chạy

```bash
# Check scheduler
docker logs airflow-scheduler

# Verify DAG syntax
docker exec airflow-scheduler python /opt/airflow/dags/DAGs_warehouse.py

# Check timezone
docker exec airflow-scheduler date

# Unpause DAG
# Airflow UI → DAGs → Toggle ON
```

### High memory usage

```bash
# Monitor
docker stats

# Giảm parallelism
# Flink: Sửa parallelism trong docker-compose.yml
# Airflow: Giảm AIRFLOW__CORE__PARALLELISM

# Restart services
docker compose restart
```

---

## Triển khai

### Development

```bash
# Local development với Docker
docker compose up -d
```

**4. Monitoring & Alerting**

- Prometheus alert rules
- Grafana notifications
- PagerDuty/Slack integration

**5. Backup Strategy**

```bash
# ScyllaDB snapshot
docker exec scylla-node1 nodetool snapshot stock_data

# PostgreSQL backup
docker exec warehouse-db pg_dump -U warehouse_user warehouse > backup.sql

# Kafka topic backup
kafka-consumer-groups --bootstrap-server broker-1:19092 --describe --all-groups
```

---

## Performance Tips

### Kafka
- Tăng partitions cho high throughput: `--partitions 24`
- Tune producer: `linger.ms=100`, `batch.size=32768`
- Compression: `compression.type=lz4`

### Flink
- Tăng parallelism: `--parallelism 16`
- Tune checkpointing: `checkpointing.interval=60000`
- Memory: `taskmanager.memory.process.size=4g`

### ScyllaDB
- Tăng memory: `--memory 4096M`
- Tăng CPU: `--smp 6`
- Disable overprovisioned (production): `--overprovisioned 0`

### Frontend
- Lazy loading: `React.lazy()`
- Memoization: `React.memo()`
- Server components (Next.js 14)
- CDN cho static assets

---

## Contributing

### Quy tắc đóng góp

1. Fork repository
2. Tạo branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'feat: add amazing feature'` (Conventional Commits)
4. Push: `git push origin feature/amazing-feature`
5. Tạo Pull Request

### Code Style

- **Python**: Black formatter, isort, flake8
- **TypeScript**: Prettier, ESLint
- **Java**: Google Java Style Guide
- **Rust**: rustfmt

### Commit Convention

```
feat: thêm tính năng mới
fix: sửa bug
docs: cập nhật documentation
style: format code
refactor: refactor code
test: thêm tests
chore: cập nhật dependencies
```

---

## License

MIT License

Copyright (c) 2025 Stock Trading System

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

---

## Liên hệ & Hỗ trợ

- **Issues**: [GitHub Issues](https://github.com/user-kytran/repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/user-kytran/repo/discussions)
- **Email**: support@stocktrading.com

---

## Roadmap

### Phase 1 (Completed ✅)
- [x] Real-time streaming pipeline
- [x] ScyllaDB CDC integration
- [x] ML prediction API
- [x] Web dashboard

### Phase 2 (In Progress 🚧)
- [ ] Mobile app (React Native)
- [ ] Portfolio management
- [ ] Trading signals
- [ ] Backtesting engine

### Phase 3 (Planned 📋)
- [ ] Social trading features
- [ ] Multi-market support (US, CN stocks)
- [ ] Options & Derivatives
- [ ] Advanced ML models (GNN, Reinforcement Learning)

---

**⭐ Nếu project hữu ích, hãy star repo này!**


