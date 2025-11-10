from cassandra.cluster import Cluster
import csv
import datetime
import time
import re
from datetime import timezone

# --- Cấu hình Scylla ---
SCYLLA_NODES = ['localhost']
SCYLLA_KEYSPACE = 'stock_data'
SCYLLA_PORT = 9042
CSV_FILE = '/home/obito/main/scylla-service/data/stock_news_final.csv'
MAX_RPS = 700  # Giới hạn số dòng/giây
csv.field_size_limit(10_000_000)

def connect_to_scylla():
    cluster = Cluster(SCYLLA_NODES, port=SCYLLA_PORT)
    cluster.default_timeout = 30
    session = cluster.connect()
    session.set_keyspace(SCYLLA_KEYSPACE)
    return session


def parse_ts(s: str):
    """
    Parse nhiều định dạng timestamp thường gặp trong CSV:
    - 'YYYY-MM-DD HH:MM:SS.sss+0000'
    - 'YYYY-MM-DD HH:MM:SS+00:00'
    - 'YYYY-MM-DD HH:MM:SS'
    - 'YYYY-MM-DD'
    Trả về datetime (naive UTC) để insert vào Cassandra.
    """
    if not s:
        return None
    s = s.strip()

    # Chuẩn hoá 'Z' => +0000
    if s.endswith('Z'):
        s = s[:-1] + '+0000'

    # Nếu timezone dạng +HH:MM thì bỏ dấu ':' để tương thích %z
    s = re.sub(r'([+-]\d{2}):?(\d{2})$', r'\1\2', s)

    fmts = [
        "%Y-%m-%d %H:%M:%S.%f%z",
        "%Y-%m-%d %H:%M:%S%z",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]

    for fmt in fmts:
        try:
            dt = datetime.datetime.strptime(s, fmt)
            # Chuyển về UTC và bỏ tzinfo nếu có
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except Exception:
            continue

    raise ValueError(f"Không parse được timestamp: {s}")


def insert_from_csv(session, csv_file):
    insert_query = session.prepare("""
        INSERT INTO stock_news (
            article_id,
            stock_code,
            title,
            link,
            date,
            is_pdf,
            content,
            sentiment_score,
            pdf_link,
            crawled_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """)

    with open(csv_file, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        count = 0
        error_count = 0
        start = time.time()

        for row in reader:
            try:
                article_id = row.get('article_id')
                stock_code = row.get('stock_code')
                title = row.get('title')
                link = row.get('link')
                pdf_link = row.get('pdf_link')
                content = row.get('content')
                sentiment_score = float(row['sentiment_score']) if row.get('sentiment_score') else None

                # Parse thời gian
                date_str = row.get('date')
                crawled_str = row.get('crawled_at')
                date = parse_ts(date_str) if date_str else None
                crawled_at = parse_ts(crawled_str) if crawled_str else None

                is_pdf = (
                    str(row.get('is_pdf')).strip().lower() in ['true', '1', 'yes', 'y']
                    if row.get('is_pdf') else False
                )

                # Kiểm tra dữ liệu bắt buộc
                if not (article_id and stock_code and date):
                    raise ValueError("Thiếu article_id, stock_code hoặc date")

                # Thực hiện INSERT
                session.execute(insert_query, (
                    article_id, stock_code, title, link, date,
                    is_pdf, content, sentiment_score, pdf_link, crawled_at
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
                print(f"Lỗi dòng {count + error_count}: {e}")

        print(f"Đã insert {count} dòng thành công vào bảng stock_news")
        if error_count > 0:
            print(f"Có {error_count} dòng bị lỗi")


if __name__ == "__main__":
    session = connect_to_scylla()
    insert_from_csv(session, CSV_FILE)
