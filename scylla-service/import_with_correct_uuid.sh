#!/bin/bash

# Script import dữ liệu vào đúng UUID hiện tại
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EXTRACT_DIR="$SCRIPT_DIR/extracted_data"
AUTO_YES=false

if [ "${1:-}" = "--yes" ] || [ "${AUTO_YES:-}" = "true" ]; then
    AUTO_YES=true
fi

echo "=== Import Dữ Liệu Vào Đúng UUID Hiện Tại ==="
echo ""

if [ ! -d "$EXTRACT_DIR/stock_data" ]; then
    echo "❌ Chưa extract dữ liệu. Chạy ./extract_and_import_data.sh trước!"
    exit 1
fi

# Map old UUID to new UUID bằng cách so sánh tên table
declare -A UUID_MAP

echo "Đang tìm mapping UUID..."
# Lấy danh sách tables từ ScyllaDB hiện tại
CURRENT_TABLES=$(docker exec scylla-node1 ls /var/lib/scylla/data/stock_data/ | grep -v "scylla_cdc_log" | sort)

for old_dir in $(ls "$EXTRACT_DIR/stock_data" | grep -v "scylla_cdc_log"); do
    # Lấy tên table (phần trước dấu -)
    table_name=$(echo "$old_dir" | sed 's/-[0-9a-f].*$//')
    
    # Tìm folder hiện tại có cùng tên table
    new_dir=$(echo "$CURRENT_TABLES" | grep "^$table_name-" | head -1)
    
    if [ -n "$new_dir" ]; then
        echo "  $table_name: $old_dir -> $new_dir"
        UUID_MAP["$old_dir"]="$new_dir"
    fi
done

echo ""
if [ "$AUTO_YES" != "true" ]; then
    read -p "Tiếp tục import? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
        echo "Hủy bỏ."
        exit 0
    fi
else
    echo "Tự động xác nhận: yes"
fi

# Copy SSTables vào đúng folders
for old_dir in "${!UUID_MAP[@]}"; do
    new_dir="${UUID_MAP[$old_dir]}"
    table_name=$(echo "$old_dir" | sed 's/-[0-9a-f].*$//')
    target_dir="/var/lib/scylla/data/stock_data/$new_dir/upload"

    # Không import trực tiếp SSTable cho bảng index/materialized view.
    if [[ "$table_name" == *_index ]]; then
        echo "=== Skip $table_name (index table) ==="
        echo ""
        continue
    fi
    
    echo "=== Import $table_name ==="
    
    # Copy SSTables (chỉ copy files .db, không copy folder)
    echo "  Copying SSTables..."
    for file in "$EXTRACT_DIR/stock_data/$old_dir"/*.db "$EXTRACT_DIR/stock_data/$old_dir"/*.txt "$EXTRACT_DIR/stock_data/$old_dir"/*.crc32; do
        if [ -f "$file" ]; then
            docker cp "$file" "scylla-node1:$target_dir/"
        fi
    done
    
    # Set ownership
    echo "  Setting ownership..."
    docker exec -u root scylla-node1 chown -R scylla:scylla "/var/lib/scylla/data/stock_data/$new_dir/"
    
    # Refresh table
    echo "  Refreshing..."
    docker exec scylla-node1 nodetool refresh stock_data "$table_name"
    
    echo "  ✓ Done"
    echo ""
done

echo "=== Rebuild secondary indexes ==="
docker exec scylla-node1 cqlsh -e "DROP INDEX IF EXISTS stock_data.stock_prices_exchange_idx;"
docker exec scylla-node1 cqlsh -e "CREATE INDEX IF NOT EXISTS stock_prices_exchange_idx ON stock_data.stock_prices(exchange);"
docker exec scylla-node1 cqlsh -e "DROP INDEX IF EXISTS stock_data.stock_daily_summary_trade_date_idx;"
docker exec scylla-node1 cqlsh -e "CREATE INDEX IF NOT EXISTS stock_daily_summary_trade_date_idx ON stock_data.stock_daily_summary(trade_date);"

echo ""
echo "=== Import Hoàn Tất ==="
echo ""
echo "Kiểm tra dữ liệu:"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT COUNT(*) FROM stock_data.stock_prices;'"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT COUNT(*) FROM stock_data.stock_news;'"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT * FROM stock_data.stock_prices LIMIT 3;'"
