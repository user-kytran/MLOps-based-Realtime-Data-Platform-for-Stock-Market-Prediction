#!/usr/bin/env bash
# ==============================================================================
# Script tự động cập nhật image g4f và khởi động lại container an toàn
# Hỗ trợ chạy thủ công hoặc chạy qua Cron Job / Systemd Timer
# ==============================================================================

set -eo pipefail

# Lấy đường dẫn thư mục hiện tại của script (chuẩn tuyệt đối)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

IMAGE="hlohaus789/g4f:latest-slim"
LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"

echo "${LOG_PREFIX} [INFO] Bắt đầu kiểm tra cập nhật cho ${IMAGE}..."

# Tạo các thư mục volume nếu chưa tồn tại
mkdir -p "${SCRIPT_DIR}/har_and_cookies"
mkdir -p "${SCRIPT_DIR}/generated_media"

# Đảm bảo external network tồn tại
if ! docker network inspect financi-network >/dev/null 2>&1; then
    echo "${LOG_PREFIX} [WARN] Network 'financi-network' chưa tồn tại. Đang tạo..."
    docker network create financi-network
fi

# Kéo image mới nhất
echo "${LOG_PREFIX} [INFO] Đang pull image mới..."
docker pull "${IMAGE}"

# Triển khai cập nhật qua Docker Compose
echo "${LOG_PREFIX} [INFO] Đang restart container với image mới nhất..."
docker compose up -d --remove-orphans

echo "${LOG_PREFIX} [SUCCESS] Cập nhật g4f LLM Service hoàn tất!"

