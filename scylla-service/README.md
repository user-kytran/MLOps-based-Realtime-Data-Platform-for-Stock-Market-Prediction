# ScyllaDB Service

ScyllaDB cluster 3 nodes với CDC enabled và auto-setup script cho stock trading system.

## Tổng quan

Service cung cấp ScyllaDB cluster high-availability với replication factor 3, CDC enabled cho real-time data streaming, và auto-provisioning tables/indexes.

## Kiến trúc

```
ScyllaDB Cluster (RF=3)
├── scylla-node1:9042 (seed node)
├── scylla-node2:9043 (seed node)
├── scylla-node3:9044
└── scylla-setup (one-time setup container)
```

## Cài đặt

### 1. Khởi động cluster

```bash
cd scylla-service
docker compose up -d
```

**Thứ tự startup:**
1. scylla-node1, scylla-node2, scylla-node3 (parallel)
2. Chờ healthcheck pass (cqlsh ready)
3. scylla-setup (tự động chạy setup script)

### 2. Verify cluster status

```bash
# Check nodes
docker exec scylla-node1 nodetool status

# Output:
# UN = Up/Normal, DN = Down/Normal
# UN  192.168.x.x  ?       1024 MB    scylla-node1
# UN  192.168.x.y  ?       1024 MB    scylla-node2
# UN  192.168.x.z  ?       1024 MB    scylla-node3
```

### 3. Verify setup

```bash
# Check keyspace
docker exec scylla-node1 cqlsh -e "DESCRIBE KEYSPACE stock_data;"

# List tables
docker exec scylla-node1 cqlsh -e "USE stock_data; DESCRIBE TABLES;"
```

## Configuration

### Cluster Settings

**Node configuration:**
- `--smp 3`: 3 CPU cores per node
- `--memory 1024M`: 1GB RAM per node
- `--overprovisioned 1`: Allow overprovisioned mode
- `--seeds`: seed nodes cho gossip protocol

**Replication:**
```cql
CREATE KEYSPACE stock_data
WITH REPLICATION = {
    'class': 'NetworkTopologyStrategy',
    'datacenter1': 3
}
```

## Database Schema

### Keyspace: `stock_data`

**Tables:**

#### 1. stock_prices (CDC enabled)

Raw stock prices từ Kafka, CDC enabled cho streaming:

```cql
CREATE TABLE stock_prices (
    symbol text,
    timestamp text,
    price double,
    exchange text,
    quote_type int,
    market_hours int,
    change_percent double,
    day_volume bigint,
    change double,
    last_size bigint,
    price_hint text,
    producer_timestamp bigint,
    PRIMARY KEY (symbol, timestamp)
) WITH CLUSTERING ORDER BY (timestamp DESC)
AND cdc = {'enabled': true, 'ttl': '120'};
```

#### 2. stock_latest_prices (CDC enabled)

Latest price mỗi symbol, CDC cho WebSocket push:

```cql
CREATE TABLE stock_latest_prices (
    symbol text PRIMARY KEY,
    price double,
    timestamp timestamp,
    exchange text,
    ...
    producer_timestamp bigint
) WITH cdc = {'enabled': true, 'ttl': '120'};
```

#### 3. stock_prices_agg

Aggregated OHLCV data (1m, 5m, 1h, 1d intervals):

```cql
CREATE TABLE stock_prices_agg (
    symbol text,
    bucket_date date,
    interval text,
    ts timestamp,
    open double,
    high double,
    low double,
    close double,
    volume bigint,
    vwap double,
    PRIMARY KEY ((symbol, bucket_date, interval), ts)
);
```

#### 4. stock_daily_summary

Daily OHLCV summary mỗi symbol:

```cql
CREATE TABLE stock_daily_summary (
    symbol text,
    trade_date date,
    open double,
    high double,
    low double,
    close double,
    volume bigint,
    change double,
    change_percent double,
    vwap double,
    PRIMARY KEY (symbol, trade_date)
) WITH CLUSTERING ORDER BY (trade_date DESC);
```

#### 5. stock_news

Crawled news với sentiment analysis:

```cql
CREATE TABLE stock_news (
    article_id text,
    stock_code text,
    title text,
    link text,
    date timestamp,
    content text,
    sentiment_score float,
    crawled_at timestamp,
    PRIMARY KEY (stock_code, date, article_id)
) WITH CLUSTERING ORDER BY (date DESC);
```

## CDC Configuration

### CDC Settings

```cql
cdc = {
    'enabled': true,
    'preimage': false,   -- Không lưu giá trị cũ
    'postimage': false,  -- Không lưu giá trị mới (chỉ delta)
    'ttl': '120'         -- CDC logs retain 120 giây
}
```

**Tables với CDC:**
- `stock_prices`: Stream tất cả price updates
- `stock_latest_prices`: Stream latest prices

**CDC Log Location:**
```bash
# CDC streams metadata
docker exec scylla-node1 cqlsh -e "SELECT * FROM system_distributed.cdc_streams_descriptions_v2;"
```

## Sử dụng

### CQL Shell

```bash
# Connect to node1
docker exec -it scylla-node1 cqlsh

# Connect to specific node
docker exec -it scylla-node2 cqlsh -u cassandra -p cassandra
```

### Query Examples

```cql
-- Latest prices của top 10 symbols
USE stock_data;
SELECT symbol, price, timestamp FROM stock_latest_prices LIMIT 10;

-- Daily summary của VCB
SELECT * FROM stock_daily_summary WHERE symbol = 'VCB.VN' LIMIT 30;

-- Minute aggregation của HPG ngày hôm nay
SELECT * FROM stock_prices_agg 
WHERE symbol = 'HPG.VN' 
  AND bucket_date = '2025-11-10' 
  AND interval = '1m';

-- Latest news của FPT
SELECT title, date, sentiment_score 
FROM stock_news 
WHERE stock_code = 'FPT.VN' 
LIMIT 10;
```

## Scripts

### scylla_setup.py

Python script tự động setup cluster:
- Tạo keyspace với replication
- Tạo tất cả tables
- Enable CDC
- Tạo indexes
- Verify setup

```bash
# Manual run (nếu cần)
docker exec scylla-setup python /app/scylla_setup.py
```

### dump_scylla.sh

Export data từ ScyllaDB:

```bash
./dump_scylla.sh
```

## Monitoring

### Cluster Health

```bash
# Node status
docker exec scylla-node1 nodetool status

# Ring topology
docker exec scylla-node1 nodetool ring

# Cluster info
docker exec scylla-node1 nodetool info
```

### Performance Metrics

```bash
# Table stats
docker exec scylla-node1 nodetool tablestats stock_data

# Compaction stats
docker exec scylla-node1 nodetool compactionstats

# Thread pool stats
docker exec scylla-node1 nodetool tpstats
```

### CDC Metrics

```bash
# CDC generations
docker exec scylla-node1 cqlsh -e "SELECT * FROM system_distributed.cdc_streams_descriptions_v2;"

# CDC log size
docker exec scylla-node1 du -sh /var/lib/scylla/data/stock_data/stock_prices_scylla_cdc_log/
```

## Ports

| Node | CQL Port | API Port | Purpose |
|------|----------|----------|---------|
| node1 | 9042 | 9180 | Primary access |
| node2 | 9043 | 9181 | Backup access |
| node3 | 9044 | 9182 | Backup access |

## Backup

### Snapshot

```bash
# Tạo snapshot
docker exec scylla-node1 nodetool snapshot stock_data

# List snapshots
docker exec scylla-node1 nodetool listsnapshots

# Clear snapshot
docker exec scylla-node1 nodetool clearsnapshot stock_data
```

### Export Data

```bash
# Export sang CSV
docker exec scylla-node1 cqlsh -e "COPY stock_data.stock_daily_summary TO '/tmp/daily_summary.csv' WITH HEADER = TRUE;"
```

## Troubleshooting

### Node không start

```bash
# Check logs
docker logs scylla-node1

# Common issues:
# - Port conflicts (9042, 9043, 9044)
# - Memory insufficient (<1GB available)
# - Disk space full
```

### Cluster không form

```bash
# Check gossip
docker exec scylla-node1 nodetool gossipinfo

# Restart cluster
docker compose down
docker compose up -d
```

### CDC không hoạt động

```bash
# Verify CDC enabled
docker exec scylla-node1 cqlsh -e "DESCRIBE TABLE stock_data.stock_prices;"
# Tìm: cdc = {'enabled': true}

# Check CDC logs
docker exec scylla-node1 ls -la /var/lib/scylla/data/stock_data/stock_prices_scylla_cdc_log/
```

### Performance issues

```bash
# Check compaction
docker exec scylla-node1 nodetool compactionstats

# Trigger manual compaction
docker exec scylla-node1 nodetool compact stock_data
```

## Performance Tuning

**Increase memory:**
```yaml
command: --memory 2048M  # 2GB
```

**Increase CPU:**
```yaml
command: --smp 4  # 4 cores
```

**Disable overprovisioned mode (production):**
```yaml
command: --overprovisioned 0
```

## Dependencies

- Docker 20.10+
- Docker Compose v2+
- Network: `financi-network` (external)
- Disk space: Minimum 10GB per node

## License

Proprietary - Stock AI Project

