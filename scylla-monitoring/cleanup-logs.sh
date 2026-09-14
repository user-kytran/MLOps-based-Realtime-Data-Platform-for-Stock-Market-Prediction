#!/bin/bash
set -e

echo "[Auto-Cleanup] Bat dau don dep log va du lieu he thong Monitoring..."

# 1. Don dep cac file txt dump cu cua scylla-monitoring
MON_DIR="$(dirname "$0")"
find "$MON_DIR/prometheus_data" -maxdepth 1 -name "scylla.*.txt" -mtime +7 -delete 2>/dev/null || true

# 2. Xoa Docker dangling images va build cache
echo "[Auto-Cleanup] Don dep Docker cache va dangling images..."
docker image prune -f >/dev/null 2>&1 || true
docker builder prune -f --keep-storage 2GB >/dev/null 2>&1 || true

# 3. Gioi han dung luong log cua cac container monitoring neu vuot qua 100MB
echo "[Auto-Cleanup] Kiem tra va cat gon log container monitoring..."
for cname in aprom agraf aalert host-hardware-exporter; do
    logpath=$(docker inspect --format='{{.LogPath}}' "$cname" 2>/dev/null || true)
    if [ -n "$logpath" ] && [ -f "$logpath" ]; then
        logsize=$(stat -c%s "$logpath" 2>/dev/null || stat -f%z "$logpath" 2>/dev/null || echo 0)
        # Neu file log > 100MB (104857600 bytes), cat gon chi giu lai 5MB gan nhat
        if [ "$logsize" -gt 104857600 ]; then
            echo " - Log $cname ($((logsize / 1024 / 1024))MB) vuot qua 100MB. Dang truncate..."
            tail -c 5242880 "$logpath" > "$logpath.tmp" && mv "$logpath.tmp" "$logpath"
        fi
    fi
done

# 4. Don dep journald log cua OS neu co quyen
if command -v journalctl >/dev/null 2>&1; then
    sudo journalctl --vacuum-size=200M >/dev/null 2>&1 || true
fi

echo "[Auto-Cleanup] Hoan tat don dep log va toi uu dung luong."
