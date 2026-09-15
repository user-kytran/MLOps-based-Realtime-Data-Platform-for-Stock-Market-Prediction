#!/bin/bash

# ==============================================================
# PostgreSQL/TimescaleDB Warehouse Restore Script
# Container: warehouse-db
# Database : warehouse
# User     : warehouse_user
# ==============================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="$SCRIPT_DIR/backups"
CONTAINER_NAME="warehouse-db"
DB_NAME="warehouse"
DB_USER="warehouse_user"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] $1${NC}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"; exit 1; }

# Xác định file backup cần restore
BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
    # Lấy file mới nhất trong backups/
    BACKUP_FILE=$(ls -t "$BACKUP_BASE_DIR"/warehouse_backup_*.sql.gz 2>/dev/null | head -n 1)
fi

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
    err "Không tìm thấy file backup nào để restore! Vui lòng chỉ định đường dẫn file: ./restore_warehouse.sh <file.sql.gz>"
fi

log "Chuẩn bị restore từ file: $BACKUP_FILE"
warn "CẢNH BÁO: Dữ liệu hiện tại trong schema public của database '$DB_NAME' sẽ được làm mới từ file backup!"

# Kiểm tra container
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    err "Container '$CONTAINER_NAME' không chạy. Hủy restore."
fi

log "Đang giải nén và nạp dữ liệu vào database '$DB_NAME'..."
START_TIME=$(date +%s)

gunzip -c "$BACKUP_FILE" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" > /dev/null

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

log "Restore hoàn tất trong ${DURATION}s."
log "Thống kê dữ liệu sau restore:"
docker exec -it "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "
SELECT table_name, 
       pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size,
       (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, 
         query_to_xml(format('select count(*) as cnt from %I', table_name), false, true, '') as xml_count
  FROM information_schema.tables 
  WHERE table_schema = 'public'
) t
ORDER BY size DESC;
"
