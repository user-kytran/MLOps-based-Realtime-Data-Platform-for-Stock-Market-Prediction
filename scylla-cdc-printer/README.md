# Scylla CDC Printer

## Mục đích
Tool Rust để theo dõi và hiển thị thay đổi dữ liệu real-time từ ScyllaDB thông qua CDC (Change Data Capture). Dùng để debug, monitor hoặc kiểm tra data flow từ ScyllaDB.

## Cấu trúc
```
scylla-cdc-printer/
├── src/
│   ├── main.rs              # Entry point, CLI arguments, CDC reader setup
│   └── printer.rs           # Consumer logic, format output
├── Cargo.toml               # Dependencies: scylla, scylla-cdc, tokio
├── run_ultra_realtime.sh    # Script chạy mode ultra low latency
└── target/release/          # Binary sau khi build
```

## Chức năng
- Đọc CDC logs từ bất kỳ table nào trong ScyllaDB
- Hiển thị thông tin chi tiết mỗi thay đổi:
  - Stream ID, timestamp, operation type (INSERT/UPDATE/DELETE)
  - Tất cả columns và values
  - TTL, batch info
  - **Latency**: Thời gian từ producer timestamp đến processing time
- Support các kiểu operation: insert, update, delete, row delete
- Hiển thị deleted elements cho collection types

## Cách sử dụng

### Build
```bash
cargo build --release
```

### Chạy thủ công
```bash
./target/release/scylla-cdc-printer \
  -k <keyspace> \
  -t <table> \
  -h <hostname> \
  --window-size 60 \
  --safety-interval 30 \
  --sleep-interval 10
```

### Chạy mode ultra realtime
```bash
./run_ultra_realtime.sh [keyspace] [table] [hostname]
```

**Ví dụ**:
```bash
./run_ultra_realtime.sh stock_data stock_prices localhost
```

### Tham số

**Required**:
- `-k, --keyspace`: Tên keyspace
- `-t, --table`: Tên table (phải có CDC enabled)
- `-h, --hostname`: Địa chỉ ScyllaDB node

**Optional**:
- `--window-size`: Kích thước cửa sổ thời gian (giây) - default: 60
- `--safety-interval`: Khoảng thời gian an toàn (giây) - default: 30
- `--sleep-interval`: Thời gian sleep giữa các lần đọc (giây) - default: 10

### Ultra Realtime Mode
Script `run_ultra_realtime.sh` sử dụng config tối ưu cho latency thấp nhất:
- `window-size`: 1s
- `safety-interval`: 0s
- `sleep-interval`: 0s

## Quy ước

### CDC Requirements
Table phải được tạo với `WITH cdc = {'enabled': true}`:
```sql
CREATE TABLE stock_data.stock_prices (
    symbol text,
    timestamp text,
    price float,
    PRIMARY KEY (symbol, timestamp)
) WITH cdc = {'enabled': true};
```

### Output Format
Mỗi thay đổi hiển thị dạng box với:
```
┌──────────────────────────── Scylla CDC log row ────────────────────────────┐
│ Stream id: ...                                                              │
│ Timestamp: ...                                                              │
│ Operation type: insert/update/delete/row_delete                             │
│ ⚡ LATENCY: X ms                                                            │
├────────────────────────────────────────────────────────────────────────────┤
│ column_name: value                                                          │
│ ...                                                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Latency Calculation
- Dựa vào column `producer_timestamp` (bigint, milliseconds)
- Latency = processing_time - producer_timestamp
- Hiển thị "N/A" nếu không có producer_timestamp

## Ghi chú phát triển

### Cấu hình latency
- **Low latency** (< 100ms): window-size=1, safety-interval=0, sleep-interval=0
- **Normal** (1-5s): window-size=60, safety-interval=30, sleep-interval=10
- **Low resource**: Tăng sleep-interval để giảm CPU usage

### Async processing
- Sử dụng Tokio runtime
- Graceful shutdown với Ctrl+C signal
- Consumer chạy async, non-blocking

### Performance
- Parallel consumption với multiple streams
- Batch processing support
- Không block write operations vào ScyllaDB

### Troubleshooting
- Nếu không thấy data: Kiểm tra CDC có enabled không
- High latency: Giảm window-size và safety-interval
- High CPU: Tăng sleep-interval
- Missing data: Tăng safety-interval

### Dependencies
- `scylla`: ScyllaDB driver
- `scylla-cdc`: CDC log reader
- `tokio`: Async runtime
- `clap`: CLI argument parsing
- `chrono`: Timestamp formatting

