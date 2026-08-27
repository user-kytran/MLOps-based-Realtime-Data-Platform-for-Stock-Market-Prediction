#!/bin/bash

# ==============================================================
# ScyllaDB Snapshot Backup Script
# Cluster: scylla-node1, scylla-node2, scylla-node3
# ==============================================================

set -e

BACKUP_BASE_DIR="$(dirname "$0")/volume-backups"
SNAPSHOT_TAG="backup_$(date +%Y%m%d_%H%M%S)"
NODES=("scylla-node1" "scylla-node2" "scylla-node3")
KEEP_LAST=5  # Số bản backup giữ lại

# Màu sắc log
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[$(date '+%H:%M:%S')] $1${NC}"; }
warn() { echo -e "${YELLOW}[$(date '+%H:%M:%S')] $1${NC}"; }
err()  { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR: $1${NC}"; exit 1; }

BACKUP_DIR="$BACKUP_BASE_DIR/$SNAPSHOT_TAG"
mkdir -p "$BACKUP_DIR"

# ==============================================================
# 1. Kiểm tra các node đang chạy
# ==============================================================
log "Kiểm tra trạng thái cluster..."
for node in "${NODES[@]}"; do
    if ! docker ps --format '{{.Names}}' | grep -q "^${node}$"; then
        err "Container '$node' không chạy. Hủy backup."
    fi
done
log "Tất cả 3 nodes đang hoạt động."

# ==============================================================
# 2. Tạo snapshot trên tất cả nodes
# ==============================================================
log "Tạo snapshot với tag: $SNAPSHOT_TAG"
for node in "${NODES[@]}"; do
    log "  -> Snapshot $node..."
    docker exec "$node" nodetool snapshot -t "$SNAPSHOT_TAG" \
        || err "Tạo snapshot thất bại trên $node"
done
log "Snapshot hoàn thành trên tất cả nodes."

# ==============================================================
# 3. Copy dữ liệu snapshot ra host
# ==============================================================
log "Copy dữ liệu snapshot ra $BACKUP_DIR..."
for node in "${NODES[@]}"; do
    NODE_BACKUP="$BACKUP_DIR/$node"
    mkdir -p "$NODE_BACKUP"
    log "  -> Copy $node..."

    # Tìm tất cả thư mục snapshot theo tag và copy
    docker exec "$node" bash -c "
        find /var/lib/scylla/data -type d -name '$SNAPSHOT_TAG' 2>/dev/null
    " | while read -r snapshot_path; do
        # Xây dựng đường dẫn tương đối: keyspace/table/snapshots/tag
        rel_path=$(echo "$snapshot_path" | sed 's|/var/lib/scylla/data/||')
        dest="$NODE_BACKUP/$rel_path"
        mkdir -p "$dest"
        docker cp "$node:$snapshot_path/." "$dest/" 2>/dev/null || true
    done

    log "  -> $node: OK"
done

# ==============================================================
# 4. Lưu schema
# ==============================================================
log "Lưu schema CQL..."
docker exec scylla-node1 cqlsh -e "DESCRIBE SCHEMA" > "$BACKUP_DIR/schema.cql" \
    || warn "Không thể lưu schema (cluster có thể chưa có keyspace)."

# ==============================================================
# 5. Xóa snapshot trên cluster sau khi đã copy xong
# ==============================================================
log "Xóa snapshot trên cluster..."
for node in "${NODES[@]}"; do
    docker exec "$node" nodetool clearsnapshot -t "$SNAPSHOT_TAG" \
        || warn "Không xóa được snapshot '$SNAPSHOT_TAG' trên $node"
done
log "Đã xóa snapshot trên cluster."

# ==============================================================
# 6. Dọn dẹp backup cũ (giữ $KEEP_LAST bản gần nhất)
# ==============================================================
log "Dọn backup cũ, giữ lại $KEEP_LAST bản gần nhất..."
mapfile -t OLD_BACKUPS < <(
    ls -dt "$BACKUP_BASE_DIR"/backup_* 2>/dev/null | tail -n +$((KEEP_LAST + 1))
)
if [ ${#OLD_BACKUPS[@]} -gt 0 ]; then
    for old in "${OLD_BACKUPS[@]}"; do
        warn "  Xóa bản cũ: $old"
        rm -rf "$old"
    done
else
    log "Không có backup cũ cần xóa."
fi

# ==============================================================
# 7. Thống kê
# ==============================================================
BACKUP_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "======================================================"
log "Backup hoàn thành!"
log "  Tag       : $SNAPSHOT_TAG"
log "  Thư mục   : $BACKUP_DIR"
log "  Dung lượng: $BACKUP_SIZE"
log "======================================================"
