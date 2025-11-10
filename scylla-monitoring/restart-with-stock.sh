#!/bin/bash
set -e

echo "Khởi động lại Scylla Monitoring với Stock CDC metrics..."

cd /home/obito/main/scylla-monitoring

python3 update_dashboard_timezone.py

./kill-all.sh

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

echo ""
echo "✅ Hoàn tất!"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3000"
echo "Dashboard: Stock Monitoring → Stock CDC Latency Monitoring"
echo ""
echo "Kiểm tra:"
echo "1. Backend metrics: curl http://localhost:8005/metrics | grep cdc"
echo "2. Prometheus targets: http://localhost:9090/targets (tìm 'stock_backend')"
echo "3. Import dashboard: grafana/stock-cdc-latency.json vào Grafana"

