# ScyllaDB CDC Printer

Tool viết bằng Rust để monitor và hiển thị CDC (Change Data Capture) logs từ ScyllaDB real-time.

## Tổng quan

CDC Printer cho phép xem realtime tất cả thay đổi (INSERT/UPDATE/DELETE) trên bất kỳ ScyllaDB table nào có CDC enabled. Tool tính toán latency dựa trên field `producer_timestamp`.

## Tính năng

- ✅ Real-time streaming CDC logs từ ScyllaDB
- ✅ Tính toán latency tự động (producer → consumer)
- ✅ 3 chế độ: Ultra Realtime, Realtime, Balanced
- ✅ Hiển thị chi tiết: timestamp, operation type, batch info, TTL
- ✅ Performance cao với Rust + async tokio

## Cài đặt

### Build từ source

```bash
cd scylla-cdc-printer
cargo build --release
```

Binary sẽ được tạo tại: `target/release/scylla-cdc-printer`

## Sử dụng

### Chế độ Ultra Realtime (độ trễ ~2-3s)

```bash
./run_ultra_realtime.sh [keyspace] [table] [hostname]

# Ví dụ
./run_ultra_realtime.sh stock_data stock_prices localhost
```

**Cấu hình:**
- Window size: 1s
- Safety interval: 0s
- Sleep interval: 0s
- **Use case:** Monitor realtime critical tables

### Chế độ Custom

```bash
./target/release/scylla-cdc-printer \
  -k stock_data \
  -t stock_prices \
  -h localhost \
  --window-size 15 \
  --safety-interval 2 \
  --sleep-interval 0.5
```

## Tham số

| Tham số | Mô tả | Nhỏ | Lớn |
|---------|-------|-----|-----|
| `--window-size` | Kích thước cửa sổ đọc CDC log (giây) | Realtime hơn, tốn tài nguyên | Tiết kiệm, delay cao |
| `--safety-interval` | Khoảng an toàn đảm bảo data replicated (giây) | Realtime, có thể miss data | An toàn, delay cao |
| `--sleep-interval` | Thời gian chờ giữa các lần quét (giây) | Realtime, tốn CPU | Tiết kiệm CPU, delay cao |

## Output Format

```
┌──────────────────────────── Scylla CDC log row ────────────────────────────┐
│ Stream id:: 1990000000000000cb417eb620001c01                                │
│ Timestamp:: 2025-11-10 16:07:02.117917 UTC                                 │
│ Operation type:: PostImage                                                  │
│ Batch seq no:: 1                                                            │
│ End of batch:: true                                                         │
│ TTL:: null                                                                  │
│ ⚡ LATENCY:: 1523 ms                                                        │
├────────────────────────────────────────────────────────────────────────────┤
│ symbol: "VCB.VN"                                                            │
│ price: 95.5                                                                 │
│ timestamp: "2025-11-10T16:07:00.594Z"                                       │
│ change_percent: 1.25                                                        │
│ producer_timestamp: 1699627620594                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

## Latency Calculation

```
LATENCY = Consumer Processing Time - producer_timestamp
```

- `producer_timestamp`: Timestamp khi producer ghi vào Kafka (ms)
- Consumer time: Thời điểm CDC printer nhận được thay đổi
- **Output:** Latency tính bằng milliseconds

## Use Cases

### 1. Debug Data Pipeline

Monitor xem data có flow đúng từ Kafka → Flink → ScyllaDB không:

```bash
./run_ultra_realtime.sh stock_data stock_prices localhost
```

### 2. Verify CDC Latency

Kiểm tra độ trễ từ producer đến database:

```bash
./run_ultra_realtime.sh stock_data stock_latest_prices localhost
# Insert test data
# Xem latency trong output
```

### 3. Monitor Production Tables

```bash
./run_ultra_realtime.sh stock_data stock_daily_summary localhost
```

## Lưu ý

- ⚠️ Tool chỉ hiển thị thay đổi **từ thời điểm bắt đầu** chạy
- ⚠️ Không hiển thị dữ liệu cũ trong database
- ⚠️ Nhấn `Ctrl+C` để dừng
- ⚠️ Nếu không thấy output, insert dữ liệu mới để test
- ⚠️ Latency hiển thị "N/A" nếu không có `producer_timestamp`

## Dependencies

### Rust (Cargo.toml)

- `scylla` 1.3.1
- `scylla-cdc` 0.4.1
- `tokio` 1.1.0 (async runtime)
- `chrono` 0.4.19
- `clap` 4.5.9 (CLI parsing)

## Requirements

- Rust 1.70+
- ScyllaDB với CDC enabled
- Network access đến ScyllaDB nodes

## Performance

- **Memory:** ~50MB
- **CPU:** Minimal (async I/O)
- **Network:** Bandwidth phụ thuộc vào CDC throughput
- **Latency overhead:** <10ms

## Troubleshooting

### Không thấy output

```bash
# Kiểm tra CDC có enabled không
docker exec scylla-node1 cqlsh -e "DESCRIBE TABLE stock_data.stock_prices;"
# Tìm: cdc = {'enabled': true}

# Insert test data
docker exec scylla-node1 cqlsh -e "INSERT INTO stock_data.stock_prices (symbol, timestamp, price) VALUES ('TEST', '123456', 100.0);"
```

### Connection refused

```bash
# Kiểm tra ScyllaDB connectivity
telnet localhost 9042

# Thay đổi hostname
./run_ultra_realtime.sh stock_data stock_prices scylla-node1
```

## License

Proprietary - Stock AI Project

