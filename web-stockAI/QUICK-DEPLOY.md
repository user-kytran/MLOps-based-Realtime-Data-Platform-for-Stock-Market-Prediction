# 🚀 Hướng dẫn Deploy Nhanh

## ✅ Đã làm gì

1. ✅ Tạo `lib/config.ts` với **auto-detect API URL** từ browser
2. ✅ Update 3 files quan trọng nhất:
   - `hooks/useStockData.ts`
   - `components/charts/stock-chart.tsx`
   - `components/charts/historical-chart.tsx`
3. ✅ Update `docker-compose.yml` để hỗ trợ env variables

## 🎯 Cách Deploy

### Option 1: Tự động (Khuyến nghị)

**Bước 1**: Run script để fix các file còn lại:
```bash
cd /home/obito/main/web-stockAI/frontend
bash fix-api-urls.sh
```

**Bước 2**: Rebuild và restart:
```bash
cd /home/obito/main/web-stockAI
docker compose down
docker compose up -d --build
```

**Bước 3**: Kiểm tra IP server của bạn:
```bash
hostname -I
# Ví dụ output: 192.168.1.100
```

**Bước 4**: Truy cập từ máy khác:
```
http://<SERVER_IP>:3005
```

### Option 2: Set Environment Variable (Tùy chỉnh)

Nếu muốn config cụ thể:

**Bước 1**: Tạo file `.env` trong thư mục `web-stockAI`:
```bash
cd /home/obito/main/web-stockAI
cat > .env << 'ENVEOF'
NEXT_PUBLIC_API_URL=http://192.168.1.100:8005
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8005
ENVEOF
```
*(Thay `192.168.1.100` bằng IP server thực tế)*

**Bước 2**: Rebuild:
```bash
docker compose down
docker compose up -d --build
```

## 🔍 Kiểm tra

### Backend:
```bash
curl http://localhost:8005/stocks/get_reference
# Hoặc từ máy khác:
curl http://<SERVER_IP>:8005/stocks/get_reference
```

### Logs:
```bash
docker logs webstock-frontend --tail 50
docker logs webstock-backend --tail 50
```

## 🌐 Truy cập

- **Frontend**: `http://<SERVER_IP>:3005`
- **Backend API**: `http://<SERVER_IP>:8005/docs`

## 🛠️ Troubleshooting

### Vấn đề: Vẫn không thấy dữ liệu

**Kiểm tra**:
```bash
# 1. Backend có chạy không?
docker ps | grep webstock

# 2. Backend có data không?
curl http://localhost:8005/stocks/get_reference

# 3. Firewall có block port không?
sudo ufw status
sudo ufw allow 8005
sudo ufw allow 3005

# 4. Xem logs
docker logs webstock-backend --tail 100
```

### Vấn đề: WebSocket không connect

Kiểm tra browser console (F12) xem có lỗi gì.

**Fix**: Đảm bảo firewall allow port 8005:
```bash
sudo ufw allow 8005/tcp
```

## 📝 Lưu ý

- ✅ **Auto-detect hoạt động**: Frontend tự động detect URL từ browser hostname
- ✅ **Local vẫn work**: `localhost` vẫn dùng như cũ
- ✅ **Production ready**: Chỉ cần thay đổi env variable

## 🔒 Bảo mật (Production)

Nếu deploy thật, nên:
1. Dùng **nginx reverse proxy**
2. Setup **SSL/TLS** (Let's Encrypt)
3. Đổi ports mặc định
4. Enable **CORS** đúng cách
5. Firewall rules chặt chẽ

