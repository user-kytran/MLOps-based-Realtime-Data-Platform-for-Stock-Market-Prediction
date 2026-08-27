#!/bin/bash

# Script import dữ liệu vào đúng UUID hiện tại
set -e

EXTRACT_DIR="/home/obito/main/scylla-service/extracted_data"

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
read -p "Tiếp tục import? (yes/no): " -r
echo
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Hủy bỏ."
    exit 0
fi

# Copy SSTables vào đúng folders
for old_dir in "${!UUID_MAP[@]}"; do
    new_dir="${UUID_MAP[$old_dir]}"
    table_name=$(echo "$old_dir" | sed 's/-[0-9a-f].*$//')
    
    echo "=== Import $table_name ==="
    
    # Copy SSTables (chỉ copy files .db, không copy folder)
    echo "  Copying SSTables..."
    for file in "$EXTRACT_DIR/stock_data/$old_dir"/*.db "$EXTRACT_DIR/stock_data/$old_dir"/*.txt "$EXTRACT_DIR/stock_data/$old_dir"/*.crc32; do
        if [ -f "$file" ]; then
            docker cp "$file" "scylla-node1:/var/lib/scylla/data/stock_data/$new_dir/"
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

echo ""
echo "=== Import Hoàn Tất ==="
echo ""
echo "Kiểm tra dữ liệu:"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT COUNT(*) FROM stock_data.stock_prices;'"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT COUNT(*) FROM stock_data.stock_news;'"
echo "  docker exec scylla-node1 cqlsh -e 'SELECT * FROM stock_data.stock_prices LIMIT 3;'"
