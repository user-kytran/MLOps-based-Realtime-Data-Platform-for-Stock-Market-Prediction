# Web StockAI - Real-time Stock Trading Platform

Full-stack web application: FastAPI backend + Next.js frontend với real-time WebSocket streaming và CDC monitoring.

## Tổng quan

**Features:**
- ✅ Real-time stock prices qua WebSocket
- ✅ Historical charts (OHLCV) multiple timeframes
- ✅ CDC latency monitoring với Prometheus
- ✅ Production-ready với Cloudflare Tunnel

## Kiến trúc

```
Frontend (Next.js 14)
      ↓ HTTP/WS
Backend (FastAPI)
      ↓
ScyllaDB (CDC)
```

**Components:**
- **Backend:** FastAPI + WebSocket server (port 8005)
- **Frontend:** Next.js 14 + React 18 (port 3005)
- **Cloudflared:** Tunnel cho production

## Cài đặt

### Khởi động services

```bash
cd web-stockAI
docker compose up -d
```

### Verify

```bash
# Backend health
curl http://localhost:8005/stocks/get_reference

# Frontend
curl http://localhost:3005
```

### Access

**Local:**
- Frontend: http://localhost:3005
- Backend API: http://localhost:8005/docs
- Metrics: http://localhost:8005/stocks/metrics

**Production:**
- https://api.kytran.io.vn

## API Endpoints

### REST API

#### GET /stocks/get_reference

Latest prices tất cả symbols:

```bash
curl http://localhost:8005/stocks/get_reference
```

#### GET /stocks/daily_prices

Daily OHLCV summary:

```bash
curl http://localhost:8005/stocks/daily_prices?symbol=VCB.VN
```

#### GET /stocks/aggregated

Historical data với timeframes:

```bash
curl "http://localhost:8005/stocks/aggregated?symbol=VCB.VN&interval=1m&limit=100"
```

**Params:**
- `symbol`: Stock code (VCB.VN, HPG.VN, ...)
- `interval`: 1m, 5m, 1h, 1d
- `limit`: Number of records

#### GET /stocks/metrics

Prometheus metrics:

```bash
curl http://localhost:8005/stocks/metrics
```

**Metrics:**
- `cdc_latency_ms`: CDC latency histogram
- `cdc_events_total`: Events counter
- `cdc_active_connections`: Active WebSocket connections

### WebSocket API

#### WS /stocks/ws/stocks_realtime

Real-time updates via CDC:

```javascript
const ws = new WebSocket('ws://localhost:8005/stocks/ws/stocks_realtime');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // {symbol: "VCB.VN", price: 95.5, change_percent: 1.2, ...}
};
```

## Configuration

### Backend Environment

```yaml
CASSANDRA_HOST: ["scylla-node1","scylla-node2","scylla-node3"]
CASSANDRA_PORT: 9042
CASSANDRA_KEYSPACE: stock_data
SCHEMA_REGISTRY_URL: http://schema-registry:8081
```

### Frontend Environment

```yaml
NEXT_PUBLIC_API_URL: https://api.kytran.io.vn
NEXT_PUBLIC_WS_URL: https://api.kytran.io.vn
```

**Auto-detect:** Frontend tự động detect hostname từ browser.

## Development

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn src:app --host 0.0.0.0 --port 8005 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Deployment

### Quick Deploy (LAN)

**Bước 1:** Lấy server IP:
```bash
hostname -I
# Output: 192.168.1.100
```

**Bước 2:** Set environment:
```bash
cd web-stockAI

# Create .env.local
cat > frontend/.env.local << EOF
NEXT_PUBLIC_API_URL=http://192.168.1.100:8005
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8005
EOF
```

**Bước 3:** Deploy:
```bash
docker compose down
docker compose up -d --build
```

**Bước 4:** Access từ máy khác:
```
http://192.168.1.100:3005
```

### Production Deploy

**Cloudflare Tunnel** đã configured trong docker-compose.yml:

```yaml
cloudflared:
  command: tunnel --no-autoupdate run --token <YOUR_TOKEN>
```

**Access:** https://api.kytran.io.vn

## Monitoring

### Logs

```bash
docker logs -f webstock-backend
docker logs -f webstock-frontend
docker logs -f webstock-cloudflared
```

### Metrics

```bash
# CDC latency
curl http://localhost:8005/stocks/metrics | grep cdc_latency

# WebSocket connections
curl http://localhost:8005/stocks/metrics | grep cdc_active_connections

# Container stats
docker stats webstock-backend webstock-frontend
```

## Troubleshooting

### Backend không start

```bash
# Check logs
docker logs webstock-backend

# Test ScyllaDB connection
docker exec webstock-backend python -c "from cassandra.cluster import Cluster; Cluster(['scylla-node1']).connect()"
```

### Frontend không hiển thị data

```bash
# Check API
curl http://localhost:8005/stocks/get_reference

# Verify env variables
docker exec webstock-frontend env | grep NEXT_PUBLIC

# Check browser console (F12)
```

### WebSocket không connect

```bash
# Test WebSocket
python backend/test_websocket.py

# Check firewall
sudo ufw allow 8005/tcp

# Browser DevTools → Network → WS
```

### CORS errors

```python
# src/__init__.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://yourdomain.com"],  # Specific domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Frontend Pages

- `/`: Dashboard chính với latest prices table
- `/chart/[symbol]`: Detailed chart với multiple timeframes

**Key components:**
- `components/charts/stock-chart.tsx`: Real-time chart
- `components/charts/historical-chart.tsx`: Historical OHLCV
- `hooks/useStockData.ts`: WebSocket hook

## Tech Stack

### Backend
- FastAPI + Uvicorn
- cassandra-driver
- confluent-kafka
- prometheus-client
- WebSockets

### Frontend
- Next.js 14
- React 18 + TypeScript
- Recharts (charts)
- shadcn/ui (components)
- Tailwind CSS 4
- Axios

## Security

### Production Checklist

- [ ] CORS `allow_origins` specific domains
- [ ] Rate limiting
- [ ] Firewall rules
- [ ] SSL/TLS (Cloudflare auto)
- [ ] Environment variables secure
- [ ] API authentication

### Firewall

```bash
sudo ufw allow 8005/tcp
sudo ufw allow 3005/tcp
sudo ufw enable
```

## Performance

**Backend:**
- Response time: <50ms
- WebSocket latency: <100ms
- Throughput: ~1000 req/s

**Frontend:**
- First load: ~2s
- Bundle size: ~500KB gzipped

## Ports

| Service | External | Internal | Purpose |
|---------|----------|----------|---------|
| Backend | 8005 | 8005 | API & WebSocket |
| Frontend | 3005 | 3000 | Next.js app |

## Dependencies

- Docker 20.10+
- Docker Compose v2+
- Network: `financi-network` (external)
- ScyllaDB cluster
- Schema Registry

## License

Proprietary - Stock AI Project
