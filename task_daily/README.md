# Task Daily - Airflow ETL Pipeline

Apache Airflow service để schedule các tasks daily: dump data từ ScyllaDB sang warehouse, crawl stock news, và các batch processing khác.

## Tổng quan

Service chạy Airflow với LocalExecutor để orchestrate các daily tasks:
- Dump dữ liệu từ ScyllaDB sang PostgreSQL warehouse
- Crawl tin tức chứng khoán và sentiment analysis
- Batch aggregation và reporting

## Kiến trúc

```
Airflow Scheduler
      ↓
┌─────────────────────┐
│   Daily DAGs        │
├─────────────────────┤
│ 1. dump_to_warehouse│ → ScyllaDB → Warehouse
│ 2. crawl_news       │ → Websites → ScyllaDB
│ 3. batch_agg        │ → Process data
└─────────────────────┘
      ↓
PostgreSQL (metadata)
```

## Components

- **Airflow Webserver** (:8087): Web UI
- **Airflow Scheduler**: Task orchestration
- **PostgreSQL**: Metadata database
- **LocalExecutor**: Task execution

## Cài đặt

### 1. Khởi động Airflow

```bash
cd task_daily
docker compose up -d
```

**Services:**
- `postgres`: Metadata database
- `airflow-init`: One-time DB migration & user creation
- `airflow-webserver`: Web UI (port 8087)
- `airflow-scheduler`: Task scheduler

### 2. Access Web UI

- **URL**: http://localhost:8087
- **Username**: admin
- **Password**: admin

### 3. Verify DAGs

```bash
# List DAGs
docker exec airflow-scheduler airflow dags list

# Trigger manual run
docker exec airflow-scheduler airflow dags trigger dump_to_warehouse
```

## DAGs

### 1. dump_to_warehouse

Dump dữ liệu từ ScyllaDB sang PostgreSQL warehouse daily.

**Schedule:** `@daily` (00:00 UTC)

**Tasks:**
1. Extract daily summary từ `stock_daily_summary`
2. Extract news từ `stock_news`
3. Transform data (cleaning, validation)
4. Load vào warehouse (`fact_daily_prices`, `fact_news`)

**File:** `dags/dump_to_warehouse.py`

### 2. DAGs_newstock

Crawl tin tức chứng khoán từ các website.

**Schedule:** `0 */6 * * *` (Mỗi 6 giờ)

**Tasks:**
1. Crawl news từ cafef.vn, vietstock.vn
2. Extract content từ HTML/PDF
3. Sentiment analysis (score)
4. Insert vào `stock_news` table

**File:** `dags/DAGs_newstock.py`

## Configuration

### Airflow Settings

```yaml
AIRFLOW__CORE__EXECUTOR: LocalExecutor
AIRFLOW__CORE__MAX_ACTIVE_TASKS_PER_DAG: 5
AIRFLOW__CORE__MAX_ACTIVE_RUNS_PER_DAG: 1
AIRFLOW__SCHEDULER__MIN_FILE_PROCESS_INTERVAL: 30
```

### Resource Limits

**Optimized cho low-memory environments:**
- Webserver workers: 2
- Scheduler threads: 1
- Max parallel tasks: 8

### Connections

**ScyllaDB:**
```python
conn_id: scylla_default
host: scylla-node1
port: 9042
```

**Warehouse:**
```python
conn_id: warehouse_postgres
host: warehouse-db
port: 5432
database: warehouse
```

## DAG Development

### Create new DAG

```python
# dags/my_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime

def my_task():
    # Your logic here
    pass

with DAG(
    'my_dag',
    start_date=datetime(2025, 1, 1),
    schedule_interval='@daily',
    catchup=False
) as dag:
    
    task1 = PythonOperator(
        task_id='my_task',
        python_callable=my_task
    )
```

### Test DAG

```bash
# Test task
docker exec airflow-scheduler airflow tasks test my_dag my_task 2025-11-10

# Dry run
docker exec airflow-scheduler airflow dags test my_dag 2025-11-10
```

## Monitoring

### Web UI

**Truy cập:** http://localhost:8087

**Views:**
- **DAGs**: List tất cả DAGs và status
- **Graph**: Dependency graph của tasks
- **Tree**: Historical runs
- **Gantt**: Timeline view
- **Logs**: Task logs

### CLI

```bash
# DAG status
docker exec airflow-scheduler airflow dags state dump_to_warehouse

# Task logs
docker exec airflow-scheduler airflow tasks logs dump_to_warehouse extract_daily_summary 2025-11-10

# List running tasks
docker exec airflow-scheduler airflow tasks list dump_to_warehouse --tree
```

## Logs

### Container Logs

```bash
# Scheduler logs
docker logs -f airflow-scheduler

# Webserver logs
docker logs -f airflow-webserver
```

### Task Logs

**Location:** `logs/` directory

```bash
# View task log
cat logs/dump_to_warehouse/extract_daily_summary/2025-11-10T00:00:00+00:00/1.log
```

## Data Flow

### Dump to Warehouse

```
ScyllaDB (stock_daily_summary)
        ↓
Extract (PythonOperator)
        ↓
Transform (data cleaning)
        ↓
Load (PostgreSQL warehouse)
        ↓
fact_daily_prices table
```

### News Crawling

```
News Websites (cafef, vietstock)
        ↓
Crawl HTML/PDF (PythonOperator)
        ↓
Extract content (BeautifulSoup)
        ↓
Sentiment Analysis (NLP model)
        ↓
ScyllaDB (stock_news)
```

## Troubleshooting

### Airflow không start

```bash
# Check PostgreSQL health
docker logs postgres

# Re-init database
docker compose down
docker volume rm task_daily_postgres_data
docker compose up -d
```

### DAG không appear

```bash
# Check DAG errors
docker exec airflow-scheduler airflow dags list-import-errors

# Refresh DAGs
docker exec airflow-scheduler airflow dags reserialize
```

### Task fails

```bash
# Check task logs
docker exec airflow-scheduler airflow tasks logs <dag_id> <task_id> <execution_date>

# Retry task
docker exec airflow-scheduler airflow tasks clear <dag_id> -t <task_id>
```

### High memory usage

```bash
# Check stats
docker stats airflow-scheduler airflow-webserver

# Reduce parallelism
# Edit docker-compose.yml:
AIRFLOW__CORE__PARALLELISM: 4
AIRFLOW__SCHEDULER__MAX_THREADS: 1
```

## Backup

### Metadata Backup

```bash
# Backup PostgreSQL
docker exec postgres pg_dump -U airflow airflow > airflow_backup.sql

# Restore
docker exec -i postgres psql -U airflow airflow < airflow_backup.sql
```

### DAGs Backup

```bash
# Backup DAGs folder
tar -czf dags_backup.tar.gz dags/
```

## Performance Tuning

### Increase Workers

```yaml
# docker-compose.yml
AIRFLOW__WEBSERVER__WORKERS: 4
AIRFLOW__SCHEDULER__PARSING_PROCESSES: 2
```

### Optimize PostgreSQL

```yaml
postgres:
  command: >
    postgres -c shared_buffers=64MB
    -c effective_cache_size=128MB
    -c maintenance_work_mem=32MB
```

## Environment Variables

```yaml
AIRFLOW__CORE__EXECUTOR: LocalExecutor
AIRFLOW__DATABASE__SQL_ALCHEMY_CONN: postgresql+psycopg2://airflow:airflow@postgres:5432/airflow
AIRFLOW__WEBSERVER__SECRET_KEY: ${AIRFLOW_SECRET_KEY:-changeme}
AIRFLOW__CORE__DEFAULT_TIMEZONE: UTC
```

## Dependencies

### Python Packages

```txt
apache-airflow==2.7.0
cassandra-driver
psycopg2-binary
beautifulsoup4
requests
pandas
```

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Webserver | 8087 | Web UI |
| PostgreSQL | 5432 (internal) | Metadata DB |

## License

Proprietary - Stock AI Project

