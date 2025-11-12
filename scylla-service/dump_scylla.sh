
# Script dump toàn bộ bảng trong keyspace stock_data ra CSV

set -e

TABLES=(
  stock_prices
  stock_prices_agg
  stock_daily_summary
  stock_latest_prices
  stock_news
)


echo "Tạo thư mục export trong container..."
docker exec scylla-node1 mkdir -p /var/lib/scylla/export
docker exec scylla-node1 chmod 777 /var/lib/scylla/export

for tbl in "${TABLES[@]}"; do
  echo "Đang export bảng $tbl ..."
  
  
  if docker exec scylla-node1 cqlsh -e "COPY stock_data.$tbl TO '/var/lib/scylla/export/$tbl.csv' WITH HEADER = true"; then
    echo "Copy file $tbl.csv ra host ..."
    
    
    if docker cp scylla-node1:/var/lib/scylla/export/$tbl.csv "./$tbl.csv"; then
      echo "Hoàn thành: $tbl.csv"
      
      
      docker exec scylla-node1 rm -f /var/lib/scylla/export/$tbl.csv
    else
      echo "Lỗi khi copy file $tbl.csv từ container"
    fi
  else
    echo "Lỗi khi export bảng $tbl"
  fi
  
  echo "---------------------------------------"
done


echo "Dọn dẹp thư mục export trong container..."
docker exec scylla-node1 rm -rf /var/lib/scylla/export

echo "Hoàn tất dump toàn bộ bảng ra CSV trong thư mục hiện tại."
