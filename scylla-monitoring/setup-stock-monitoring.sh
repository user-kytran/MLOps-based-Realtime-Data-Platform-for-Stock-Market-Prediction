#!/bin/bash
set -e

echo "Thiết lập Stock & Flink Monitoring..."

mkdir -p prometheus/build

cp prometheus/stock_backend_servers.yml prometheus/build/ 2>/dev/null || true
cp prometheus/stock_producer_servers.yml prometheus/build/ 2>/dev/null || true
cp prometheus/flink_servers.yml prometheus/build/ 2>/dev/null || true

if [ -f prometheus/build/prometheus.yml ]; then
    if ! grep -q "stock_backend" prometheus/build/prometheus.yml; then
        cat >> prometheus/build/prometheus.yml << 'EOF_BACKEND'

- job_name: stock_backend
  honor_labels: false
  scrape_interval: 5s
  metrics_path: /stocks/metrics
  static_configs:
    - targets:
      - webstock-backend:8005
      labels:
        cluster: stock_backend
        dc: local
EOF_BACKEND
        echo "Đã thêm stock_backend job vào Prometheus config"
    fi

    if ! grep -q "stock_producers" prometheus/build/prometheus.yml; then
        cat >> prometheus/build/prometheus.yml << 'EOF_PRODUCERS'

- job_name: stock_producers
  honor_labels: false
  scrape_interval: 5s
  file_sd_configs:
    - files:
      - /etc/scylla.d/prometheus/stock_producer_servers.yml
EOF_PRODUCERS
        echo "Đã thêm stock_producers job vào Prometheus config"
    fi

    if ! grep -q "flink_cluster" prometheus/build/prometheus.yml; then
        cat >> prometheus/build/prometheus.yml << 'EOF_FLINK'

- job_name: flink_cluster
  honor_labels: false
  scrape_interval: 5s
  file_sd_configs:
    - files:
      - /etc/scylla.d/prometheus/flink_servers.yml
EOF_FLINK
        echo "Đã thêm flink_cluster job vào Prometheus config"
    fi
fi

docker compose up -d alertmanager prometheus 2>/dev/null || docker-compose restart prometheus 2>/dev/null || echo "Khởi động lại Prometheus thủ công"

echo "Hoàn tất setup monitoring! Prometheus: http://localhost:9090, Grafana: http://localhost:3000 hoặc http://localhost:1020"
