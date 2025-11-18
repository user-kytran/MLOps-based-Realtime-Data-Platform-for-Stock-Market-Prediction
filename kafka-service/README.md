# Kafka Service

## Mục đích
Kafka cluster sử dụng kiến trúc KRaft (không cần Zookeeper) để xử lý message streaming cho hệ thống. Bao gồm Schema Registry để quản lý Avro schema và Kafka UI để giám sát.

## Cấu trúc
```
kafka-service/
└── docker-compose.yml    # Cấu hình cluster
```

### Thành phần
- **Controllers** (3 nodes): Quản lý metadata và cluster coordination
  - controller-1, controller-2, controller-3
  - Port internal: 9093
  
- **Brokers** (3 nodes): Xử lý message và storage
  - broker-1: localhost:29092
  - broker-2: localhost:39092
  - broker-3: localhost:49092
  - Port internal: 19092
  
- **Schema Registry**: Quản lý Avro schema
  - URL: http://localhost:8082
  - Replication factor: 3
  
- **Kafka UI**: Giao diện quản lý cluster
  - URL: http://localhost:8080

## Cách sử dụng

### Khởi động cluster
```bash
docker-compose up -d
```

### Kiểm tra trạng thái
```bash
docker-compose ps
```

### Dừng cluster
```bash
docker-compose down
```

### Truy cập

**Kafka UI**: http://localhost:8080
- Xem topics, consumers, brokers
- Tạo/xóa topics
- Gửi/đọc messages

**Schema Registry**: http://localhost:8082
- API endpoint để đăng ký/lấy schema

### Kết nối từ service khác

**Internal (trong Docker network)**:
```
Bootstrap servers: broker-1:19092,broker-2:19092,broker-3:19092
Schema Registry: http://schema-registry:8081
```

**External (từ host machine)**:
```
Broker 1: localhost:29092
Broker 2: localhost:39092
Broker 3: localhost:49092
Schema Registry: localhost:8082
```

## Quy ước

### KRaft Mode
- Không sử dụng Zookeeper
- Controllers quorum voters: 3 nodes
- Node IDs: 1-3 (controllers), 4-6 (brokers)

### Listeners
- `PLAINTEXT`: Internal broker communication (19092)
- `PLAINTEXT_HOST`: External client connections (29092/39092/49092)
- `CONTROLLER`: Controller communication (9093)

### Network
- Network: `financi-network` (external)
- Tất cả services phải cùng network này

## Ghi chú phát triển

### Tạo topic
```bash
docker exec -it broker-1 kafka-topics --bootstrap-server broker-1:19092 \
  --create --topic <topic-name> \
  --partitions 6 --replication-factor 3
```

### List topics
```bash
docker exec -it broker-1 kafka-topics --bootstrap-server broker-1:19092 --list
```

### Consume messages
```bash
docker exec -it broker-1 kafka-console-consumer \
  --bootstrap-server broker-1:19092 \
  --topic <topic-name> --from-beginning
```

### Produce messages
```bash
docker exec -it broker-1 kafka-console-producer \
  --bootstrap-server broker-1:19092 \
  --topic <topic-name>
```

### Schema Registry API
```bash
# List subjects
curl http://localhost:8082/subjects

# Get schema
curl http://localhost:8082/subjects/<subject-name>/versions/latest
```

### Lưu ý
- Replication factor = 3 để đảm bảo high availability
- Auto restart enabled cho tất cả services
- Schema Registry lưu metadata trong internal topic với RF=3
- Kafka UI có dynamic config enabled để tạo/sửa topics qua UI

