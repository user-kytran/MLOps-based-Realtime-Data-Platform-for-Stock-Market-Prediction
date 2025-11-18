# Web StockAI

## Mục đích
Web application stock trading với real-time data, charts, predictions, và news sentiment analysis. Frontend Next.js kết nối với FastAPI backend qua REST API và WebSocket để stream dữ liệu từ ScyllaDB CDC.

## Cấu trúc
```
web-stockAI/
├── docker-compose.yml         # 3 services: backend, frontend, cloudflared
├── backend/
│   ├── main.py                # FastAPI entry point
│   ├── src/
│   │   ├── api/routers/       # API endpoints
│   │   │   ├── stocks.py      # Stock data, WebSocket, CDC
│   │   │   ├── news.py        # News endpoints
│   │   │   └── auth.py        # Authentication
│   │   └── db.py              # ScyllaDB connection
│   ├── requirements.txt       # FastAPI, cassandra-driver, yfinance
│   └── Dockerfile
├── frontend/
│   ├── app/                   # Next.js 14 App Router
│   │   ├── page.tsx           # Home/Landing page
│   │   ├── dashboard/         # Dashboard overview
│   │   ├── stocks/            # Stock list page
│   │   ├── stock/[symbol]/    # Stock detail page
│   │   ├── analysis/          # Market analysis
│   │   ├── news/              # News page
│   │   └── settings/          # User settings
│   ├── components/
│   │   ├── charts/            # Stock charts (historical, intraday, prediction)
│   │   ├── market/            # Stock table, widgets, top movers
│   │   ├── news/              # News list, filters
│   │   ├── analysis/          # Analysis charts
│   │   ├── ui/                # shadcn/ui components
│   │   └── layout/            # Header, theme provider
│   ├── hooks/                 # Custom React hooks
│   │   ├── useStockData.ts    # Fetch stock data
│   │   ├── useStocksWS.ts     # WebSocket real-time
│   │   ├── usePredictions.ts  # Predictions data
│   │   └── useStockChartData.ts
│   ├── lib/
│   │   ├── api.ts             # API client
│   │   ├── config.ts          # Config (API URLs)
│   │   └── utils.ts           # Utilities
│   ├── types/stock.ts         # TypeScript types
│   ├── package.json           # Next.js, React, Recharts
│   └── Dockerfile
├── QUICK-DEPLOY.md            # Quick deployment guide
└── DEPLOY.md                  # Deployment instructions
```

### Services
- **backend**: FastAPI (port 8005)
- **frontend**: Next.js (port 3005)
- **cloudflared**: Cloudflare tunnel (expose qua internet)

## Chức năng

### Frontend Pages
1. **Dashboard**: Market overview, portfolio summary, alerts
2. **Stocks**: Real-time stock table với WebSocket streaming
3. **Stock Detail**: Charts (intraday, historical, predictions), company info, matched orders
4. **Analysis**: Market summary, sector distribution, top volume, price trends
5. **News**: Market news với sentiment scores, filters
6. **Settings**: User profile, watchlist, notifications

### Backend APIs
**Stocks** (`/stocks/*`):
- `GET /get_reference`: Danh sách stocks
- `GET /historical/{symbol}`: Historical OHLCV data
- `GET /intraday/{symbol}`: Intraday chart data
- `GET /daily_summary/{symbol}`: Daily summary
- `GET /predictions/{symbol}`: Price predictions
- `GET /metrics`: Prometheus metrics (CDC latency)
- `WS /ws/stocks_realtime`: WebSocket stream real-time prices

**News** (`/news/*`):
- `GET /`: News list với filters
- `GET /stats`: News statistics
- `GET /{symbol}`: News theo symbol

### Real-time Features
- **WebSocket Streaming**: Live stock prices từ ScyllaDB CDC
- **CDC Integration**: Scylla CDC printer binary chạy trong backend container
- **Latency Tracking**: Producer timestamp → consumer timestamp
- **Prometheus Metrics**: Export CDC metrics

### Charts
- **Historical Chart**: Candlestick OHLCV với volume
- **Intraday Chart**: Line chart giá trong ngày
- **Prediction Chart**: Future price predictions
- **Analysis Charts**: Market summary, sector distribution, top movers

## Cách sử dụng

### Quick Start
```bash
cd /home/obito/main/web-stockAI
docker compose up -d --build
```

### Truy cập
- **Frontend**: http://localhost:3005
- **Backend API**: http://localhost:8005/docs
- **Prometheus Metrics**: http://localhost:8005/stocks/metrics

### Với Cloudflare Tunnel
Thêm env variable trong docker-compose:
```yaml
environment:
  - API_KEY_CLOUDFLARE=your_token
```

Access qua public URL thay vì localhost.

### Deploy từ máy khác
Xem file `QUICK-DEPLOY.md` để config API URLs:

**Option 1 - Auto detect**:
```bash
cd frontend
bash fix-api-urls.sh
docker compose up -d --build
```

**Option 2 - Manual config**:
```bash
# Tạo .env.local trong frontend/
NEXT_PUBLIC_API_URL=http://192.168.1.100:8005
NEXT_PUBLIC_WS_URL=ws://192.168.1.100:8005
```

### Stop services
```bash
docker compose down
```

### Xem logs
```bash
docker logs -f webstock-frontend
docker logs -f webstock-backend
```

### Development mode
**Backend**:
```bash
cd backend
pip install -r requirements.txt
python main.py
```

**Frontend**:
```bash
cd frontend
npm install
npm run dev
```

## Quy ước

### API URLs
- Auto-detect từ browser hostname (production)
- Environment variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_WS_URL`
- Config file: `frontend/lib/config.ts`

### WebSocket Protocol
- Endpoint: `/ws/stocks_realtime`
- Format: JSON messages với stock updates
- Auto reconnect on disconnect

### Data Sources
- **Real-time**: ScyllaDB CDC → Backend WebSocket → Frontend
- **Historical**: ScyllaDB `stock_prices_agg` table
- **Predictions**: ScyllaDB `fact_predictions` hoặc API
- **News**: ScyllaDB `stock_news` table

### Styling
- Tailwind CSS 4
- shadcn/ui components
- Dark mode support (next-themes)
- Responsive design

### Type Safety
- TypeScript strict mode
- Zod validation
- Type definitions trong `types/stock.ts`

## Ghi chú phát triển

### Thêm page mới
1. Tạo folder trong `frontend/app/`
2. Tạo `page.tsx` với React component
3. Update navigation trong `components/layout/header.tsx`

### Thêm API endpoint mới
1. Thêm route trong `backend/src/api/routers/`
2. Register router trong `router.py`
3. Update API client trong `frontend/lib/api.ts`

### Thêm chart mới
1. Tạo component trong `frontend/components/charts/`
2. Sử dụng Recharts library
3. Fetch data với custom hook trong `hooks/`

### WebSocket debugging
```bash
# Test WebSocket từ CLI
wscat -c ws://localhost:8005/stocks/ws/stocks_realtime

# Hoặc dùng test script
python backend/test_websocket.py
```

### CDC Integration
Backend mount CDC printer binary:
```yaml
volumes:
  - ../scylla-cdc-printer:/cdc-printer:ro
```

Start CDC printer subprocess khi có WebSocket connection:
```python
subprocess.Popen([CDC_PRINTER_PATH, '-k', 'stock_data', ...])
```

### Environment Variables

**Backend**:
```bash
CASSANDRA_HOST=["scylla-node1","scylla-node2","scylla-node3"]
CASSANDRA_PORT=9042
CASSANDRA_KEYSPACE=stock_data
SCHEMA_REGISTRY_URL=http://schema-registry:8081
CDC_PRINTER_PATH=/cdc-printer/target/release/scylla-cdc-printer
```

**Frontend**:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8005
NEXT_PUBLIC_WS_URL=ws://localhost:8005
```

### Troubleshooting

**Frontend không load data**:
- Check API URL trong browser console (F12)
- Verify backend running: `curl http://localhost:8005/stocks/get_reference`
- Check CORS settings trong backend

**WebSocket disconnect**:
- Verify CDC printer binary exists
- Check ScyllaDB connection
- Monitor backend logs cho CDC errors

**Build errors**:
- Clear Next.js cache: `rm -rf frontend/.next`
- Reinstall deps: `cd frontend && npm install`
- Check TypeScript errors: `npm run lint`

**Slow charts**:
- Reduce data points trong query
- Implement data pagination
- Use memoization cho heavy computations

### Performance Tips
- Lazy load components với `React.lazy()`
- Debounce search inputs
- Optimize re-renders với `React.memo()`
- Use server components khi có thể (Next.js 14)
- Cache API responses

### Security Notes
- Enable CORS properly trong production
- Use HTTPS với SSL certificates
- Validate all user inputs
- Sanitize data trước khi render
- Implement rate limiting

### Network
- Network: `financi-network` (external)
- Backend connect: ScyllaDB, Schema Registry
- Frontend connect: Backend API, WebSocket

### Dependencies
**Frontend**:
- Next.js 14, React 18, TypeScript
- Recharts (charts)
- shadcn/ui (UI components)
- Tailwind CSS 4

**Backend**:
- FastAPI, Uvicorn
- cassandra-driver (ScyllaDB)
- yfinance (market data)
- prometheus-client (metrics)

