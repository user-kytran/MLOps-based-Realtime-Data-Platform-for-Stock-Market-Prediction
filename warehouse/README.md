# Warehouse

## Mục đích
PostgreSQL data warehouse với TimescaleDB extension để lưu trữ dữ liệu training cho stock prediction models. Sử dụng star schema với dimension và fact tables được tối ưu cho analytics và ML.

## Cấu trúc
```
warehouse/
├── docker-compose.yml        # TimescaleDB container
├── init.sql                  # Star schema initialization
└── warehouse_data/           # Persistent data volume
```

### Database
- **Image**: timescale/timescaledb:latest-pg14
- **Port**: 5433 (external) → 5432 (internal)
- **Database**: warehouse
- **User**: warehouse_user
- **Password**: warehouse_pass

## Schema

### Star Schema Design

#### Dimension Table
**dim_stock**: Stock dimensions
```sql
- stock_code (PK)
- exchange
- quote_type
- created_at
- updated_at
```

#### Fact Tables

**1. fact_daily_prices**: Daily OHLCV data
```sql
PK: (stock_code, trade_date)
Columns:
- open, high, low, close
- volume
- change, change_percent
- vwap
- market_hours
FK: stock_code → dim_stock
```

**2. fact_news**: News content với sentiment
```sql
PK: (stock_code, news_date, article_id)
Columns:
- content (full text)
- sentiment_score
FK: stock_code → dim_stock
```

**3. fact_predictions**: Model predictions
```sql
PK: (stock_code, prediction_date)
Columns:
- predicted_price
- model_version
- confidence_score
- created_at
FK: stock_code → dim_stock
```

### Indexes
- Primary keys: (stock_code, date) cho fast lookup
- Date indexes: Filter theo time range
- Foreign keys: Referential integrity
- Exchange index: Group by exchange

## Cách sử dụng

### Khởi động warehouse
```bash
docker compose up -d
```

### Kết nối database
```bash
docker exec -it warehouse-db psql -U warehouse_user -d warehouse
```

**Connection string**:
```
postgresql://warehouse_user:warehouse_pass@localhost:5433/warehouse
```

### Query examples

**Daily prices của VCB**:
```sql
SELECT * FROM fact_daily_prices
WHERE stock_code = 'VCB.VN'
ORDER BY trade_date DESC
LIMIT 30;
```

**News với sentiment score cao**:
```sql
SELECT stock_code, news_date, sentiment_score, content
FROM fact_news
WHERE sentiment_score > 0.5
ORDER BY news_date DESC
LIMIT 10;
```

**Latest predictions**:
```sql
SELECT * FROM fact_predictions
WHERE prediction_date > CURRENT_DATE
ORDER BY prediction_date, stock_code;
```

**Join data cho training**:
```sql
SELECT 
  p.stock_code,
  p.trade_date,
  p.open, p.high, p.low, p.close, p.volume,
  s.exchange,
  n.sentiment_score
FROM fact_daily_prices p
JOIN dim_stock s ON p.stock_code = s.stock_code
LEFT JOIN fact_news n ON p.stock_code = n.stock_code 
  AND p.trade_date = n.news_date
WHERE p.trade_date >= '2025-01-01'
ORDER BY p.stock_code, p.trade_date;
```

### Dừng warehouse
```bash
docker compose down
```

### Backup database
```bash
docker exec warehouse-db pg_dump -U warehouse_user warehouse > backup.sql
```

### Restore database
```bash
cat backup.sql | docker exec -i warehouse-db psql -U warehouse_user -d warehouse
```

## Quy ước

### Data Flow
1. **ETL từ ScyllaDB**: Airflow DAG sync daily data
   - Source: `stock_data.stock_daily_summary`
   - Target: `fact_daily_prices`
   
2. **News từ Crawler**: Airflow DAG crawl và insert
   - Source: News websites
   - Target: `fact_news`
   
3. **Predictions từ Model**: API write predictions
   - Source: Stock prediction API
   - Target: `fact_predictions`

### Primary Keys
- **Composite PK**: (stock_code, date) cho deduplication
- **stock_code**: Unique identifier (format: XXX.VN)
- **date columns**: DATE type (not timestamp)

### Foreign Keys
- Tất cả fact tables reference `dim_stock(stock_code)`
- ON DELETE: Cascade (tự động xóa facts khi xóa stock)

### Naming Convention
- Tables: lowercase với underscore
- Columns: lowercase, quoted cho reserved words ("open", "close")
- Indexes: `idx_{table}_{column(s)}`

### TimescaleDB
Có thể convert sang hypertables cho time-series optimization:
```sql
SELECT create_hypertable('fact_daily_prices', 'trade_date');
SELECT create_hypertable('fact_news', 'news_date');
SELECT create_hypertable('fact_predictions', 'prediction_date');
```

## Ghi chú phát triển

### Thêm stock mới
```sql
INSERT INTO dim_stock (stock_code, exchange, quote_type)
VALUES ('NEW.VN', 'HOSE', 1)
ON CONFLICT (stock_code) DO UPDATE SET
  exchange = EXCLUDED.exchange,
  updated_at = CURRENT_TIMESTAMP;
```

### Insert daily prices
```sql
INSERT INTO fact_daily_prices (
  stock_code, trade_date, open, high, low, close, 
  volume, change, change_percent, vwap, market_hours
)
VALUES ('VCB.VN', '2025-11-17', 85.0, 86.5, 84.5, 86.0, 
        1000000, 1.0, 1.18, 85.8, 1)
ON CONFLICT (stock_code, trade_date) DO UPDATE SET
  open = EXCLUDED.open,
  high = EXCLUDED.high,
  low = EXCLUDED.low,
  close = EXCLUDED.close,
  volume = EXCLUDED.volume,
  change = EXCLUDED.change,
  change_percent = EXCLUDED.change_percent,
  vwap = EXCLUDED.vwap;
```

### Insert news
```sql
INSERT INTO fact_news (
  stock_code, news_date, article_id, content, sentiment_score
)
VALUES ('VCB.VN', '2025-11-17', 'article123', 
        'Tin tức tích cực...', 0.75)
ON CONFLICT (stock_code, news_date, article_id) DO NOTHING;
```

### Insert predictions
```sql
INSERT INTO fact_predictions (
  stock_code, prediction_date, predicted_price, 
  model_version, confidence_score
)
VALUES ('VCB.VN', '2025-11-18', 87.5, 'v1.0.0', 0.85)
ON CONFLICT (stock_code, prediction_date) DO UPDATE SET
  predicted_price = EXCLUDED.predicted_price,
  model_version = EXCLUDED.model_version,
  confidence_score = EXCLUDED.confidence_score,
  created_at = CURRENT_TIMESTAMP;
```

### Useful queries

**Table sizes**:
```sql
SELECT 
  schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Row counts**:
```sql
SELECT 'dim_stock' as table_name, COUNT(*) FROM dim_stock
UNION ALL
SELECT 'fact_daily_prices', COUNT(*) FROM fact_daily_prices
UNION ALL
SELECT 'fact_news', COUNT(*) FROM fact_news
UNION ALL
SELECT 'fact_predictions', COUNT(*) FROM fact_predictions;
```

**Date range**:
```sql
SELECT 
  MIN(trade_date) as earliest,
  MAX(trade_date) as latest,
  COUNT(DISTINCT stock_code) as total_stocks
FROM fact_daily_prices;
```

### Performance Optimization

**Analyze tables**:
```sql
ANALYZE dim_stock;
ANALYZE fact_daily_prices;
ANALYZE fact_news;
ANALYZE fact_predictions;
```

**Vacuum tables**:
```sql
VACUUM ANALYZE fact_daily_prices;
```

**Create additional indexes** (nếu cần):
```sql
CREATE INDEX idx_prices_close ON fact_daily_prices(close);
CREATE INDEX idx_news_sentiment ON fact_news(sentiment_score);
```

### Troubleshooting

**Connection refused**:
- Check container running: `docker ps | grep warehouse`
- Check port 5433 not in use: `lsof -i :5433`
- Verify network: `docker network ls | grep financi`

**Init script not running**:
- Check first startup logs: `docker logs warehouse-db`
- Manually run: `docker exec -i warehouse-db psql -U warehouse_user -d warehouse < init.sql`

**Slow queries**:
- Run EXPLAIN ANALYZE: `EXPLAIN ANALYZE SELECT ...`
- Check missing indexes
- Consider partitioning large tables

**Disk full**:
- Check space: `docker exec warehouse-db df -h`
- Vacuum full: `VACUUM FULL fact_daily_prices;`
- Archive old data

### Schema Evolution
Khi thêm columns mới:
```sql
ALTER TABLE fact_daily_prices 
ADD COLUMN new_field DOUBLE PRECISION;

CREATE INDEX idx_prices_new_field ON fact_daily_prices(new_field);
```

### Network
- Network: `financi-network` (external)
- Airflow, prediction API, và các services khác connect qua network này

### Dependencies
- TimescaleDB: PostgreSQL extension cho time-series
- PostgreSQL 14
- Persistent volume: `warehouse_data/`

