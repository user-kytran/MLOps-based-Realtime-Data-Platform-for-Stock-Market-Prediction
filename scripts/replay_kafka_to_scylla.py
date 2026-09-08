import sys, time, datetime
from confluent_kafka import Consumer, TopicPartition
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer
from cassandra.cluster import Cluster, DCAwareRoundRobinPolicy
from cassandra.concurrent import execute_concurrent_with_args

def parse_ts(ts_str):
    try:
        if str(ts_str).isdigit():
            epoch = int(ts_str)
            if epoch > 1e10:
                epoch = epoch / 1000.0
            return datetime.datetime.fromtimestamp(epoch, tz=datetime.timezone.utc).replace(tzinfo=None)
        return datetime.datetime.fromisoformat(str(ts_str).replace("Z", ""))
    except Exception:
        return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)

def main():
    start_time = time.time()
    print("=" * 60)
    print("REPLAY KAFKA TO SCYLLADB (RESTORING MORNING DATA)")
    print("=" * 60)

    # 1. Connect to ScyllaDB
    print("Connecting to ScyllaDB cluster (scylla-node1, scylla-node2, scylla-node3)...")
    cluster = Cluster(
        ["scylla-node1", "scylla-node2", "scylla-node3"],
        port=9042,
        protocol_version=4
    )
    session = cluster.connect("stock_data")
    print("Connected to ScyllaDB keyspace: stock_data")

    # Prepared statements
    stmt_raw = session.prepare(
        "INSERT INTO stock_prices (symbol, timestamp, change, change_percent, day_volume, "
        "exchange, last_size, market_hours, price, price_hint, quote_type, producer_timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    stmt_latest = session.prepare(
        "INSERT INTO stock_latest_prices (symbol, change, change_percent, day_volume, exchange, "
        "last_size, market_hours, price, price_hint, quote_type, timestamp, producer_timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    stmt_agg = session.prepare(
        "INSERT INTO stock_prices_agg (symbol, bucket_date, interval, ts, close, high, low, open, volume, vwap) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    stmt_daily = session.prepare(
        "INSERT INTO stock_daily_summary (symbol, trade_date, change, change_percent, close, exchange, "
        "high, low, market_hours, open, quote_type, volume, vwap) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )

    # 2. Connect to Kafka
    print("Connecting to Kafka and Schema Registry...")
    sr_client = SchemaRegistryClient({"url": "http://schema-registry:8081"})
    avro_deserializer = AvroDeserializer(sr_client)

    consumer = Consumer({
        "bootstrap.servers": "broker-1:19092,broker-2:19092,broker-3:19092",
        "group.id": f"replay_job_{int(time.time())}",
        "enable.auto.commit": False
    })

    # Find offsets for 2026-09-07 01:00:00 UTC (08:00 AM UTC+7)
    dt_morning = datetime.datetime(2026, 9, 7, 1, 0, 0, tzinfo=datetime.timezone.utc)
    ts_morning_ms = int(dt_morning.timestamp() * 1000)

    query_parts = [TopicPartition("yfinance", p, ts_morning_ms) for p in range(12)]
    resolved = consumer.offsets_for_times(query_parts)

    assigned_partitions = []
    end_offsets = {}
    total_expected = 0

    for tp in resolved:
        low, high = consumer.get_watermark_offsets(TopicPartition("yfinance", tp.partition))
        start_off = tp.offset if tp.offset is not None and tp.offset >= 0 else low
        assigned_partitions.append(TopicPartition("yfinance", tp.partition, start_off))
        end_offsets[tp.partition] = high
        count = high - start_off
        total_expected += count
        print(f"  Partition {tp.partition:02d}: offset {start_off} -> {high} ({count:,} messages)")

    print(f"Total messages to replay: {total_expected:,}")
    consumer.assign(assigned_partitions)

    # Aggregation dictionaries
    # minute_agg: (symbol, bucket_dt) -> {open, high, low, close, volume, weighted_sum}
    minute_agg = {}
    # daily_agg: (symbol, trade_date) -> {open, high, low, close, volume, weighted_sum, exchange, quote_type, market_hours}
    daily_agg = {}
    # latest_records: symbol -> mapped_data
    latest_records = {}
    raw_records = []

    consumed_count = 0
    valid_count = 0
    batch_size = 5000

    print("Consuming messages and preparing batches...")
    
    finished_partitions = set()
    num_partitions = len(assigned_partitions)

    while len(finished_partitions) < num_partitions:
        msg = consumer.poll(1.0)
        if msg is None:
            # Check if all partitions reached end
            for tp in assigned_partitions:
                pos = consumer.position([TopicPartition("yfinance", tp.partition)])[0].offset
                if pos >= end_offsets[tp.partition]:
                    finished_partitions.add(tp.partition)
            if len(finished_partitions) >= num_partitions:
                break
            continue

        if msg.error():
            continue

        p = msg.partition()
        off = msg.offset()
        if off >= end_offsets[p] - 1:
            finished_partitions.add(p)

        consumed_count += 1
        val = avro_deserializer(msg.value(), None)
        if not val:
            continue

        symbol = val.get("symbol", "")
        price = float(val.get("price", 0.0))
        day_volume = int(val.get("day_volume", 0))
        change_pct = float(val.get("change_percent", 0.0))
        change = float(val.get("change", 0.0))
        last_size = int(val.get("last_size", 0))
        ts_str = str(val.get("timestamp", ""))
        exchange = val.get("exchange", "VSE")
        quote_type = int(val.get("quote_type", 0))
        market_hours = int(val.get("market_hours", 0))
        price_hint = str(val.get("price_hint", ""))
        prod_ts = int(val.get("producer_timestamp", 0))

        # Filter same as Flink: price > 0, day_volume > 0, price < 1000000, abs(change_percent) < 50
        if not (0 < price < 1000000 and day_volume > 0 and abs(change_pct) < 50):
            continue

        valid_count += 1
        dt = parse_ts(ts_str)
        trade_date = dt.date()
        minute_dt = dt.replace(second=0, microsecond=0)

        # Raw record
        raw_records.append((
            symbol, ts_str, round(change, 2), round(change_pct, 2),
            day_volume, exchange, last_size, market_hours,
            round(price, 2), price_hint, quote_type, prod_ts
        ))

        # Latest record (keyed by symbol)
        if symbol not in latest_records or prod_ts >= latest_records[symbol][-1]:
            latest_records[symbol] = (
                symbol, round(change, 2), round(change_pct, 2),
                day_volume, exchange, last_size, market_hours,
                round(price, 2), price_hint, quote_type, dt, prod_ts
            )

        # 1-minute aggregation
        agg_key = (symbol, minute_dt)
        if agg_key not in minute_agg:
            minute_agg[agg_key] = {
                "open": price, "high": price, "low": price, "close": price,
                "volume": last_size, "weighted_sum": price * last_size
            }
        else:
            m = minute_agg[agg_key]
            m["high"] = max(m["high"], price)
            m["low"] = min(m["low"], price)
            m["close"] = price
            m["volume"] += last_size
            m["weighted_sum"] += price * last_size

        # Daily summary aggregation
        daily_key = (symbol, trade_date)
        if daily_key not in daily_agg:
            daily_agg[daily_key] = {
                "open": price, "high": price, "low": price, "close": price,
                "volume": day_volume, "weighted_sum": price * last_size,
                "exchange": exchange, "quote_type": quote_type, "market_hours": market_hours
            }
        else:
            d = daily_agg[daily_key]
            d["high"] = max(d["high"], price)
            d["low"] = min(d["low"], price)
            d["close"] = price
            d["volume"] = max(d["volume"], day_volume)
            d["weighted_sum"] += price * last_size

        if len(raw_records) >= batch_size:
            execute_concurrent_with_args(session, stmt_raw, raw_records, concurrency=100)
            raw_records = []
            print(f"  Processed {consumed_count:,} / {total_expected:,} messages...")

    # Flush remaining raw records
    if raw_records:
        execute_concurrent_with_args(session, stmt_raw, raw_records, concurrency=100)
        raw_records = []

    consumer.close()
    print(f"\nAll {consumed_count:,} Kafka messages consumed! ({valid_count:,} valid records)")

    # 3. Write stock_latest_prices
    print(f"\nWriting {len(latest_records):,} symbols into stock_latest_prices...")
    execute_concurrent_with_args(session, stmt_latest, list(latest_records.values()), concurrency=50)

    # 4. Write stock_prices_agg (1m)
    print(f"Writing {len(minute_agg):,} minute bars into stock_prices_agg...")
    agg_params = []
    for (sym, min_dt), m in minute_agg.items():
        vwap = m["weighted_sum"] / m["volume"] if m["volume"] > 0 else m["close"]
        agg_params.append((
            sym, min_dt.date(), "1m", min_dt,
            round(m["close"], 2), round(m["high"], 2), round(m["low"], 2),
            round(m["open"], 2), int(m["volume"]), round(vwap, 2)
        ))
    execute_concurrent_with_args(session, stmt_agg, agg_params, concurrency=100)

    # 5. Write stock_daily_summary
    print(f"Writing {len(daily_agg):,} daily summaries into stock_daily_summary...")
    daily_params = []
    for (sym, tdate), d in daily_agg.items():
        op = d["open"]
        cl = d["close"]
        chg = cl - op if op > 0 else 0.0
        chg_pct = (chg / op * 100.0) if op > 0 else 0.0
        vwap = d["weighted_sum"] / d["volume"] if d["volume"] > 0 else cl
        daily_params.append((
            sym, tdate, round(chg, 2), round(chg_pct, 2),
            round(cl, 2), d["exchange"], round(d["high"], 2), round(d["low"], 2),
            d["market_hours"], round(op, 2), d["quote_type"], int(d["volume"]), round(vwap, 2)
        ))
    execute_concurrent_with_args(session, stmt_daily, daily_params, concurrency=50)

    cluster.shutdown()
    duration = time.time() - start_time
    print("=" * 60)
    print(f"BACKFILL COMPLETE IN {duration:.2f}s!")
    print(f"  - Raw ticks written: {valid_count:,}")
    print(f"  - Latest prices updated: {len(latest_records):,} symbols")
    print(f"  - 1-minute candlestick bars: {len(minute_agg):,}")
    print(f"  - Daily summaries generated: {len(daily_agg):,}")
    print("=" * 60)

if __name__ == "__main__":
    main()
