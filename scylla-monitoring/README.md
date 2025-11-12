# ScyllaDB Monitoring Stack

Prometheus + Grafana monitoring stack cho ScyllaDB cluster và Stock Backend với CDC latency monitoring.

## Tổng quan

Stack monitoring tích hợp sẵn dashboards của ScyllaDB, bổ sung thêm monitoring cho Stock CDC pipeline latency (producer → ScyllaDB → consumer).

## Thành phần

- **Prometheus 3.5.0**: Time-series database
- **Grafana 12.1.0**: Visualization dashboards
- **ScyllaDB Dashboards**: 30+ dashboards monitoring cluster
- **Stock CDC Dashboard**: Latency monitoring custom

## Cài đặt

### 1. Khởi động monitoring stack

```bash
cd scylla-monitoring

./start-all.sh \
  -v 5.2 \
  -d prometheus_data \
  -D "--network=financi-network -e TZ=Asia/Ho_Chi_Minh" \
  -s ./prometheus/scylla_servers.yml \
  -c "TZ=Asia/Ho_Chi_Minh" \
  --auto-restart \
  --no-alertmanager \
  --no-loki \
  --no-renderer
```

**Tham số:**
- `-v 5.2`: ScyllaDB version dashboards
- `-d prometheus_data`: Data persistence directory
- `-D`: Docker options (network, timezone)
- `-s`: ScyllaDB servers config
- `--no-alertmanager`: Disable alerting
- `--no-loki`: Disable log aggregation

### 2. Verify services

```bash
# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:1020/api/health
```

### 3. Access dashboards

- **Grafana**: http://localhost:1020
  - Username: admin / Password: admin (auto-login enabled)
- **Prometheus**: http://localhost:9090

## Cấu hình

### ScyllaDB Targets

File: `prometheus/scylla_servers.yml`

```yaml
- targets:
    - scylla-node1:9180
    - scylla-node2:9180
    - scylla-node3:9180
  labels:
    cluster: scylla-cluster
    dc: datacenter1
```

### Stock Backend Target

File: `prometheus/stock_backend_servers.yml`

```yaml
- targets:
    - webstock-backend:8005
  labels:
    job: stock_backend
    service: api
```

## Dashboards

### ScyllaDB Dashboards (30+)

**Core dashboards:**
- `scylla-overview.5.2.json`: Tổng quan cluster
- `scylla-cql.5.2.json`: CQL metrics
- `scylla-io.5.2.json`: Disk I/O
- `scylla-latency.5.2.json`: Query latency
- `scylla-cache.5.2.json`: Cache hit/miss

**Location:** `grafana/build/ver_5.2/`

### Stock CDC Latency Dashboard

**Metrics monitored:**
- CDC Latency P50/P95/P99
- CDC Events throughput (events/sec)
- Active WebSocket connections
- Latency by symbol
- Event stats by symbol

**Panels:**
1. **CDC Latency Percentiles**: Line chart P50/P95/P99 theo thời gian
2. **CDC Latency by Symbol**: Top symbols có latency cao
3. **Current P95 Latency**: Gauge hiện tại
4. **Active Connections**: WebSocket connections
5. **CDC Events Rate**: Throughput
6. **Stats Table**: Bảng tổng hợp theo symbol

## Prometheus Queries

### CDC Latency P95

```promql
histogram_quantile(0.95, sum(rate(cdc_latency_ms_bucket[1m])) by (le))
```

### CDC Latency P95 by Symbol

```promql
histogram_quantile(0.95, sum(rate(cdc_latency_ms_bucket[1m])) by (le, symbol))
```

### CDC Events Rate

```promql
sum(rate(cdc_events_total[1m]))
```

### Average Latency by Symbol

```promql
sum(rate(cdc_latency_ms_sum[1m])) by (symbol) / sum(rate(cdc_latency_ms_count[1m])) by (symbol)
```

## CDC Metrics Endpoint

**Backend metrics:** http://localhost:8005/stocks/metrics

**Metrics exposed:**
- `cdc_latency_ms`: Histogram (latency distribution)
- `cdc_events_total`: Counter (số events theo symbol)
- `cdc_active_connections`: Gauge (số WebSocket connections)

## Monitoring Flow

```
Producer (t1) → Kafka → Flink → ScyllaDB → CDC → Backend (t2)
   ↓                                                    ↓
producer_timestamp                              time.time()*1000

Latency = t2 - t1 (ms)
```

**Measurement point:** Backend WebSocket handler trước khi broadcast

## Scripts

### restart-with-stock.sh

Restart toàn bộ monitoring stack với stock backend:

```bash
./restart-with-stock.sh
```

### kill-all.sh

Dừng tất cả monitoring containers:

```bash
./kill-all.sh
```

### setup-stock-monitoring.sh

Setup ban đầu cho stock CDC monitoring:

```bash
./setup-stock-monitoring.sh
```

## Ports

| Service | Port | Purpose |
|---------|------|---------|
| Grafana | 1020 | Web UI |
| Prometheus | 9090 | Web UI & API |

## Troubleshooting

### Prometheus không scrape được ScyllaDB

```bash
# Kiểm tra targets
curl http://localhost:9090/targets

# Verify ScyllaDB metrics endpoint
curl http://scylla-node1:9180/metrics
```

### Grafana không hiển thị data

```bash
# Kiểm tra datasource
curl http://localhost:1020/api/datasources

# Test query trực tiếp Prometheus
curl 'http://localhost:9090/api/v1/query?query=up'
```

### CDC metrics không có data

```bash
# Kiểm tra backend metrics
curl http://localhost:8005/stocks/metrics | grep cdc

# Verify WebSocket connection
# Mở frontend để trigger CDC consumer
```

### Dashboard không load

```bash
# Re-provision dashboards
docker restart agraf

# Check logs
docker logs agraf
```

## Disk Space Management

```bash
# Check Prometheus data size
du -sh prometheus_data/

# Retention policy (mặc định: 15 days)
# Thay đổi trong start-all.sh:
--storage.tsdb.retention.time=15d
```

## Performance Tuning

### Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s  # Giảm xuống để realtime hơn
  evaluation_interval: 15s
```

### Grafana

```yaml
# grafana.ini
[server]
enable_gzip: true

[dashboards]
min_refresh_interval: 5s  # Minimum refresh rate
```

## Backup Dashboards

```bash
# Backup tất cả dashboards
curl -H "Authorization: Bearer <API_KEY>" \
  http://localhost:1020/api/search?type=dash-db | \
  jq -r '.[] | .uid' | \
  xargs -I {} curl -H "Authorization: Bearer <API_KEY>" \
    http://localhost:1020/api/dashboards/uid/{} > {}.json
```

## Dependencies

- Docker 20.10+
- Docker Compose v2+
- Network: `financi-network` (external)
- ScyllaDB cluster running
- Stock Backend với Prometheus client

## License

Proprietary - Stock AI Project

