# Stock WebSocket Service

Producer service streaming real-time stock prices từ Yahoo Finance WebSocket vào Kafka với Avro schema.

## Tổng quan

Service subscribe vào Yahoo Finance WebSocket API để nhận real-time stock prices của ~280 mã chứng khoán VN, sau đó stream vào Kafka topic với Avro serialization và Schema Registry.

## Kiến trúc

```
Yahoo Finance WebSocket API
        ↓
  stock_producer.py (3 instances)
        ↓
  Kafka Topic: yfinance
        ↓
  Avro Schema Registry
        ↓
  Consumers (Flink, Backend)
```

## Features

- ✅ Real-time WebSocket connection đến Yahoo Finance
- ✅ Auto-reconnect khi connection drop
- ✅ Avro serialization với Schema Registry
- ✅ 3 producer instances (load balancing ~100 symbols mỗi instance)
- ✅ Producer timestamp tracking cho latency measurement
- ✅ Graceful shutdown (SIGTERM/SIGINT handling)

## Cài đặt

### 1. Khởi động producers

```bash
cd stock-websocket-service
docker compose up -d
```

**3 instances:**
- `stock-producer-1`: Symbols AAA → GIL (~100 mã)
- `stock-producer-2`: Symbols GMD → PTL (~100 mã)
- `stock-producer-3`: Symbols PVD → YEG (~80 mã)

### 2. Verify producers

```bash
# Check logs
docker logs stock-producer-1
docker logs stock-producer-2
docker logs stock-producer-3

# Output:
# Đang kết nối WebSocket cho 100 symbols...
# Subscribe thành công
```

### 3. Verify Kafka messages

```bash
# Console consumer
docker exec broker-1 /opt/kafka/bin/kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic yfinance --from-beginning
```

## Configuration

### Producer Settings

```python
SerializingProducer({
    'bootstrap.servers': 'broker-1:19092,broker-2:19092,broker-3:19092',
    'acks': 'all',           # Wait for all replicas
    'retries': 3,            # Retry on failure
    'key.serializer': StringSerializer,
    'value.serializer': AvroSerializer
})
```

### Kafka Topic

- **Name:** `yfinance`
- **Partitions:** 12
- **Replication Factor:** 3
- **Format:** Avro với Schema Registry

## Avro Schema

```json
{
  "namespace": "finance.avro",
  "type": "record",
  "name": "stock",
  "fields": [
    {"name": "symbol", "type": "string"},
    {"name": "price", "type": "float"},
    {"name": "timestamp", "type": "string"},
    {"name": "exchange", "type": "string"},
    {"name": "quote_type", "type": "int"},
    {"name": "market_hours", "type": "int"},
    {"name": "change_percent", "type": "float"},
    {"name": "day_volume", "type": "int"},
    {"name": "change", "type": "float"},
    {"name": "last_size", "type": "int"},
    {"name": "price_hint", "type": "string"},
    {"name": "producer_timestamp", "type": "long"}
  ]
}
```

## Message Format

### Yahoo Finance WebSocket Message (input)

```json
{
  "id": "VCB.VN",
  "price": 95.5,
  "time": 1699627620594,
  "exchange": "HOSE",
  "quote_type": 1,
  "market_hours": 1,
  "change_percent": 1.25,
  "day_volume": 1500000,
  "change": 1.2,
  "last_size": 100,
  "price_hint": "DELAYED"
}
```

### Kafka Message (output)

```json
{
  "symbol": "VCB.VN",
  "price": 95.5,
  "timestamp": "1699627620594",
  "exchange": "HOSE",
  "quote_type": 1,
  "market_hours": 1,
  "change_percent": 1.25,
  "day_volume": 1500000,
  "change": 1.2,
  "last_size": 100,
  "price_hint": "DELAYED",
  "producer_timestamp": 1699627620600
}
```

**Lưu ý:** `producer_timestamp` được thêm vào để track latency.

## Symbols List

**Tổng 280 mã chứng khoán VN:**

AAA, AAM, ABS, ABT, ACB, ACC, ACL, ADG, ADP, ADS, AGG, AGR, ANV, APG, APH, ASM, ASP, AST, BAF, BCE, BCM, BFC, BIC, BID, BKG, BMC, BMI, BMP, BRC, BSI, BTP, BVH, BWE, C32, CCL, CDC, CII, CLC, CLL, CMG, CMX, CNG, CRC, CRE, CSM, CSV, CTD, CTF, CTG, CTI, CTR, CTS, D2D, DAH, DBC, DBD, DBT, DC4, DCL, DCM, DGC, DGW, DHA, DHC, DHM, DIG, DMC, DPG, DPM, DPR, DRC, DRL, DSC, DSE, DSN, DTA, DVP, DXG, DXS, EIB, ELC, EVE, EVF, FCM, FCN, FIR, FIT, FMC, FPT, FRT, FTS, GAS, GDT, GEE, GEX, GIL, GMD, GSP, GVR, HAG, HAH, HAP, HAR, HAX, HCD, HCM, HDB, HDC, HDG, HHP, HHS, HHV, HID, HII, HMC, HPG, HPX, HQC, HSG, HSL, HT1, HTG, HTI, HTN, HUB, HVH, ICT, IDI, IJC, ILB, IMP, ITC, ITD, JVC, KBC, KDC, KDH, KHG, KHP, KMR, KOS, KSB, LAF, LBM, LCG, LHG, LIX, LPB, LSS, MBB, MCM, MCP, MHC, MIG, MSB, MSH, MSN, MWG, NAB, NAF, NBB, NCT, NHA, NHH, NKG, NLG, NNC, NO1, NSC, NT2, NTL, OCB, OGC, ORS, PAC, PAN, PC1, PDR, PET, PGC, PHC, PHR, PIT, PLP, PLX, PNJ, POW, PPC, PTB, PTC, PTL, PVD, PVP, PVT, QCG, RAL, REE, RYG, SAB, SAM, SAV, SBG, SBT, SCR, SCS, SFC, SFG, SGN, SGR, SGT, SHB, SHI, SIP, SJD, SJS, SKG, SMB, SSB, SSI, ST8, STB, STK, SVT, SZC, SZL, TCB, TCH, TCI, TCL, TCM, TCO, TCT, TDC, TDG, TDP, TEG, THG, TIP, TLD, TLG, TLH, TMT, TNH, TNI, TNT, TPB, TRC, TSC, TTA, TTF, TV2, TVS, TYA, UIC, VCA, VCB, VCG, VCI, VDS, VFG, VGC, VHC, VHM, VIB, VIC, VIP, VIX, VJC, VMD, VND, VNL, VNM, VNS, VOS, VPB, VPG, VPH, VPI, VRC, VRE, VSC, VTO, VTP, YBM, YEG

## Monitoring

### Producer Logs

```bash
# Real-time logs
docker logs -f stock-producer-1

# Check errors
docker logs stock-producer-1 | grep -i error
```

### Throughput

```bash
# Kafka topic lag
docker exec broker-1 /opt/kafka/bin/kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --describe --group flink-simple-reader
```

### Schema Registry

```bash
# List schemas
curl http://localhost:8082/subjects

# Get yfinance schema
curl http://localhost:8082/subjects/yfinance-value/versions/latest
```

## Troubleshooting

### Producer không connect được Yahoo Finance

```bash
# Check logs
docker logs stock-producer-1

# Common errors:
# - Connection timeout: Network issue
# - Invalid symbols: Symbol không tồn tại
# - Rate limit: Too many connections
```

**Solution:**
```bash
# Restart producer
docker restart stock-producer-1
```

### Không produce messages vào Kafka

```bash
# Verify Kafka connectivity
docker exec stock-producer-1 ping broker-1

# Check Schema Registry
curl http://schema-registry:8081/subjects

# Verify topic exists
docker exec broker-1 /opt/kafka/bin/kafka-topics.sh \
  --bootstrap-server localhost:9092 --list | grep yfinance
```

### High memory usage

```bash
# Check container stats
docker stats stock-producer-1

# Restart if needed
docker restart stock-producer-1
```

### WebSocket connection drops

**Auto-reconnect logic:** Producer tự động reconnect khi connection drop.

```bash
# Check logs for reconnect attempts
docker logs stock-producer-1 | grep -i "reconnect\|connection"
```

## Environment Variables

```yaml
KAFKA_BOOTSTRAP_SERVERS: broker-1:19092,broker-2:19092,broker-3:19092
SCHEMA_REGISTRY_URL: http://schema-registry:8081
SYMBOLS: AAA.VN,AAM.VN,ABS.VN,...
```

## Performance

- **Throughput:** ~500-1000 messages/second (3 producers)
- **Latency:** <100ms (producer timestamp → Kafka)
- **Memory:** ~200MB per producer
- **CPU:** ~10% per producer

## Scaling

### Thêm producer instances

```yaml
# docker-compose.yml
stock-producer-4:
  build: .
  environment:
    - SYMBOLS=CUSTOM_LIST_HERE
```

### Tăng partitions

```python
# stock_producer.py
partitions=16  # Tăng lên 16 partitions
```

## Dependencies

- `yfinance`: Yahoo Finance WebSocket API
- `confluent-kafka`: Kafka client
- `websockets`: WebSocket protocol

## License

Proprietary - Stock AI Project

