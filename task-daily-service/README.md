# Task Daily Service

## Mục đích
Apache Airflow service để chạy scheduled tasks hàng ngày cho hệ thống stock trading. Bao gồm ETL data warehouse, crawl news với sentiment analysis, và trigger prediction model.

## Cấu trúc
```
task-daily-service/
├── docker-compose.yml         # Airflow stack (webserver, scheduler, postgres)
├── Dockerfile                 # Custom Airflow image
├── requirements.txt           # Python dependencies
├── dags/
│   ├── DAGs_warehouse.py      # ETL ScyllaDB → PostgreSQL warehouse
│   ├── DAGs_prediction.py     # Trigger stock prediction daily
│   ├── DAGs_newstock.py       # Crawl news + sentiment analysis
│   └── news_stock/
│       └── newscrawler.py     # News crawler implementation
├── logs/                      # Airflow logs
└── data/                      # Shared data folder
```

### Services
- **postgres**: Airflow metadata database
- **airflow-init**: Database migration và create admin user
- **airflow-webserver**: Web UI (port 8087)
- **airflow-scheduler**: Task scheduler

## Chức năng

### DAG 1: Warehouse ETL (`DAGs_warehouse.py`)
**Schedule**: 00:30 hàng ngày (UTC)

**Pipeline**:
1. Get latest date từ warehouse
2. Fetch data từ ScyllaDB (`stock_daily_summary`)
3. Transform data theo Star Schema:
   - `dim_stock`: Stock dimensions
   - `dim_date`: Date dimensions
   - `fact_daily_prices`: Daily OHLCV facts
4. Upsert vào PostgreSQL warehouse

**Tables**:
- Source: ScyllaDB `stock_data.stock_daily_summary`
- Target: PostgreSQL warehouse với star schema

### DAG 2: Stock Prediction (`DAGs_prediction.py`)
**Schedule**: 23:00 hàng ngày (Asia/Ho_Chi_Minh)

**Logic**:
1. Check ngày mai có phải trading day không
2. Skip nếu là weekend hoặc VN holiday
3. Trigger prediction API với `prediction_date`

**API Call**:
```python
POST {TRAINING_API_URL}
{
  "prediction_date": "2025-11-18"
}
```

### DAG 3: News Crawler (`DAGs_newstock.py`)
**Schedule**: 30 23 * * * (23:30 hàng ngày)

**Pipeline**:
1. Crawl news từ nguồn tin tức chứng khoán
2. Download PDF files (nếu có)
3. Analyze với Gemini AI:
   - Extract summary
   - Calculate sentiment score (-1 to 1)
4. Save vào ScyllaDB `stock_news` table
5. Parallel processing với 50 workers

**Features**:
- Duplicate detection (check article_id exists)
- PDF analysis với Google Gemini
- Sentiment scoring
- Concurrent processing

## Cách sử dụng

### Setup môi trường
Tạo file `.env` trong `dags/`:
```bash
# ScyllaDB
SCYLLA_NODE1=scylla-node1
SCYLLA_NODE2=scylla-node2
SCYLLA_NODE3=scylla-node3
SCYLLA_KEYSPACE=stock_data
SCYLLA_PORT=9042
SCYLLA_DC=datacenter1

# PostgreSQL Warehouse
HOST=warehouse-host
DATABASE=stock_warehouse
USER=postgres
PASSWORD=your_password

# APIs
TRAINING_API_URL=http://prediction-api:8006/stock-prediction
GOOGLE_API_KEY=your_gemini_api_key
```

### Khởi động service
```bash
docker compose up -d
```

### Truy cập Airflow UI
```
http://localhost:8087
Username: admin
Password: admin
```

### Xem logs
```bash
docker logs -f airflow-scheduler
docker logs -f airflow-webserver

tail -f logs/scheduler/latest/*.log
```

### Trigger DAG thủ công
Trong Airflow UI:
1. Vào DAGs page
2. Click vào DAG muốn chạy
3. Click "Trigger DAG" button

### Dừng service
```bash
docker compose down
```

### Xóa data và restart
```bash
docker compose down -v
docker compose up -d
```

## Quy ước

### DAG Schedule
- Warehouse ETL: 00:30 UTC (07:30 VN)
- Prediction: 23:00 VN time
- News Crawler: 23:30 VN time

### Executor
- LocalExecutor (single node, đủ cho workload hiện tại)
- Max active tasks per DAG: 5
- Max active runs per DAG: 1

### Retry Policy
- Default retries: 3
- Retry delay: 2 minutes (warehouse), 5 minutes (news)
- Execution timeout: 60 minutes

### Memory Optimization
**PostgreSQL**:
- shared_buffers: 32MB
- work_mem: 4MB
- Max connections: default

**Airflow Webserver**:
- Workers: 2
- Worker timeout: 300s

**Airflow Scheduler**:
- Parsing processes: 1
- Max threads: 1
- Parallelism: 8

### Network
- Network: `financi-network` (external)
- Kết nối với ScyllaDB, PostgreSQL, Prediction API

## Ghi chú phát triển

### Thêm DAG mới
1. Tạo file Python trong `dags/`
2. Import Airflow modules
3. Define DAG với schedule và tasks
4. File tự động detect (scan mỗi 60s)

### Modify existing DAG
1. Sửa file trong `dags/`
2. Airflow auto-reload (có thể mất ~60s)
3. Hoặc restart scheduler: `docker restart airflow-scheduler`

### Debug DAG
```bash
docker exec -it airflow-scheduler bash

airflow dags list

airflow tasks test DAG_ID TASK_ID 2025-11-17

airflow dags test DAG_ID 2025-11-17
```

### Database operations
**Airflow metadata**:
```bash
docker exec -it postgres psql -U airflow -d airflow
```

**Reset DAG runs**:
```sql
DELETE FROM dag_run WHERE dag_id = 'stock_prediction_daily';
```

### Performance tuning
**Tăng parallelism**:
```yaml
environment:
  - AIRFLOW__CORE__PARALLELISM=16
  - AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG=10
```

**Tăng workers**:
```yaml
environment:
  - AIRFLOW__WEBSERVER__WORKERS=4
```

### Troubleshooting

**DAG không xuất hiện**:
- Check logs: `docker logs airflow-scheduler`
- Verify Python syntax: `python dags/YOUR_DAG.py`
- Check file permissions: `chmod 644 dags/*.py`

**Task failed**:
- Xem logs trong Airflow UI: DAG → Task → Logs
- Hoặc: `logs/dag_id/task_id/execution_date/*.log`
- Retry từ UI hoặc CLI

**Connection timeout**:
- Verify services healthy: ScyllaDB, PostgreSQL, APIs
- Check network connectivity
- Increase timeout trong task

**Memory issues**:
- Monitor: `docker stats`
- Giảm parallelism và active tasks
- Tăng memory limits trong docker-compose

**Scheduler không chạy tasks**:
- Check scheduler running: `docker ps`
- Verify schedule interval correct
- Check timezone settings
- Unpause DAG trong UI

### Dependencies
- Apache Airflow 2.10.0
- PostgreSQL 13
- Python packages:
  - langchain + Google Gemini
  - cassandra-driver (ScyllaDB)
  - psycopg2 (PostgreSQL)
  - beautifulsoup4 (web scraping)
  - holidays (VN holidays)

### Airflow UI Features
- DAG visualization (graph view)
- Task logs và status
- Manual trigger DAGs
- Variable management
- Connection management
- User management (RBAC)

### Best Practices
- DAG idempotent: Có thể chạy lại nhiều lần
- Use context managers cho connections
- Handle exceptions gracefully
- Log thông tin chi tiết
- Use retry với exponential backoff
- Test DAG trước khi deploy

