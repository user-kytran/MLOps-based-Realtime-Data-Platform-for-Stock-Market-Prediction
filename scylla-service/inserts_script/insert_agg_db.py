from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
import csv
import datetime
import time

SCYLLA_NODES = ['localhost']
SCYLLA_KEYSPACE = 'stock_data'
SCYLLA_PORT = 9042
CSV_FILE = '/home/obito/main/scylla-service/stock_prices_agg.csv'
MAX_RPS = 600  # Giới hạn 300 request/second

def connect_to_scylla():
    cluster = Cluster(SCYLLA_NODES, port=SCYLLA_PORT)
    session = cluster.connect()
    session.set_keyspace(SCYLLA_KEYSPACE)
    return session

def insert_from_csv(session, csv_file):
    insert_query = session.prepare("""
        INSERT INTO stock_prices_agg (
            symbol,
            bucket_date,
            interval,
            ts,
            open,
            high,
            low,
            close,
            volume,
            vwap
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        error_count = 0
        start = time.time()

        for row in reader:
            try:
                # -------- Parse dữ liệu --------
                symbol = row.get('symbol')
                if not symbol:
                    raise ValueError("Thiếu symbol")

                bucket_date_str = row.get('bucket_date')
                bucket_date = (
                    datetime.datetime.strptime(bucket_date_str, '%Y-%m-%d').date()
                    if bucket_date_str else None
                )

                interval = row.get('interval', '1m')

                ts_str = row.get('ts')
                ts = datetime.datetime.strptime(ts_str, "%Y-%m-%d %H:%M:%S.%f%z")

                open_p = float(row['open']) if row.get('open') else None
                high = float(row['high']) if row.get('high') else None
                low = float(row['low']) if row.get('low') else None
                close = float(row['close']) if row.get('close') else None
                volume = int(row['volume']) if row.get('volume') else None
                vwap = float(row['vwap']) if row.get('vwap') else None

                # -------- Insert --------
                session.execute(insert_query, (
                    symbol, bucket_date, interval, ts,
                    open_p, high, low, close, volume, vwap
                ))
                count += 1

                # Giới hạn tốc độ
                if count % MAX_RPS == 0:
                    elapsed = time.time() - start
                    if elapsed < 1:
                        time.sleep(1 - elapsed)
                    start = time.time()

                if count % 1000 == 0:
                    print(f"📊 Đã insert {count} dòng thành công vào bảng stock_prices_agg")

            except Exception as e:
                error_count += 1
                print(f"⚠️ Lỗi dòng {row}: {e}")

        print(f"✅ Đã insert {count} dòng thành công vào bảng stock_prices_agg")
        if error_count > 0:
            print(f"⚠️ Có {error_count} dòng bị lỗi")


if __name__ == "__main__":
    session = connect_to_scylla()
    insert_from_csv(session, CSV_FILE)
