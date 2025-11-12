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

### 9. stock_prediction
**Chức năng:** ML-based stock price prediction service với automated pipeline

**Tech:** PyTorch + FastAPI + WandB + Google Gemini

**Đặc điểm:**
- Auto-generate alpha factors với Gemini AI
- Automated training pipeline với hyperparameter tuning
- Model versioning và checkpoint management (Google Drive)
- GPU acceleration (CUDA 12.1)
- WandB experiment tracking
- SQLite database cho model history

**Ports:** 8006 (Prediction API)

**Pipeline:**
1. **Alpha Generation**: Gemini AI tạo 101 alpha formulas
2. **Data Collection**: Pull từ PostgreSQL warehouse
3. **Feature Engineering**: Apply alpha factors + technical indicators
4. **Model Training**: LSTM/GRU/Transformer với early stopping
5. **Validation**: MSE-based model selection
6. **Prediction**: Daily price prediction với confidence score
7. **Storage**: Save predictions to warehouse

**Models:**
- LSTM: Long Short-Term Memory
- GRU: Gated Recurrent Unit
- Transformer: Multi-head attention

**API Endpoints:**
- `POST /stock-prediction`: Trigger full prediction pipeline

**Files:**
- `api.py`: FastAPI service
- `model/auto_pipeline.py`: Automated ML pipeline
- `model/gen_alpha.py`: AI-powered alpha generation
- `model/models.py`: Neural network architectures
- `model/dataset.py`: PyTorch data loaders
- `model/db_manager.py`: Training history management

---

### 10. web-stockAI
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
- AI predictions display

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

**Step 7: Stock Prediction (ML)**
```bash
cd stock_prediction
# Tạo file .env với:
# POSTGRES_URL=postgresql://warehouse_user:warehouse_password@warehouse-db:5432/warehouse
# GOOGLE_API_KEY=your_gemini_api_key
# WANDB_API_KEY=your_wandb_key
# symbols=AAA,ACB,VNM,VIC,...
docker compose up -d
# API: http://localhost:8006
# Trigger prediction: curl -X POST http://localhost:8006/stock-prediction
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
- **Stock Prediction: 4GB RAM, 4 cores, 1 GPU (Optional but recommended)**

### GPU Requirements (For ML)
- **Minimum**: NVIDIA GPU with 4GB VRAM (GTX 1650+)
- **Recommended**: NVIDIA GPU with 8GB+ VRAM (RTX 3060+)
- **CUDA**: 12.1 or higher
- **Without GPU**: CPU training possible but 10-20x slower


## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Data Source | Yahoo Finance WebSocket API |
| Message Queue | Apache Kafka (KRaft) |
| Stream Processing | Apache Flink 1.17.1 |
| Database (Time-series) | ScyllaDB |
| Database (Warehouse) | PostgreSQL/TimescaleDB |
| ETL Orchestration | Apache Airflow 2.7 |
| ML Framework | PyTorch + CUDA 12.1 |
| AI Alpha Generation | Google Gemini API |
| Experiment Tracking | Weights & Biases (WandB) |
| Backend API | FastAPI + Uvicorn |
| Frontend | Next.js 14 + React 18 |
| Monitoring | Prometheus + Grafana |
| Deployment | Docker + Docker Compose |
| Language | Python, TypeScript, Rust |

---

## MLOps Pipeline Details

### Alpha Factor Generation
- **AI-Powered**: Google Gemini generates 101 unique alpha formulas
- **Technical Indicators**: RSI, MACD, Bollinger Bands, ATR, OBV, Stochastic
- **Custom Alphas**: Price momentum, volume patterns, volatility metrics
- **Validation**: Automatic correlation check & redundancy removal

### Model Training Workflow
1. **Data Preparation**
   - Pull 60 days historical OHLCV from warehouse
   - Apply generated alpha factors
   - Normalize features using MinMaxScaler
   - Create sequences (window_size=30)

2. **Model Architecture**
   - Input: 30 timesteps × (101 alphas + 6 base features)
   - Hidden layers: Configurable (64-256 units)
   - Dropout: 0.2-0.5 for regularization
   - Output: Next day close price

3. **Training**
   - Loss: MSE (Mean Squared Error)
   - Optimizer: Adam (lr=0.001)
   - Early stopping: patience=10
   - Max epochs: 100
   - Validation split: 80/20

4. **Model Selection**
   - Compare MSE across LSTM/GRU/Transformer
   - Select best performer
   - Save checkpoint to Google Drive
   - Log to WandB for experiment tracking

5. **Prediction**
   - Load best model
   - Apply same alpha factors
   - Generate next-day price prediction
   - Calculate confidence score
   - Save to warehouse `fact_predictions`

### Model Versioning
- **Checkpoint Format**: `{stock_code}_{model_type}_{timestamp}.pth`
- **Storage**: Google Drive (via rclone)
- **Metadata**: SQLite database tracks MSE, alphas, training date
- **Auto-Update**: Retrain if MSE degrades > 5%

---

## API Documentation

### Stock Prediction API (Port 8006)

**POST /stock-prediction**
- **Description**: Trigger full ML pipeline for all configured symbols
- **Response**: 
```json
[
  {
    "stock_code": "AAA",
    "predicted_price": 15.23,
    "confidence": 0.892,
    "model_name": "AAA_LSTM_20251113",
    "new_model": false,
    "saved": true,
    "total_time": 3.45
  }
]
```

### Web Backend API (Port 8005)
- **GET /stocks/latest**: Latest prices for all symbols
- **GET /stocks/historical/{symbol}**: OHLCV data
- **GET /stocks/predictions/{symbol}**: AI predictions
- **GET /stocks/news/{symbol}**: Latest news
- **WebSocket /ws/stocks**: Real-time price stream
- **GET /stocks/metrics**: Prometheus metrics

---

## Monitoring & Observability

### Grafana Dashboards
1. **ScyllaDB Cluster Overview**
   - Node health, CPU, memory
   - Disk I/O, network throughput
   - Read/write latencies

2. **CDC Latency Monitoring**
   - Producer → ScyllaDB latency
   - CDC → WebSocket latency
   - End-to-end latency percentiles (p50, p95, p99)

3. **Stock Trading Dashboard** (Custom)
   - Real-time price charts
   - Volume analysis
   - Top gainers/losers
   - News sentiment timeline

### Prometheus Metrics
**Flink Metrics:**
- `flink_taskmanager_job_task_numRecordsInPerSecond`
- `flink_taskmanager_job_task_numRecordsOutPerSecond`
- `flink_taskmanager_Status_JVM_Memory_Heap_Used`

**Backend Metrics:**
- `stock_websocket_connections`: Active WebSocket clients
- `stock_api_request_duration_seconds`: API response time
- `stock_cdc_latency_seconds`: CDC processing latency

**ML Metrics (WandB):**
- Training loss curve
- Validation MSE
- Prediction accuracy
- Model comparison matrix

---

## Troubleshooting

### Common Issues

**1. Kafka brokers not starting**
```bash
# Check logs
docker logs broker-1

# Reset Kafka data
cd kafka-service
docker compose down -v
docker compose up -d
```

**2. Flink job failed**
```bash
# Check jobmanager logs
docker logs jobmanager

# Restart job
docker exec jobmanager flink run -c com.stock.StockProcessingJob /opt/flink/usrlib/jars/flink-consumer-1.0.jar
```

**3. ScyllaDB node down**
```bash
# Check node status
docker exec scylla-node1 nodetool status

# Repair node
docker exec scylla-node1 nodetool repair
```

**4. CDC latency spike**
```bash
# Check scylla-cdc-printer logs
docker logs scylla-cdc-printer

# Restart CDC printer
cd scylla-cdc-printer
./run_ultra_realtime.sh stock_data stock_prices localhost
```

**5. ML prediction errors**
```bash
# Check API logs
docker logs kytran_prediction_api

# Verify warehouse connection
docker exec kytran_prediction_api python3 -c "from sqlalchemy import create_engine; import os; engine=create_engine(os.getenv('POSTGRES_URL')); print(engine.connect())"

# Check WandB login
docker exec kytran_prediction_api wandb login --verify
```

**6. Out of memory**
```bash
# Check memory usage
docker stats

# Increase memory limits in docker-compose.yml
# For Flink:
deploy:
  resources:
    limits:
      memory: 8G
```

---

## Development Guide

### Adding New Symbols
1. Update environment variables in `stock-websocket-service/.env`
2. Restart producers: `docker compose restart`
3. Add to prediction list in `stock_prediction/.env`

### Creating Custom Alpha Factors
Edit `stock_prediction/model/gen_alpha.py`:
```python
def gen_all_alpha_formulas(symbols):
    prompt = """
    Generate 101 alpha formulas for stocks: {symbols}
    Include: momentum, mean reversion, volatility, volume
    Format: {"alpha_1": "formula", ...}
    """
    # Your custom logic
```

### Adding New ML Models
1. Define model in `stock_prediction/model/models.py`
2. Register in `auto_pipeline.py`:
```python
from models import YourNewModel

model = YourNewModel(input_size, hidden_size, num_layers)
```

### Custom Airflow DAGs
1. Add DAG file to `task_daily/dags/`
2. Restart scheduler: `docker compose restart airflow-scheduler`
3. View in UI: http://localhost:8087

---

## Performance Tuning

### ScyllaDB Optimization
```bash
# Increase concurrent writes
ALTER TABLE stock_prices WITH compaction = {'class': 'TimeWindowCompactionStrategy'};

# Enable compression
ALTER TABLE stock_prices WITH compression = {'sstable_compression': 'LZ4Compressor'};
```

### Flink Tuning
Edit `flink-service/docker-compose.yml`:
```yaml
environment:
  - JOB_MANAGER_MEMORY: 2048m
  - TASK_MANAGER_MEMORY: 4096m
  - TASK_MANAGER_NUM_TASK_SLOTS: 16
  - PARALLELISM_DEFAULT: 12
```

### Kafka Performance
```bash
# Increase partition count
kafka-topics --alter --topic yfinance --partitions 12 --bootstrap-server localhost:29092

# Tune producer batch size
linger.ms=10
batch.size=32768
compression.type=lz4
```

### ML Training Speedup
```python
# Use mixed precision training
from torch.cuda.amp import autocast, GradScaler

scaler = GradScaler()
with autocast():
    output = model(x)
    loss = criterion(output, y)
```

---

## Security Best Practices

### Production Checklist
- [ ] Change default passwords (Kafka, PostgreSQL, Grafana)
- [ ] Enable SSL/TLS for Kafka
- [ ] Use Cloudflare Tunnel for web UI
- [ ] Implement API authentication (JWT)
- [ ] Enable ScyllaDB authentication
- [ ] Restrict Prometheus/Grafana access
- [ ] Use secrets management (Vault, AWS Secrets Manager)
- [ ] Enable audit logging
- [ ] Regular backup schedule
- [ ] Network segmentation with firewall rules

### Environment Variables
Never commit `.env` files. Use template:
```bash
# .env.template
POSTGRES_URL=postgresql://user:password@host:port/db
GOOGLE_API_KEY=your_key_here
WANDB_API_KEY=your_key_here
KAFKA_BOOTSTRAP_SERVERS=broker-1:29092
```

---

**Version:** 1.0.0  
**Last Updated:** November 2025

---

## Contributing

Contributions are welcome! Please follow these guidelines:

### How to Contribute
1. Fork the repository
2. Create feature branch: `git checkout -b feature/your-feature-name`
3. Make changes and test thoroughly
4. Commit with clear messages: `git commit -m "Add feature: description"`
5. Push to branch: `git push origin feature/your-feature-name`
6. Open Pull Request with detailed description

### Code Style
- **Python**: Follow PEP 8, use `black` formatter
- **TypeScript**: Follow ESLint rules, use Prettier
- **SQL**: Uppercase keywords, lowercase identifiers
- **Docker**: Use multi-stage builds, minimize layers

### Testing
- Add unit tests for new features
- Ensure existing tests pass: `pytest tests/`
- Test Docker builds locally
- Verify integration with other services

### Documentation
- Update README for new features
- Add docstrings to functions/classes
- Include usage examples
- Update API documentation

---

## Roadmap

### Phase 1 (Current - Q4 2024)
- [x] Real-time stock price streaming
- [x] Apache Flink stream processing
- [x] ScyllaDB time-series storage
- [x] PostgreSQL data warehouse
- [x] Airflow ETL pipeline
- [x] Real-time web dashboard
- [x] Prometheus + Grafana monitoring
- [x] ML-based price prediction

### Phase 2 (Q1 2025)
- [ ] Sentiment analysis from news
- [ ] Twitter/social media integration
- [ ] Multi-model ensemble predictions
- [ ] Automated trading signals
- [ ] Mobile app (React Native)
- [ ] Advanced technical indicators (200+)

### Phase 3 (Q2 2025)
- [ ] Reinforcement learning for trading
- [ ] Portfolio optimization engine
- [ ] Risk management dashboard
- [ ] Multi-exchange support (HOSE, HNX, UPCOM)
- [ ] Real-time alerts (Telegram, Email)
- [ ] Backtesting framework

### Phase 4 (Q3 2025)
- [ ] Kubernetes deployment
- [ ] Auto-scaling infrastructure
- [ ] ML model marketplace
- [ ] API monetization
- [ ] White-label solution
- [ ] Institutional-grade features

---

## License

This project is licensed under the MIT License - see below for details:

```
MIT License

Copyright (c) 2024 Ky Tran

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Acknowledgments

- **Apache Software Foundation**: Kafka, Flink, Airflow
- **ScyllaDB Team**: High-performance NoSQL database
- **Yahoo Finance**: Real-time stock data API
- **WandB Team**: Experiment tracking platform
- **Google**: Gemini AI for alpha generation
- **PyTorch Community**: Deep learning framework
- **Vercel**: Next.js framework
- **Grafana Labs**: Monitoring stack

---

## Contact & Support

**Author**: Ky Tran  
**Repository**: [MLOps-based-Realtime-Data-Platform-for-Stock-Market-Prediction](https://github.com/user-kytran/MLOps-based-Realtime-Data-Platform-for-Stock-Market-Prediction)

**For Issues**: Please open an issue on GitHub  
**For Questions**: Discussions tab on GitHub  
**For Commercial Support**: Contact via repository

---

## Citation

If you use this project in your research or work, please cite:

```bibtex
@software{tran2024mlops_stock_platform,
  author = {Tran, Ky},
  title = {MLOps-based Realtime Data Platform for Stock Market Prediction},
  year = {2024},
  url = {https://github.com/user-kytran/MLOps-based-Realtime-Data-Platform-for-Stock-Market-Prediction},
  note = {Real-time stock market data platform with ML predictions}
}
```

---

**⭐ Star this repo if you find it useful!**

**🔔 Watch for updates and new features**

**🍴 Fork to create your own trading platform**


