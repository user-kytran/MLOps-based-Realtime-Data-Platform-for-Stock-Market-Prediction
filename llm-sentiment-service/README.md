# LLM Sentiment Service (g4f)

Dịch vụ phân tích cảm xúc (Sentiment Analysis) tin tức tài chính & chứng khoán Việt Nam sử dụng LLM qua `g4f` (OpenAI-compatible API Gateway).

---

## 1. Cấu trúc thư mục

```text
llm-sentiment-service/
├── docker-compose.yml       # Cấu hình container g4f, port 1337, network 'financi-network'
├── update-g4f.sh            # Script cập nhật image & restart an toàn (hỗ trợ cron)
├── sentiment_analyzer.py    # Python module phân tích sentiment chuẩn JSON [-1.0, 1.0]
├── test_sentiment.py        # Script test nhanh các kịch bản tin tức
├── requirements.txt         # Thư viện Python phụ trợ
├── .env.example             # Mẫu cấu hình môi trường
├── har_and_cookies/         # Volume mount lưu session / cookie (bảo toàn dữ liệu)
└── generated_media/         # Volume mount lưu media tạo ra
```

---

## 2. Hướng dẫn khởi động nhanh

### Bước 1: Khởi chạy container với Docker Compose
```bash
cd llm-sentiment-service
docker compose up -d
```

### Bước 2: Kiểm tra trạng thái container
```bash
docker compose ps
# hoặc kiểm tra API model list
curl http://localhost:1337/v1/models
```

### Bước 3: Chạy thử nghiệm phân tích tin tức
```bash
python3 test_sentiment.py
```

---

## 3. Cơ chế cập nhật tự động (Auto-Update)

Để cập nhật bản `latest-slim` mới nhất khi các provider của g4f thay đổi:

### Cách 1: Chạy bằng tay
```bash
./update-g4f.sh
```

### Cách 2: Thiết lập Cron Job tự động (Ví dụ: Chạy vào 3:00 sáng hàng ngày)
Mở crontab:
```bash
crontab -e
```
Thêm dòng sau:
```cron
0 3 * * * /home/obito/Desktop/main/main/llm-sentiment-service/update-g4f.sh >> /home/obito/Desktop/main/main/llm-sentiment-service/update.log 2>&1
```

---

## 4. Tích hợp vào Pipeline Airflow (`DAGs_newstock.py`)

Do container `g4f-sentiment-api` cùng nằm trong Docker network `financi-network`, Airflow có thể gọi trực tiếp qua hostname nội bộ:

```python
from sentiment_analyzer import StockSentimentAnalyzer

# Trong Airflow DAGs:
analyzer = StockSentimentAnalyzer(
    base_url="http://g4f-sentiment-api:8080/v1",
    model="gpt-4o-mini"
)

result = analyzer.analyze(
    content=article_text,
    stock_code=stock_code,
    title=article_title
)
sentiment_score = result["sentiment_score"] # Float trong khoảng [-1.0, 1.0]
```

