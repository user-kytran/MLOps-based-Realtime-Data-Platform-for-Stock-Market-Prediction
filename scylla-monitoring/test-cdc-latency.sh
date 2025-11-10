#!/bin/bash

echo "🔍 KIỂM TRA CDC LATENCY MONITORING"
echo "=================================="
echo

echo "1️⃣ Kiểm tra Backend..."
if docker ps | grep -q webstock-backend; then
    echo "   ✅ Backend đang chạy"
else
    echo "   ❌ Backend không chạy"
    exit 1
fi

echo
echo "2️⃣ Kiểm tra CDC Printer Binary..."
if docker exec webstock-backend test -f /cdc-printer/target/release/scylla-cdc-printer; then
    echo "   ✅ CDC printer binary có trong container"
else
    echo "   ❌ CDC printer binary không tìm thấy"
    exit 1
fi

echo
echo "3️⃣ Kiểm tra Scylla connection..."
if docker exec webstock-backend timeout 5 bash -c "echo > /dev/tcp/scylla-node1/9042" 2>/dev/null; then
    echo "   ✅ Kết nối được Scylla"
else
    echo "   ❌ Không kết nối được Scylla"
    exit 1
fi

echo
echo "4️⃣ Kiểm tra Prometheus..."
if curl -s http://localhost:9090/api/v1/query?query=up 2>/dev/null | grep -q success; then
    echo "   ✅ Prometheus đang hoạt động"
else
    echo "   ❌ Prometheus không hoạt động"
fi

echo
echo "5️⃣ Kiểm tra Grafana Dashboard..."
if curl -s http://localhost:3000/api/dashboards/uid/stock-cdc-latency -u admin:admin 2>/dev/null | grep -q "Stock CDC Latency"; then
    echo "   ✅ Dashboard tồn tại"
    echo "   📊 URL: http://localhost:3000/d/stock-cdc-latency"
else
    echo "   ❌ Dashboard không tìm thấy"
fi

echo
echo "6️⃣ Kiểm tra Metrics hiện tại..."
EVENT_COUNT=$(curl -s http://localhost:8005/stocks/metrics 2>/dev/null | grep -c "cdc_events_total{")
if [ "$EVENT_COUNT" -gt 0 ]; then
    echo "   ✅ Có $EVENT_COUNT symbols đang có metrics"
else
    echo "   ⚠️  Chưa có metrics (CDC consumer chưa start)"
fi

echo
echo "7️⃣ Kiểm tra CDC Consumer..."
if docker logs webstock-backend 2>&1 | grep -q "CDC process started"; then
    echo "   ✅ CDC consumer đã start"
else
    echo "   ⚠️  CDC consumer chưa start"
    echo "   💡 Cần mở WebSocket connection để trigger CDC consumer"
    echo "   📱 Mở frontend: http://localhost:3005"
fi

echo
echo "=================================="
echo "✅ SETUP HOÀN TẤT!"
echo
echo "📝 Hướng dẫn sử dụng:"
echo "   1. Mở frontend: http://localhost:3005"
echo "   2. WebSocket sẽ tự động kết nối"
echo "   3. CDC consumer sẽ start và stream data"
echo "   4. Xem dashboard: http://localhost:3000/d/stock-cdc-latency"
echo "      (User: admin, Pass: admin)"

