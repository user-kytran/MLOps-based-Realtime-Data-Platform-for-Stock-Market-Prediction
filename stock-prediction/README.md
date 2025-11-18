# Stock Prediction

## Mục đích
API dự đoán giá cổ phiếu sử dụng AI/ML với PyTorch. Generate alpha formulas bằng LLM (Gemini), train models (Transformer/LSTM) trên GPU, và output predictions cho multiple stocks.

## Cấu trúc
```
stock_prediction/
├── api.py                    # FastAPI endpoint
├── docker-compose.yml        # GPU-enabled container + Cloudflare tunnel
├── Dockerfile                # Multi-stage build với CUDA
├── requirements.txt          # PyTorch, TensorFlow, LangChain, FastAPI
├── model/
│   ├── auto_pipeline.py      # Main training pipeline
│   ├── gen_alpha.py          # Generate alpha formulas với LLM
│   ├── models.py             # Transformer, LSTM architectures
│   ├── dataset.py            # PyTorch dataset
│   ├── db_manager.py         # SQLite database manager
│   ├── utils.py              # Helper functions
│   └── validate_alphas.py    # Validate generated alphas
├── alphas/                   # Saved alpha formulas (JSON)
├── batches/                  # Batch input files
├── results/                  # Prediction outputs (JSON)
└── init/
    └── stock_models.db       # SQLite database
```

## Chức năng

### Pipeline
1. **Generate Alpha Formulas**: LLM (Gemini) tạo 5 alpha formulas/stock
2. **Collect Data**: Lấy OHLCV data từ PostgreSQL warehouse
3. **Apply Alphas**: Tính toán alpha indicators
4. **Select Best Alphas**: Chọn top performing alphas
5. **Train Models**: Train Transformer hoặc LSTM với PyTorch
6. **Predict**: Output predictions cho ngày chỉ định
7. **Save Results**: Lưu vào PostgreSQL + JSON files

### Models
- **Transformer**: Multi-head attention với positional encoding
- **LSTM**: Bi-directional LSTM với dropout
- Auto-select model dựa trên data shape và performance

### Features
- Parallel processing: 5 batches chạy đồng thời
- GPU acceleration: CUDA 12.1
- Weights & Biases tracking (optional)
- Google Drive checkpoint sync
- Error handling và retry logic

## Cách sử dụng

### Setup môi trường
Tạo file `.env`:
```bash
GOOGLE_API_KEY=your_gemini_api_key
WANDB_API_KEY=your_wandb_key
POSTGRES_URL=postgresql://user:pass@host:5432/db
symbols=VCB.VN,HPG.VN,FPT.VN,...
ENABLE_WANDB=false
API_KEY_CLOUDFLARE=your_cloudflare_token
```

### Khởi động service
```bash
docker compose up -d
```

### API endpoint
**POST** `http://localhost:8006/stock-prediction`

**Request body**:
```json
{
  "prediction_date": "2025-11-20"
}
```

**Response**:
```json
{
  "status": "success",
  "total_stocks": 200,
  "success_count": 195,
  "failed_count": 5,
  "total_time_seconds": 1234.56,
  "results_file": "results/predictions_20251117.json"
}
```

### Kết quả
File `results/predictions_YYYYMMDD.json`:
```json
[
  {
    "stock_code": "VCB.VN",
    "prediction_date": "2025-11-20",
    "predicted_price": 85.2,
    "confidence": 0.87,
    "model": "transformer"
  }
]
```

### Truy cập API docs
```
http://localhost:8006/docs
```

### Logs
```bash
docker logs -f kytran_prediction_api
```

## Quy ước

### Alpha Formulas
- 5 formulas per stock
- Format: Python expressions với pandas/numpy
- Stored trong `alphas/alpha_formulas_gen_YYYYMMDD.json`

### Batch Processing
- Total stocks chia thành 5 batches
- Mỗi batch chạy song song
- CUDA_VISIBLE_DEVICES=0 cho tất cả processes

### Model Training
- Train/val/test split: 70/15/15
- Max epochs: 100
- Early stopping: patience 10
- Optimizer: AdamW với weight decay
- Loss: MSE

### Data Requirements
- Minimum 60 days historical data
- OHLCV + volume data
- Daily frequency

### Checkpoints
- Saved to Google Drive qua rclone
- Format: `{stock_code}_{model_type}_{timestamp}.pth`
- Auto pull latest checkpoint before training

## Ghi chú phát triển

### Thêm stocks
Update file `.env`:
```bash
symbols=VCB.VN,HPG.VN,NEW.VN
```

### Disable Wandb tracking
```bash
ENABLE_WANDB=false
```

### Thay đổi batch size
Sửa trong `api.py`:
```python
batch_size = len(stock_codes) // 5  # Chia thành 5 batches
```

### Thay đổi model architecture
Sửa trong `model/models.py`:
- `StockTransformer`: Thay đổi `d_model`, `nhead`, `num_layers`
- `StockLSTM`: Thay đổi `hidden_size`, `num_layers`

### Custom alpha generation
Sửa prompt trong `model/utils.py` function `generate_stock_alphas()`

### Debug mode
```bash
docker exec -it kytran_prediction_api bash
python3 model/auto_pipeline.py batches/batch_0_test.json results/test.json false
```

### Performance tuning
**Tăng workers**:
```yaml
CMD ["uvicorn", "api:app", "--workers", "4"]
```

**Multi-GPU**:
```yaml
device_ids: ['0', '1']
```

**Memory**:
```yaml
shm_size: '8gb'
```

### Troubleshooting

**CUDA out of memory**:
- Giảm batch_size trong training
- Giảm số stocks per batch
- Giảm model size (d_model, hidden_size)

**Alpha generation timeout**:
- Check GOOGLE_API_KEY còn quota
- Retry failed stocks: auto retry logic đã có

**No data for stock**:
- Verify PostgreSQL connection
- Check stock có trong warehouse
- Minimum 60 days data required

**Model training failed**:
- Check logs: `docker logs kytran_prediction_api`
- Verify alpha formulas valid Python expressions
- Check data quality (no NaN, inf values)

### Database
**SQLite** (`init/stock_models.db`):
- Lưu training history
- Model metadata
- Performance metrics

**PostgreSQL** (warehouse):
- Source data: OHLCV daily
- Table: stock_daily_summary

### Dependencies
- Python 3.11
- CUDA 12.1
- PyTorch 2.x (cu124)
- TensorFlow
- LangChain + Gemini
- FastAPI + Uvicorn
- Weights & Biases

### Cloudflare Tunnel
Service `cloudflared` expose API ra internet:
- Config: `API_KEY_CLOUDFLARE` trong `.env`
- Access từ public URL thay vì localhost:8006

