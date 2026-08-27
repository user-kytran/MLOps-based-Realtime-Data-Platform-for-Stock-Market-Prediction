# Báo cáo Hệ thống Stock Trading Real-time với AI Prediction

## 1. Giới thiệu chung
Hệ thống phân tích và dự đoán chứng khoán real-time được xây dựng dựa trên kiến trúc streaming hiện đại, kết hợp giữa Apache Flink, ScyllaDB CDC và các mô hình Machine Learning (Transformer/LSTM). Hệ thống được thiết kế để xử lý dữ liệu thị trường Việt Nam (300+ mã chứng khoán) với độ trễ thấp (< 100ms) và khả năng chịu tải cao (10K+ events/s).

## 2. Kiến trúc hệ thống
Hệ thống tuân theo kiến trúc Event-Driven Microservices:
- **Data Ingestion**: Kafka cluster (KRaft mode) nhận dữ liệu từ các WebSocket producers.
- **Stream Processing**: Apache Flink xử lý, làm sạch và tổng hợp dữ liệu real-time.
- **Storage**: ScyllaDB (NoSQL) cho hot data và PostgreSQL (TimescaleDB) cho historical data/warehouse.
- **Serving**: FastAPI backend và Next.js frontend cung cấp dashboard real-time qua WebSocket.
- **AI/ML**: Pipeline training và prediction sử dụng PyTorch, được lập lịch bởi Apache Airflow.

## 3. Các thành phần chính
1. **Stock WebSocket Service**: Thu thập dữ liệu từ Yahoo Finance.
2. **Kafka Service**: Message broker trung tâm.
3. **Flink Service**: Xử lý luồng dữ liệu.
4. **ScyllaDB Service**: Lưu trữ phân tán hiệu năng cao.
5. **Scylla CDC Printer**: Streaming dữ liệu thay đổi (CDC).
6. **Warehouse**: Kho dữ liệu cho phân tích và huấn luyện AI.
7. **Task Daily Service**: Orchestration với Airflow.
8. **Stock Prediction**: Service dự đoán giá sử dụng AI.
9. **Web StockAI**: Giao diện người dùng.
10. **Monitoring**: Prometheus và Grafana.

## 4. Triển khai và Vận hành

...

### 4.4. Tối ưu hóa và Tuning

...

#### 4.4.5. Tối ưu hiệu suất hệ thống

Để đảm bảo hệ thống hoạt động ổn định với độ trễ thấp (< 100ms) và throughput cao, các chiến lược tối ưu hóa đa lớp đã được áp dụng trên toàn bộ stack công nghệ:

**1. Tối ưu hóa Kafka (Message Broker)**
*   **Partitioning**: Topic `yfinance` được cấu hình với **12 partitions** (có thể mở rộng lên 24) để tăng khả năng xử lý song song (parallelism) cho consumers.
*   **Throughput Tuning**:
    *   Sử dụng `batch.size` lớn (16384 bytes) và `linger.ms` (100ms) để gom nhóm message, giảm số lượng request network và tăng throughput tổng thể.
    *   Chạy song song **3 producers**, mỗi producer phụ trách khoảng 100 mã chứng khoán để phân tải nguồn vào.
*   **Reliability**: Cấu hình `acks=all` và `replication_factor=3` để đảm bảo không mất dữ liệu (zero data loss) dù có node failure.

**2. Tối ưu hóa ScyllaDB (Storage Layer)**
*   **Change Data Capture (CDC)**:
    *   Chỉ kích hoạt CDC trên các bảng cần streaming real-time (`stock_prices`, `stock_latest_prices`) để tiết kiệm tài nguyên I/O.
    *   Thiết lập **TTL cho CDC logs là 120s**, giúp tự động dọn dẹp dữ liệu cũ, ngăn chặn việc phình to dung lượng đĩa.
*   **Resource Tuning (Production)**:
    *   Cấu hình `--smp 4` (sử dụng 4 CPU cores) và `--memory 2048M` (2GB RAM) cho mỗi node để tối ưu hóa hiệu năng xử lý.
    *   Vô hiệu hóa `overprovisioned` mode trong môi trường production để ScyllaDB có thể tận dụng tối đa tài nguyên phần cứng dành riêng.
*   **Async Processing**: Sử dụng driver hỗ trợ asynchronous writes từ Flink và Backend để không block luồng xử lý chính.

**3. Tối ưu hóa Stream Processing (Flink & CDC Printer)**
*   **Flink Parallelism**: Job được cấu hình với **parallelism = 12**, tương ứng với số partitions của Kafka topic, đảm bảo mỗi partition được xử lý bởi một thread riêng biệt.
*   **Ultra Low Latency Mode (CDC Printer)**:
    *   Sử dụng Rust để đạt hiệu năng native.
    *   Cấu hình `window-size=1s`, `safety-interval=0s`, và `sleep-interval=0s` để giảm độ trễ xử lý xuống mức thấp nhất có thể (gần như tức thời).
*   **State Backend**: Sử dụng Flink State hiệu quả để thực hiện các phép tính tổng hợp (aggregation) theo thời gian thực mà không cần truy vấn lại database.

**4. Tối ưu hóa Backend & Frontend**
*   **Backend (FastAPI)**:
    *   Triển khai với **4 workers** (uvicorn) để tận dụng multi-core CPU.
    *   Sử dụng `async/await` cho toàn bộ các tác vụ I/O (database queries, external API calls) để tránh blocking.
*   **Frontend (Next.js)**:
    *   Sử dụng **Server Components** để giảm tải JavaScript bundle gửi xuống client.
    *   Áp dụng `React.memo` và `React.lazy` để tối ưu hóa rendering và load time.
    *   Sử dụng WebSocket để nhận dữ liệu push từ server thay vì polling liên tục, giảm tải cho server và network.

**5. Tối ưu hóa AI/ML Pipeline**
*   **GPU Acceleration**: Tận dụng **CUDA 12.1** để tăng tốc độ huấn luyện mô hình Transformer và LSTM.
*   **Parallel Training**: Chia dữ liệu thành **5 batches** và chạy training song song, rút ngắn thời gian huấn luyện tổng thể cho 300+ mã chứng khoán.
*   **Shared Memory**: Cấu hình `shm_size: 8gb` cho container để đảm bảo đủ bộ nhớ chia sẻ cho các tác vụ multiprocessing nặng.

**6. Database Warehouse (PostgreSQL/TimescaleDB)**
*   **Partitioning**: Sử dụng TimescaleDB hypertables để partition dữ liệu theo thời gian, tăng tốc độ truy vấn cho các time-series queries.
*   **Indexing**: Tạo index trên các cột hay được filter (`stock_code`, `trade_date`, `sentiment_score`) để giảm thời gian scan bảng.
