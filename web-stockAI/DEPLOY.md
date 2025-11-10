# Hướng dẫn Deploy

## Vấn đề hiện tại
Frontend đang hardcode `localhost:8005` → không hoạt động khi truy cập từ máy khác.

## Giải pháp

### 1. Tạo file `.env.local` trong thư mục frontend:

```bash
cd /home/obito/main/web-stockAI/frontend
cat > .env.local << 'ENVEOF'
# Thay <SERVER_IP> bằng IP server thực tế
NEXT_PUBLIC_API_URL=http://<SERVER_IP>:8005
NEXT_PUBLIC_WS_URL=ws://<SERVER_IP>:8005
ENVEOF
```

**Ví dụ**: Nếu server IP là `192.168.1.100`:
```bash
NEXT_PUBLIC_API_URL=http://192.168.1.100:8005
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8005
```

### 2. Set environment variables khi chạy docker compose:

```bash
cd /home/obito/main/web-stockAI

# Thay <SERVER_IP> bằng IP server thực tế
export NEXT_PUBLIC_API_URL=http://<SERVER_IP>:8005
export NEXT_PUBLIC_WS_URL=ws://<SERVER_IP>:8005

# Rebuild và restart
docker compose down
docker compose up -d --build
```

### 3. Kiểm tra:

```bash
# Xem logs
docker logs webstock-frontend
docker logs webstock-backend

# Kiểm tra backend có chạy không
curl http://localhost:8005/stocks/get_reference
```

### 4. Truy cập:

- **Frontend**: `http://<SERVER_IP>:3005`
- **Backend API**: `http://<SERVER_IP>:8005`

## Lưu ý bảo mật

Nếu deploy production, nên:
1. Dùng nginx reverse proxy
2. SSL/TLS certificate
3. Firewall rules
4. Domain name thay vì IP

