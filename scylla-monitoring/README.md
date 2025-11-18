# Scylla Monitoring

## Mục đích
Monitoring stack cho ScyllaDB và Stock Backend sử dụng Prometheus + Grafana. Theo dõi performance, latency và CDC metrics từ ScyllaDB cluster và Stock CDC processing.

## Cấu trúc
```
scylla-monitoring/
├── docker-compose.yml               # Prometheus + Grafana setup
├── prometheus/
│   ├── build/prometheus.yml         # Prometheus config
│   ├── scylla_servers.yml           # ScyllaDB targets
│   ├── stock_backend_servers.yml    # Stock backend targets
│   └── prom_rules/                  # Alert rules
├── grafana/
│   ├── build/                       # Dashboards
│   │   ├── ver_5.2/                 # ScyllaDB dashboards v5.2
│   │   └── stock-cdc-latency.json   # Stock CDC monitoring
│   ├── provisioning/                # Auto-provision config
│   └── plugins/                     # Grafana plugins
├── prometheus_data/                 # Persistent data
├── start-all.sh                     # Khởi động monitoring stack
├── restart-with-stock.sh            # Restart với Stock CDC config
├── setup-stock-monitoring.sh        # Setup Stock CDC monitoring
├── test-cdc-latency.sh              # Test CDC monitoring
└── update_dashboard_timezone.py     # Update timezone dashboards
```

## Chức năng

### ScyllaDB Monitoring
- **Overview**: CPU, Memory, Disk, Network
- **Advanced**: Query latency, cache hit rate
- **CQL**: Query stats, prepared statements
- **OS**: System metrics per node
- **Keyspace**: Per-keyspace metrics

### Stock CDC Monitoring
- **CDC Events**: Số lượng CDC events theo symbol
- **CDC Latency**: Thời gian từ producer đến consumer (ms)
- **Active Connections**: WebSocket connections đang active
- **Event Rate**: Events/s theo thời gian

## Cách sử dụng

### Khởi động lần đầu
```bash
./restart-with-stock.sh
```

### Khởi động thủ công
```bash
./start-all.sh \
  -v 5.2 \
  -d prometheus_data \
  -D "--network=financi-network -e TZ=Asia/Ho_Chi_Minh" \
  -s ./prometheus/scylla_servers.yml \
  --auto-restart \
  --no-alertmanager \
  --no-loki \
  --no-renderer
```

### Dừng services
```bash
./kill-all.sh
```

### Test CDC monitoring
```bash
./test-cdc-latency.sh
```

### Truy cập

**Prometheus**: http://localhost:9090
- Query metrics
- Xem targets và health status
- Alert rules

**Grafana**: http://localhost:1020
- User: admin (anonymous)
- Dashboards auto-loaded
- Timezone: Asia/Ho_Chi_Minh

### Dashboards

**ScyllaDB**:
- Scylla Overview (default home)
- Scylla Advanced
- Scylla CQL
- Scylla OS
- Scylla Keyspace

**Stock Backend**:
- Stock CDC Latency Monitoring

## Quy ước

### Timezone
- Tất cả dashboards: Asia/Ho_Chi_Minh
- Prometheus: Asia/Ho_Chi_Minh
- Grafana: Asia/Ho_Chi_Minh

### Scrape Intervals
- ScyllaDB: 5s
- Stock Backend: 5s

### Data Retention
- Prometheus: Default (15 days)
- Data path: `./prometheus_data`

### Network
- Network: `financi-network` (external)
- Prometheus: port 9090
- Grafana: port 1020

### Targets
**ScyllaDB nodes** (`prometheus/scylla_servers.yml`):
```yaml
- targets:
  - scylla-node1:9180
  - scylla-node2:9180
  - scylla-node3:9180
```

**Stock Backend** (`prometheus/stock_backend_servers.yml`):
```yaml
- targets:
  - localhost:8005
```

## Ghi chú phát triển

### Thêm metrics mới
1. Backend expose metrics tại `/stocks/metrics` (Prometheus format)
2. Thêm metric names vào dashboard JSON
3. Restart Grafana hoặc reload dashboard

### Update dashboards
```bash
python3 update_dashboard_timezone.py
```

### Xem metrics từ Backend
```bash
curl http://localhost:8005/stocks/metrics | grep cdc
```

### Query metrics trong Prometheus
```bash
curl 'http://localhost:9090/api/v1/query?query=cdc_latency_ms'
```

### Troubleshooting

**Không có data trong dashboard**:
- Kiểm tra targets: http://localhost:9090/targets
- Verify backend metrics: `curl localhost:8005/stocks/metrics`
- Check CDC consumer: `docker logs webstock-backend | grep CDC`

**CDC metrics = 0**:
- CDC consumer chỉ start khi có WebSocket connection
- Mở frontend: http://localhost:3005
- Hoặc trigger: `curl -N http://localhost:8005/stocks/ws/stocks_realtime`

**Dashboard không load**:
- Check Grafana logs: `docker logs agraf`
- Verify provisioning: `ls grafana/provisioning/dashboards/`
- Reload dashboard: Grafana UI → Dashboards → Browse

**Prometheus không scrape**:
- Check config: `cat prometheus/build/prometheus.yml`
- Verify targets file exists
- Restart: `docker-compose restart prometheus`

### Auto-start behavior
- `restart: unless-stopped` cho Prometheus và Grafana
- Tự động restart khi reboot server
- Stop manual: `./kill-all.sh`

### Grafana features
- Anonymous access enabled (role: Admin)
- Unsigned plugins allowed (scylladb-scylla-datasource)
- GZIP compression enabled
- Auto provisioning datasources và dashboards

### Custom scripts
- `start-all.sh`: Official Scylla monitoring script (904 lines)
- `restart-with-stock.sh`: Wrapper với stock config
- `setup-stock-monitoring.sh`: Thêm stock backend job
- `test-cdc-latency.sh`: Health check toàn bộ pipeline

