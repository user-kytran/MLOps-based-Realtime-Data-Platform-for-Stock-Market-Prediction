from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
import csv
import datetime
import time

# --- Cấu hình Scylla ---
SCYLLA_NODES = ['localhost']
SCYLLA_KEYSPACE = 'stock_data'
SCYLLA_PORT = 9042
CSV_FILE = '/home/obito/main/scylla-service/stock_daily_summary.csv'
MAX_RPS = 700  # Giới hạn số dòng/giây

def connect_to_scylla():
    cluster = Cluster(SCYLLA_NODES, port=SCYLLA_PORT)
    session = cluster.connect()
    session.set_keyspace(SCYLLA_KEYSPACE)
    return session

def insert_from_csv(session, csv_file):
    insert_query = session.prepare("""
        INSERT INTO stock_daily_summary (
            symbol,
            trade_date,
            open,
            high,
            low,
            close,
            volume,
            change,
            change_percent,
            vwap,
            exchange,
            quote_type,
            market_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        error_count = 0
        start = time.time()

        for row in reader:
            try:
                symbol = row.get('symbol')
                if not symbol:
                    raise ValueError("Thiếu symbol")

                trade_date_str = row.get('trade_date')
                trade_date = (
                    datetime.datetime.strptime(trade_date_str, '%Y-%m-%d').date()
                    if trade_date_str else None
                )

                open_p = float(row['open']) if row.get('open') else None
                high = float(row['high']) if row.get('high') else None
                low = float(row['low']) if row.get('low') else None
                close = float(row['close']) if row.get('close') else None
                volume = int(row['volume']) if row.get('volume') else None
                change = float(row['change']) if row.get('change') else None
                change_percent = float(row['change_percent']) if row.get('change_percent') else None
                vwap = float(row['vwap']) if row.get('vwap') else None
                exchange = row.get('exchange')
                quote_type = int(row['quote_type']) if row.get('quote_type') else None
                market_hours = int(row['market_hours']) if row.get('market_hours') else None

                # --- Thực hiện INSERT ---
                session.execute(insert_query, (
                    symbol, trade_date, open_p, high, low, close, volume,
                    change, change_percent, vwap, exchange, quote_type, market_hours
                ))
                count += 1

                # Giới hạn tốc độ (MAX_RPS dòng/giây)
                if count % MAX_RPS == 0:
                    elapsed = time.time() - start
                    if elapsed < 1:
                        time.sleep(1 - elapsed)
                    start = time.time()

            except Exception as e:
                error_count += 1
                print(f"⚠️ Lỗi dòng {count + error_count}: {e}")

        print(f"✅ Đã insert {count} dòng thành công vào bảng stock_daily_summary")
        if error_count > 0:
            print(f"⚠️ Có {error_count} dòng bị lỗi")


if __name__ == "__main__":
    session = connect_to_scylla()
    insert_from_csv(session, CSV_FILE)
