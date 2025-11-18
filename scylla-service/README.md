# Scylla Service

## Mục đích
ScyllaDB cluster 3 nodes với CDC enabled để lưu trữ dữ liệu chứng khoán real-time. Bao gồm auto-setup script để tạo keyspace, tables và indexes.

## Cấu trúc
```
scylla-service/
├── docker-compose.yml           # Cluster 3 nodes + setup container
├── scylla_setup.py              # Auto-setup script (keyspace, tables, CDC)
├── Dockerfile.setup             # Image cho setup container
├── requirements.txt             # Python dependencies
├── dump_scylla.sh               # Export data ra CSV
├── inserts_script/              # Scripts insert data vào DB
│   ├── insert_agg_db.py         # Insert aggregated data
│   ├── insert_daily_db.py       # Insert daily summary
│   ├── insert_news_db.py        # Insert news data
│   └── ELT_daily.py             # ETL daily data
└── data/                        # Data files
```

### Nodes
- **scylla-node1**: CQL port 9042, API port 9180 (seed node)
- **scylla-node2**: CQL port 9043, API port 9181 (seed node)
- **scylla-node3**: CQL port 9044, API port 9182
- **scylla-setup**: One-time setup container

## Chức năng

### Database Schema
**Keyspace**: `stock_data` (RF=3, NetworkTopologyStrategy)

**Tables**:
1. **stock_prices** (CDC enabled): Dữ liệu tick raw từ Kafka
   - Primary Key: (symbol, timestamp)
   - CDC TTL: 120s
   
2. **stock_latest_prices** (CDC enabled): Giá mới nhất theo symbol
   - Primary Key: (symbol)
   - CDC TTL: 120s
   
3. **stock_prices_agg**: Dữ liệu OHLCV aggregated (1m, 5m, 1h, 1d)
   - Primary Key: ((symbol, bucket_date, interval), ts)
   
4. **stock_daily_summary**: Tóm tắt theo ngày
   - Primary Key: (symbol, trade_date)
   
5. **stock_news**: News crawled với sentiment score
   - Primary Key: (stock_code, date, article_id)

### CDC Configuration
- Enabled cho: `stock_prices`, `stock_latest_prices`
- Preimage: false
- Postimage: false
- TTL: 120 giây

## Cách sử dụng

### Khởi động cluster
```bash
docker compose up -d
```

Thứ tự:
1. 3 nodes khởi động parallel
2. Healthcheck pass (cqlsh ready)
3. scylla-setup tự động chạy và tạo schema
4. Setup container thoát khi xong

### Kiểm tra cluster
```bash
docker exec scylla-node1 nodetool status
```

### Kết nối CQL
```bash
docker exec -it scylla-node1 cqlsh
```

### Query examples
```cql
USE stock_data;

SELECT * FROM stock_latest_prices LIMIT 10;

SELECT * FROM stock_daily_summary 
WHERE symbol = 'VCB.VN' 
LIMIT 30;

SELECT * FROM stock_prices_agg 
WHERE symbol = 'HPG.VN' 
  AND bucket_date = '2025-11-17' 
  AND interval = '1m';
```

### Export data
```bash
./dump_scylla.sh
```

Export tất cả tables ra CSV files trong thư mục hiện tại.

### Dừng cluster
```bash
docker compose down
```

### Xóa data và restart
```bash
docker compose down -v
docker compose up -d
```

## Quy ước

### Cluster Config
- Replication Factor: 3
- Datacenter: datacenter1
- Memory: 1GB/node
- CPU: 3 cores/node
- Overprovisioned: enabled (development)

### Connection
**Internal (từ containers)**:
```
Contact points: scylla-node1, scylla-node2, scylla-node3
Port: 9042
```

**External (từ host)**:
```
Node 1: localhost:9042
Node 2: localhost:9043
Node 3: localhost:9044
```

### CDC Settings
- CDC chỉ enabled cho real-time streaming tables
- CDC logs tự động cleanup sau 120s
- CDC metadata sync across cluster: 10s

### Network
- Network: `financi-network` (external)
- Phải tạo network trước khi start cluster

## Ghi chú phát triển

### Setup lại schema
```bash
docker compose restart scylla-setup
```

### Thêm table mới
1. Sửa `scylla_setup.py` thêm table definition
2. Restart setup container
3. Hoặc tạo thủ công qua cqlsh

### Monitoring
```bash
docker exec scylla-node1 nodetool status
docker exec scylla-node1 nodetool tablestats stock_data
docker exec scylla-node1 nodetool tpstats
```

### CDC Logs
```bash
docker exec scylla-node1 cqlsh -e \
  "SELECT * FROM system_distributed.cdc_streams_descriptions_v2;"
```

### Performance Tuning
**Tăng memory** (production):
```yaml
command: --memory 2048M
```

**Tăng CPU**:
```yaml
command: --smp 4
```

**Disable overprovisioned** (production):
```yaml
command: --overprovisioned 0
```

### Troubleshooting

**Node không start**:
```bash
docker logs scylla-node1
```

**Cluster không form**:
```bash
docker exec scylla-node1 nodetool gossipinfo
docker compose restart
```

**CDC không hoạt động**:
```bash
docker exec scylla-node1 cqlsh -e \
  "DESCRIBE TABLE stock_data.stock_prices;"
```
Verify: `cdc = {'enabled': true}`

**Setup container failed**:
```bash
docker logs scylla-setup
docker compose up scylla-setup
```

### Backup
```bash
docker exec scylla-node1 nodetool snapshot stock_data

docker exec scylla-node1 nodetool listsnapshots

docker exec scylla-node1 nodetool clearsnapshot stock_data
```

### Requirements
- Docker 20.10+
- Docker Compose v2+
- Network: `financi-network` (phải tạo trước)
- Disk: 10GB/node minimum
- RAM: 1GB/node minimum
