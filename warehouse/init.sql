-- ============================================
-- SNOWFLAKE SCHEMA - STOCK TRADING WAREHOUSE
-- Single Schema: public_warehouse
-- ============================================

-- DIMENSION TABLE: Stock Symbols
CREATE TABLE dim_stock (
   stock_code TEXT PRIMARY KEY,
   exchange TEXT NOT NULL,
   quote_type INT,
   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
   updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dim_stock_exchange ON dim_stock(exchange);

-- FACT TABLE: Daily Stock Prices
CREATE TABLE fact_daily_prices (
   stock_code TEXT NOT NULL,
   trade_date DATE NOT NULL,
   "open" DOUBLE PRECISION NOT NULL,
   high DOUBLE PRECISION NOT NULL,
   low DOUBLE PRECISION NOT NULL,
   "close" DOUBLE PRECISION NOT NULL,
   volume BIGINT NOT NULL,
   change DOUBLE PRECISION,
   change_percent DOUBLE PRECISION,
   vwap DOUBLE PRECISION,
   market_hours INT,
   PRIMARY KEY (stock_code, trade_date),
   FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);

CREATE INDEX idx_fact_prices_date ON fact_daily_prices(trade_date);
CREATE INDEX idx_fact_prices_stock_date ON fact_daily_prices(stock_code, trade_date);

-- FACT TABLE: Stock News Content
CREATE TABLE fact_news (
   stock_code TEXT NOT NULL,
   news_date DATE NOT NULL,
   content TEXT NOT NULL,
   article_id TEXT NOT NULL,  
   sentiment_score float,
   PRIMARY KEY (stock_code, news_date, article_id),
   FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);

CREATE INDEX idx_fact_news_date ON fact_news(news_date);
CREATE INDEX idx_fact_news_stock_date ON fact_news(stock_code, news_date);

-- FACT TABLE: Price Predictions
CREATE TABLE fact_predictions (
  stock_code TEXT NOT NULL,
  prediction_date DATE NOT NULL,
  predicted_price DOUBLE PRECISION NOT NULL,
  model_version VARCHAR(50),
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (stock_code, prediction_date),
  FOREIGN KEY (stock_code) REFERENCES dim_stock(stock_code)
);

CREATE INDEX idx_predictions_date ON fact_predictions(prediction_date);
CREATE INDEX idx_predictions_stock_date ON fact_predictions(stock_code, prediction_date);

-- ============================================
-- SCHEMA OPTIMIZATION NOTES
-- ============================================
/*
1. ✅ TỪNG CỘT BỊ LOẠI BỎ (removed unnecessary columns):
   - article_id: Thay thế bằng article_id để detect duplicate trong fact_news
   - title, link, is_pdf, pdf_link: Không cần cho training
   - crawled_at: Thay thế bằng created_at (standard)

2. ✅ DIMENSION TABLE (dim_stock):
   - Normalize thông tin stock (exchange, quote_type)
   - Giảm redundancy (tránh lặp lại exchange/quote_type nhiều lần)
   - Support tương lai (thêm thông tin stock khác)

3. ✅ FACT TABLES (3 tables):
   - fact_daily_prices: Giá và volume (training data)
   - fact_news: Nội dung tin tức (training data)
   - fact_predictions: Dự đoán (output model)

4. ✅ INDEXES STRATEGY:
   - PK: (stock_code, date) cho tốc độ query
   - FK: dim_stock để referential integrity
   - Additional indexes trên date để dễ filter theo khoảng thời gian``

5. ✅ MAPPING COLUMNS:
   - stock_code: PK mapping giữa tất cả tables
   - trade_date / news_date / prediction_date: Mapping theo thời gian

6. ✅ TRAINING DATA:
   - fact_daily_prices: open, high, low, close, volume, change, change_percent, vwap
   - fact_news: content
   - fact_predictions: predicted_price (output)
*/