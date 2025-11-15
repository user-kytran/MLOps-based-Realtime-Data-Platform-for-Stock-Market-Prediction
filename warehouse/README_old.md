# Warehouse - Data Warehouse PostgreSQL

PostgreSQL/TimescaleDB data warehouse với Snowflake schema cho stock trading analytics và machine learning.

## Tổng quan

Data warehouse centralized để:
- Lưu trữ historical stock prices (OHLCV)
- Lưu trữ news content và sentiment analysis
- Lưu trữ predictions từ ML models
- Support analytics và BI tools

## Kiến trúc

### Snowflake Schema

```
         dim_stock (Dimension)
               ↓
      ┌────────┼────────┐
      ↓        ↓        ↓
fact_daily   fact_news  fact_predictions
  (Fact)      (Fact)       (Fact)
```

**Ưu điểm:**
- Normalized dimension (dim_stock)
- Denormalized facts (fast queries)
- Scalable cho ML training data

## Cài đặt

### 1. Khởi động warehouse

```bash
cd warehouse
docker compose up -d
```

**Services:**
- `postgres-warehouse`: TimescaleDB container
- **Port:** 5433 (external), 5432 (internal)

### 2. Verify database

```bash
# Connect to database
docker exec -it warehouse-db psql -U warehouse_user -d warehouse

# List tables
\dt

# Output:
# dim_stock
# fact_daily_prices
# fact_news
# fact_predictions
```

## Database Schema

### Dimension Table: dim_stock

Thông tin stock symbols (normalized):

```sql
CREATE TABLE dim_stock (
   stock_code TEXT PRIMARY KEY,
   exchange TEXT NOT NULL,
   quote_type INT,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_dim_stock_exchange`: Index trên exchange

### Fact Table: fact_daily_prices

Daily OHLCV data (training data cho ML):

```sql
CREATE TABLE fact_daily_prices (
   stock_code TEXT NOT NULL,
   trade_date DATE NOT NULL,
   open DOUBLE PRECISION NOT NULL,
   high DOUBLE PRECISION NOT NULL,
   low DOUBLE PRECISION NOT NULL,
   close DOUBLE PRECISION NOT NULL,
   volume BIGINT NOT NULL,
   change DOUBLE PRECISION,
   change_percent DOUBLE PRECISION,
   vwap DOUBLE PRECISION,
   market_hours INT,
   PRIMARY KEY (stock_code, trade_date),
   FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);
```

**Indexes:**
- `idx_fact_prices_date`: Index trên trade_date
- `idx_fact_prices_stock_date`: Composite index

### Fact Table: fact_news

News content và sentiment (training data cho NLP):

```sql
CREATE TABLE fact_news (
   stock_code TEXT NOT NULL,
   news_date DATE NOT NULL,
   content TEXT NOT NULL,
   article_id TEXT NOT NULL,
   sentiment_score FLOAT,
   PRIMARY KEY (stock_code, news_date, article_id),
   FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);
```

**Indexes:**
- `idx_fact_news_date`: Index trên news_date
- `idx_fact_news_stock_date`: Composite index

### Fact Table: fact_predictions

ML model predictions (output):

```sql
CREATE TABLE fact_predictions (
  stock_code TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_price DOUBLE PRECISION NOT NULL,
  model_version VARCHAR(50),
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stock_code, prediction_date),
  FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);
```

## Sử dụng

### Connect to Database

```bash
# psql
docker exec -it warehouse-db psql -U warehouse_user -d warehouse

# Python
import psycopg2
conn = psycopg2.connect(
    host='localhost',
    port=5433,
    database='warehouse',
    user='warehouse_user',
    password='warehouse_pass'
)
```

### Query Examples

#### 1. Get OHLCV data cho training

```sql
-- Latest 100 days của VCB
SELECT * FROM fact_daily_prices
WHERE stock_code = 'VCB.VN'
ORDER BY trade_date DESC
LIMIT 100;

-- All stocks trong tháng 11
SELECT * FROM fact_daily_prices
WHERE trade_date >= '2025-11-01' AND trade_date < '2025-12-01'
ORDER BY stock_code, trade_date;
```

#### 2. Get news content cho NLP training

```sql
-- News của FPT với sentiment
SELECT news_date, content, sentiment_score
FROM fact_news
WHERE stock_code = 'FPT.VN'
ORDER BY news_date DESC
LIMIT 50;

-- Top positive news
SELECT stock_code, news_date, content, sentiment_score
FROM fact_news
WHERE sentiment_score > 0.7
ORDER BY sentiment_score DESC
LIMIT 20;
```

#### 3. Get predictions

```sql
-- Latest predictions
SELECT p.stock_code, p.prediction_date, p.predicted_price, 
       p.confidence_score, d.exchange
FROM fact_predictions p
JOIN dim_stock d ON p.stock_code = d.stock_code
WHERE p.prediction_date >= CURRENT_DATE
ORDER BY p.prediction_date DESC;
```

#### 4. Analytics queries

```sql
-- Top gainers last 30 days
SELECT stock_code, 
       AVG(change_percent) as avg_change,
       SUM(volume) as total_volume
FROM fact_daily_prices
WHERE trade_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY stock_code
ORDER BY avg_change DESC
LIMIT 10;

-- Volatility analysis
SELECT stock_code,
       STDDEV(close) as price_volatility,
       AVG(close) as avg_price
FROM fact_daily_prices
WHERE trade_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY stock_code
ORDER BY price_volatility DESC;
```

## ETL Pipeline

### Data Flow

```
ScyllaDB (stock_daily_summary)
        ↓
Airflow DAG (dump_to_warehouse)
        ↓
Extract → Transform → Load
        ↓
PostgreSQL Warehouse (fact_daily_prices)
```

### Insert Data

```sql
-- Insert dimension
INSERT INTO dim_stock (stock_code, exchange, quote_type)
VALUES ('VCB.VN', 'HOSE', 1)
ON CONFLICT (stock_code) DO NOTHING;

-- Insert daily prices
INSERT INTO fact_daily_prices 
(stock_code, trade_date, open, high, low, close, volume, 
 change, change_percent, vwap)
VALUES 
('VCB.VN', '2025-11-10', 95.0, 96.5, 94.5, 96.0, 1500000,
 1.0, 1.05, 95.8);

-- Insert news
INSERT INTO fact_news 
(stock_code, news_date, content, article_id, sentiment_score)
VALUES 
('VCB.VN', '2025-11-10', 'Vietcombank công bố kết quả kinh doanh...', 
 'vcb-q3-2025', 0.85);

-- Insert predictions
INSERT INTO fact_predictions 
(stock_code, prediction_date, predicted_price, model_version, confidence_score)
VALUES 
('VCB.VN', '2025-11-11', 97.2, 'lstm-v1.0', 0.78);
```

## Backup

### Dump Database

```bash
# Full backup
docker exec warehouse-db pg_dump -U warehouse_user warehouse > warehouse_backup.sql

# Only schema
docker exec warehouse-db pg_dump -U warehouse_user -s warehouse > schema_backup.sql

# Only data
docker exec warehouse-db pg_dump -U warehouse_user -a warehouse > data_backup.sql
```

### Restore

```bash
# Restore full
docker exec -i warehouse-db psql -U warehouse_user warehouse < warehouse_backup.sql

# Restore specific table
docker exec -i warehouse-db psql -U warehouse_user warehouse < fact_daily_prices.sql
```

## Monitoring

### Database Size

```sql
-- Total database size
SELECT pg_size_pretty(pg_database_size('warehouse'));

-- Table sizes
SELECT 
  table_name,
  pg_size_pretty(pg_total_relation_size(table_name::regclass)) as size
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY pg_total_relation_size(table_name::regclass) DESC;
```

### Row Counts

```sql
SELECT 
  'dim_stock' as table_name, COUNT(*) as rows FROM dim_stock
UNION ALL
SELECT 'fact_daily_prices', COUNT(*) FROM fact_daily_prices
UNION ALL
SELECT 'fact_news', COUNT(*) FROM fact_news
UNION ALL
SELECT 'fact_predictions', COUNT(*) FROM fact_predictions;
```

### Index Usage

```sql
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

## Performance Tuning

### Analyze Tables

```sql
ANALYZE dim_stock;
ANALYZE fact_daily_prices;
ANALYZE fact_news;
ANALYZE fact_predictions;
```

### Vacuum

```sql
-- Reclaim storage
VACUUM FULL;

-- Auto-vacuum
VACUUM ANALYZE;
```

### Indexes

```sql
-- Create additional indexes cho frequent queries
CREATE INDEX idx_prices_close ON fact_daily_prices(close);
CREATE INDEX idx_news_sentiment ON fact_news(sentiment_score);
CREATE INDEX idx_predictions_confidence ON fact_predictions(confidence_score);
```

## ML Training Queries

### Get training data cho LSTM

```python
# Python example
import pandas as pd

query = """
SELECT stock_code, trade_date, open, high, low, close, volume
FROM fact_daily_prices
WHERE stock_code IN ('VCB.VN', 'HPG.VN', 'FPT.VN')
  AND trade_date >= '2023-01-01'
ORDER BY stock_code, trade_date
"""

df = pd.read_sql(query, conn)
```

### Get news sentiment features

```python
query = """
SELECT 
  f.stock_code, 
  f.news_date as date,
  AVG(f.sentiment_score) as avg_sentiment,
  COUNT(*) as news_count
FROM fact_news f
WHERE f.news_date >= '2023-01-01'
GROUP BY f.stock_code, f.news_date
ORDER BY f.stock_code, f.news_date
"""

df_news = pd.read_sql(query, conn)
```

## Connection Details

- **Host:** localhost (external) / warehouse-db (internal)
- **Port:** 5433 (external) / 5432 (internal)
- **Database:** warehouse
- **Username:** warehouse_user
- **Password:** warehouse_pass

## Troubleshooting

### Cannot connect

```bash
# Check container status
docker ps | grep warehouse-db

# Check logs
docker logs warehouse-db

# Restart
docker restart warehouse-db
```

### Out of disk space

```bash
# Check disk usage
docker exec warehouse-db df -h

# Clean up old data
docker exec warehouse-db psql -U warehouse_user -d warehouse -c "DELETE FROM fact_daily_prices WHERE trade_date < '2023-01-01';"
```

### Slow queries

```sql
-- Enable query logging
ALTER DATABASE warehouse SET log_min_duration_statement = 1000;

-- Check slow queries
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

## Dependencies

- TimescaleDB (PostgreSQL extension for time-series)
- Docker 20.10+
- Network: `financi-network` (external)

## License

Proprietary - Stock AI Project

