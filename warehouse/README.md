# Warehouse Service

**PostgreSQL data warehouse with TimescaleDB for stock market analytics and ML training**

## Overview

Centralized data warehouse built on PostgreSQL/TimescaleDB with Snowflake schema design. Stores historical OHLCV data, news with sentiment analysis, and ML predictions for analytics, BI tools, and machine learning model training.

## Features

- ✅ **Snowflake Schema** - Optimized for analytics queries
- ✅ **TimescaleDB** - Time-series optimization
- ✅ **ETL Integration** - Daily Airflow dumps from ScyllaDB
- ✅ **ML-Ready** - Structured data for training pipelines
- ✅ **Indexing** - Fast lookups on symbol and date
- ✅ **Partitioning** - Automatic time-based partitioning

## Architecture

```
┌────────────────────────────────────┐
│   dim_stock (Dimension Table)      │
│   - Stock metadata                 │
│   - Exchange info                  │
│   - Industry sector                │
└──────────────┬─────────────────────┘
               ↓
    ┌──────────┼──────────┐
    ↓          ↓          ↓
┌─────────────────────────────────────┐
│  fact_daily_prices                  │
│  - Historical OHLCV                 │
│  - Daily aggregates                 │
│  - ML training data                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  fact_news                          │
│  - News articles                    │
│  - Sentiment scores                 │
│  - Source links                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│  fact_predictions                   │
│  - ML model predictions             │
│  - Confidence scores                │
│  - Model metadata                   │
└─────────────────────────────────────┘
```

## Tech Stack

- **Database**: PostgreSQL 14+ with TimescaleDB extension
- **Schema**: Snowflake (1 dimension + 3 fact tables)
- **Container**: Docker
- **ETL**: Apache Airflow (daily dumps)

## Quick Start

### Prerequisites

```bash
# Create network
docker network create financi-network
```

### 1. Start Warehouse

```bash
cd warehouse
docker compose up -d

# Wait for database ready
docker logs warehouse-db | grep "ready to accept connections"
```

### 2. Verify Installation

```bash
# Connect to database
docker exec -it warehouse-db psql -U warehouse_user -d warehouse

# List tables
\dt

# Expected output:
# dim_stock
# fact_daily_prices
# fact_news
# fact_predictions
```

### 3. Check Data

```sql
-- Count stocks
SELECT COUNT(*) FROM dim_stock;

-- Recent daily prices
SELECT * FROM fact_daily_prices 
ORDER BY date DESC LIMIT 10;

-- Latest predictions
SELECT * FROM fact_predictions 
ORDER BY prediction_date DESC LIMIT 10;
```

## Database Schema

### dim_stock (Dimension)

Stock metadata and attributes.

```sql
CREATE TABLE dim_stock (
    symbol VARCHAR(20) PRIMARY KEY,
    company_name VARCHAR(255),
    exchange VARCHAR(50),
    industry VARCHAR(100),
    sector VARCHAR(100),
    market_cap BIGINT,
    listed_date DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_dim_stock_exchange ON dim_stock(exchange);
CREATE INDEX idx_dim_stock_sector ON dim_stock(sector);
```

### fact_daily_prices (Fact)

Historical OHLCV data for ML training.

```sql
CREATE TABLE fact_daily_prices (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) REFERENCES dim_stock(symbol),
    date DATE NOT NULL,
    open DECIMAL(18, 4),
    high DECIMAL(18, 4),
    low DECIMAL(18, 4),
    close DECIMAL(18, 4),
    volume BIGINT,
    vwap DECIMAL(18, 4),
    change DECIMAL(18, 4),
    change_percent DECIMAL(10, 4),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, date)
);

-- TimescaleDB hypertable
SELECT create_hypertable('fact_daily_prices', 'date', if_not_exists => TRUE);

-- Indexes
CREATE INDEX idx_fact_daily_symbol_date ON fact_daily_prices(symbol, date DESC);
CREATE INDEX idx_fact_daily_date ON fact_daily_prices(date DESC);
```

### fact_news (Fact)

News articles with sentiment analysis.

```sql
CREATE TABLE fact_news (
    id BIGSERIAL PRIMARY KEY,
    article_id VARCHAR(255) UNIQUE,
    symbol VARCHAR(20) REFERENCES dim_stock(symbol),
    title TEXT,
    content TEXT,
    link TEXT,
    source VARCHAR(100),
    published_at TIMESTAMP,
    sentiment_score DECIMAL(5, 4),  -- -1.0 to 1.0
    sentiment_label VARCHAR(20),    -- positive, negative, neutral
    crawled_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_fact_news_symbol_date ON fact_news(symbol, published_at DESC);
CREATE INDEX idx_fact_news_sentiment ON fact_news(sentiment_score);
```

### fact_predictions (Fact)

ML model predictions and confidence scores.

```sql
CREATE TABLE fact_predictions (
    id BIGSERIAL PRIMARY KEY,
    symbol VARCHAR(20) REFERENCES dim_stock(symbol),
    prediction_date DATE NOT NULL,
    predicted_price DECIMAL(18, 4),
    current_price DECIMAL(18, 4),
    predicted_change DECIMAL(18, 4),
    predicted_change_percent DECIMAL(10, 4),
    confidence DECIMAL(5, 4),       -- 0.0 to 1.0
    model_name VARCHAR(100),
    model_type VARCHAR(50),
    mse DECIMAL(18, 8),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, prediction_date, model_name)
);

-- Indexes
CREATE INDEX idx_fact_predictions_symbol_date ON fact_predictions(symbol, prediction_date DESC);
CREATE INDEX idx_fact_predictions_date ON fact_predictions(prediction_date DESC);
CREATE INDEX idx_fact_predictions_model ON fact_predictions(model_type);
```

## Configuration

### Environment Variables

**docker-compose.yml:**
```yaml
environment:
  POSTGRES_DB: warehouse
  POSTGRES_USER: warehouse_user
  POSTGRES_PASSWORD: warehouse_password
  PGDATA: /var/lib/postgresql/data/pgdata
```

### Connection Strings

**Internal (from containers):**
```
postgresql://warehouse_user:warehouse_password@warehouse-db:5432/warehouse
```

**External (from host):**
```
postgresql://warehouse_user:warehouse_password@localhost:5433/warehouse
```

### TimescaleDB Configuration

```sql
-- Check TimescaleDB version
SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';

-- View hypertables
SELECT * FROM timescaledb_information.hypertables;

-- View chunks
SELECT * FROM timescaledb_information.chunks;

-- Compression policy (optional)
ALTER TABLE fact_daily_prices SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'symbol'
);

SELECT add_compression_policy('fact_daily_prices', INTERVAL '30 days');
```

## ETL Pipeline

### Daily Dump from ScyllaDB

Airflow DAG `dump_to_warehouse` runs daily:

```python
# Pseudo-code
scylla_data = SELECT * FROM scylla.stock_daily_summary WHERE date = yesterday
warehouse.fact_daily_prices.insert(scylla_data)
```

### News Crawling

Airflow DAG `DAGs_newstock` runs every 6 hours:

```python
# Pseudo-code
news = crawl_vietstock_news()
sentiment = analyze_sentiment(news)
warehouse.fact_news.insert(news + sentiment)
```

### Predictions Storage

ML service directly writes predictions:

```python
from sqlalchemy import create_engine

engine = create_engine(POSTGRES_URL)
predictions_df.to_sql('fact_predictions', engine, if_exists='append')
```

## Querying

### Common Queries

**Get ML training data for a symbol:**
```sql
SELECT date, open, high, low, close, volume
FROM fact_daily_prices
WHERE symbol = 'VCB.VN'
  AND date >= NOW() - INTERVAL '60 days'
ORDER BY date;
```

**Top predicted gainers:**
```sql
SELECT symbol, predicted_change_percent, confidence
FROM fact_predictions
WHERE prediction_date = CURRENT_DATE
ORDER BY predicted_change_percent DESC
LIMIT 10;
```

**News sentiment by symbol:**
```sql
SELECT symbol, 
       COUNT(*) as news_count,
       AVG(sentiment_score) as avg_sentiment,
       MIN(published_at) as earliest,
       MAX(published_at) as latest
FROM fact_news
WHERE published_at >= NOW() - INTERVAL '7 days'
GROUP BY symbol
ORDER BY avg_sentiment DESC;
```

**Model performance:**
```sql
SELECT model_type, 
       COUNT(*) as predictions,
       AVG(mse) as avg_mse,
       AVG(confidence) as avg_confidence
FROM fact_predictions
WHERE prediction_date >= CURRENT_DATE - 30
GROUP BY model_type
ORDER BY avg_mse;
```

## Backup & Recovery

### Backup Database

```bash
# Full dump
docker exec warehouse-db pg_dump -U warehouse_user warehouse > warehouse_backup.sql

# Gzipped
docker exec warehouse-db pg_dump -U warehouse_user warehouse | gzip > warehouse_backup.sql.gz

# Specific table
docker exec warehouse-db pg_dump -U warehouse_user -t fact_daily_prices warehouse > daily_prices_backup.sql
```

### Restore Database

```bash
# Restore full dump
cat warehouse_backup.sql | docker exec -i warehouse-db psql -U warehouse_user -d warehouse

# From gzipped
gunzip -c warehouse_backup.sql.gz | docker exec -i warehouse-db psql -U warehouse_user -d warehouse

# Restore specific table
cat daily_prices_backup.sql | docker exec -i warehouse-db psql -U warehouse_user -d warehouse
```

### Automated Backups

```bash
# Cron job (daily at 2 AM)
0 2 * * * /path/to/warehouse/backup.sh

# backup.sh
#!/bin/bash
DATE=$(date +%Y%m%d)
docker exec warehouse-db pg_dump -U warehouse_user warehouse | gzip > /backups/warehouse_$DATE.sql.gz
find /backups -name "warehouse_*.sql.gz" -mtime +30 -delete  # Keep 30 days
```

## Monitoring

### Database Stats

```sql
-- Table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Row counts
SELECT 
  'dim_stock' as table_name, COUNT(*) as rows FROM dim_stock
UNION ALL
SELECT 'fact_daily_prices', COUNT(*) FROM fact_daily_prices
UNION ALL
SELECT 'fact_news', COUNT(*) FROM fact_news
UNION ALL
SELECT 'fact_predictions', COUNT(*) FROM fact_predictions;

-- Index usage
SELECT 
  schemaname, tablename, indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

### Performance Monitoring

```bash
# Active connections
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "SELECT COUNT(*) FROM pg_stat_activity;"

# Slow queries
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# Cache hit ratio
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "SELECT sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) AS cache_hit_ratio FROM pg_statio_user_tables;"
```

## Troubleshooting

### Issue: Connection refused

```bash
# Check if container is running
docker ps | grep warehouse-db

# Check logs
docker logs warehouse-db

# Restart container
docker restart warehouse-db
```

### Issue: Slow queries

```bash
# Enable query logging
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "ALTER SYSTEM SET log_min_duration_statement = 1000;"  # Log queries > 1s

# Restart to apply
docker restart warehouse-db

# Analyze query
EXPLAIN ANALYZE SELECT * FROM fact_daily_prices WHERE symbol = 'VCB.VN';

# Create missing index
CREATE INDEX idx_custom ON fact_daily_prices(column_name);
```

### Issue: Disk space full

```bash
# Check disk usage
docker exec warehouse-db df -h

# Check database size
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "SELECT pg_size_pretty(pg_database_size('warehouse'));"

# Vacuum tables
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "VACUUM FULL ANALYZE;"

# Drop old data
docker exec warehouse-db psql -U warehouse_user -d warehouse \
  -c "DELETE FROM fact_daily_prices WHERE date < NOW() - INTERVAL '1 year';"
```

## Performance Tuning

### PostgreSQL Configuration

**postgresql.conf adjustments:**
```ini
# Memory
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 64MB
maintenance_work_mem = 512MB

# Connections
max_connections = 200

# WAL
wal_buffers = 16MB
checkpoint_completion_target = 0.9

# Query planner
random_page_cost = 1.1  # For SSDs
```

### Indexing Strategy

```sql
-- Composite index for common queries
CREATE INDEX idx_daily_prices_symbol_date ON fact_daily_prices(symbol, date DESC);

-- Partial index for recent data
CREATE INDEX idx_recent_predictions ON fact_predictions(symbol, prediction_date)
WHERE prediction_date >= CURRENT_DATE - 30;

-- GIN index for full-text search on news
CREATE INDEX idx_news_fulltext ON fact_news USING gin(to_tsvector('english', title || ' ' || content));
```

## Scaling

### Vertical Scaling

Increase container resources:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
    reservations:
      cpus: '2'
      memory: 4G
```

### Read Replicas

Setup streaming replication:

```yaml
# docker-compose.yml
warehouse-db-replica:
  image: timescale/timescaledb:latest-pg14
  environment:
    POSTGRES_MASTER_SERVICE_HOST: warehouse-db
    POSTGRES_REPLICATION_MODE: slave
```

### Partitioning

TimescaleDB automatic partitioning:

```sql
-- Already done for fact_daily_prices
SELECT create_hypertable('fact_daily_prices', 'date');

-- Manual partitioning for fact_news (if needed)
CREATE TABLE fact_news_2024 PARTITION OF fact_news
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');
```

## Ports

| Service | Internal Port | External Port | Description |
|---------|--------------|---------------|-------------|
| warehouse-db | 5432 | 5433 | PostgreSQL |

## Dependencies

**Docker Image:** `timescale/timescaledb:latest-pg14`

**Extensions:**
- `timescaledb` - Time-series optimization
- `pg_stat_statements` - Query statistics
- `pg_trgm` - Similarity search

## License

Part of MLOps Stock Market Prediction Platform - MIT License

## Support

For issues, see main project documentation or open a GitHub issue.

---

**Part of**: [MLOps-based Realtime Data Platform for Stock Market Prediction](https://github.com/user-kytran/MLOps-based-Realtime-Data-Platform-for-Stock-Market-Prediction)
