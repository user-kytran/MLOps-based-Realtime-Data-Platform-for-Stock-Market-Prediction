#!/bin/bash
set -e

echo "Thiết lập Stock CDC Monitoring..."

cp prometheus/stock_backend_servers.yml prometheus/build/ 2>/dev/null || true

if [ -f prometheus/build/prometheus.yml ]; then
    if ! grep -q "stock_backend" prometheus/build/prometheus.yml; then
        cat >> prometheus/build/prometheus.yml << 'EOF'

- job_name: stock_backend
  honor_labels: false
  scrape_interval: 5s
  file_sd_configs:
    - files:
      - /etc/scylla.d/prometheus/stock_backend_servers.yml
EOF
        echo "Đã thêm stock_backend job vào Prometheus config"
    fi
fi

docker-compose restart prometheus 2>/dev/null || echo "Khởi động lại Prometheus thủ công: docker-compose restart prometheus"

GRAFANA_URL=${GRAFANA_URL:-http://localhost:3000}
GRAFANA_USER=${GRAFANA_USER:-admin}
GRAFANA_PASS=${GRAFANA_PASS:-admin}

curl -X POST \
  -H "Content-Type: application/json" \
  -u ${GRAFANA_USER}:${GRAFANA_PASS} \
  ${GRAFANA_URL}/api/dashboards/db \
  -d @grafana/stock-cdc-latency.json 2>/dev/null && \
  echo "Dashboard đã được import vào Grafana" || \
  echo "Import dashboard thủ công: grafana/stock-cdc-latency.json"

echo "Hoàn tất! Truy cập Grafana tại ${GRAFANA_URL}"

