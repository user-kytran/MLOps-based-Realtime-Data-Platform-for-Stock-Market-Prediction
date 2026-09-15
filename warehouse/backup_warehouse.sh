#!/bin/bash

# ==============================================================
# PostgreSQL/TimescaleDB Warehouse Backup Script
# Container: warehouse-db
# Database : warehouse
# User     : warehouse_user
# ==============================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="$SCRIPT_DIR/backups"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="$BACKUP_BASE_DIR/warehouse_backup_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="warehouse-db"
DB_NAME="warehouse"
DB_USER="warehouse_user"
KEEP_LAST=5  # Số bản backup giữ lại

# Màu sắc terminal
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] $1${NC}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"; exit 1; }

mkdir -p "$BACKUP_BASE_DIR"

# 1. Kiểm tra container đang chạy
log "Kiểm tra container '$CONTAINER_NAME'..."
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    err "Container '$CONTAINER_NAME' không chạy. Hủy backup."
fi
log "Container '$CONTAINER_NAME' đang hoạt động."

# 2. Thực hiện pg_dump và nén gzip trực tiếp ra thư mục host
log "Đang trích xuất và nén database '$DB_NAME'..."
START_TIME=$(date +%s)

docker exec -i "$CONTAINER_NAME" pg_dump \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    -n public \
    --clean \
    --if-exists \
    | gzip > "$BACKUP_FILE"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 3. Kiểm tra tính toàn vẹn file nén
log "Kiểm tra tính toàn vẹn của file backup..."
gzip -t "$BACKUP_FILE" || err "File backup bị lỗi nén gzip!"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
log "Đã tạo backup thành công: $BACKUP_FILE (Dung lượng: $BACKUP_SIZE, Thời gian: ${DURATION}s)"

# 4. Tự động dọn dẹp các bản backup cũ (giữ lại $KEEP_LAST bản gần nhất)
log "Dọn dẹp bản backup cũ (chỉ giữ lại $KEEP_LAST bản mới nhất)..."
mapfile -t OLD_BACKUPS < <(
    ls -dt "$BACKUP_BASE_DIR"/warehouse_backup_*.sql.gz 2>/dev/null | tail -n +$((KEEP_LAST + 1))
)
if [ ${#OLD_BACKUPS[@]} -gt 0 ]; then
    for old in "${OLD_BACKUPS[@]}"; do
        warn "  -> Xóa bản cũ: $(basename "$old")"
        python3 -c "import os; os.remove('$old')" 2>/dev/null || true
    done
else
    log "Số lượng bản backup nằm trong giới hạn cho phép ($KEEP_LAST bản)."
fi

log "======================================================"
log "HOÀN TẤT DUMP DATABASE WAREHOUSE!"
log "  File backup: $BACKUP_FILE"
log "  Dung lượng : $BACKUP_SIZE"
log "======================================================"
