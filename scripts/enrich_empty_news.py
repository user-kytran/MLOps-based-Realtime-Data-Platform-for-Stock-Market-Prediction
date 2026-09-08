import os, time, sys, datetime
import psycopg2
from psycopg2.extras import execute_values
from cassandra.cluster import Cluster
from cassandra.concurrent import execute_concurrent_with_args

def main():
    start_time = time.time()
    print("=" * 70)
    print("ENRICHING EMPTY NEWS IN SCYLLADB & POSTGRESQL WAREHOUSE")
    print("=" * 70)

    # 1. Connect to ScyllaDB
    print("Connecting to ScyllaDB (scylla-node1, scylla-node2, scylla-node3)...")
    scylla_cluster = Cluster(["scylla-node1", "scylla-node2", "scylla-node3"], port=9042, protocol_version=4)
    scylla_session = scylla_cluster.connect("stock_data")
    scylla_session.default_timeout = 30.0

    # 2. Connect to Warehouse PostgreSQL
    print("Connecting to PostgreSQL Warehouse...")
    pg_conn = psycopg2.connect(
        host=os.getenv("WAREHOUSE_HOST", "warehouse-db"),
        port=5432,
        database=os.getenv("WAREHOUSE_DB", "warehouse"),
        user=os.getenv("WAREHOUSE_USER", "warehouse_user"),
        password=os.getenv("WAREHOUSE_PASSWORD", "warehouse_pass")
    )
    pg_cur = pg_conn.cursor()

    # 3. Fetch all rows from ScyllaDB stock_news
    print("\n[Step 1] Reading all news articles from ScyllaDB...")
    rows = list(scylla_session.execute(
        "SELECT stock_code, date, article_id, content, title, is_pdf, link, pdf_link, sentiment_score FROM stock_news"
    ))
    print(f"Total rows fetched from ScyllaDB: {len(rows):,}")

    # Build pool of non-empty content by article_id
    content_pool = {}
    for r in rows:
        if r.content and len(r.content.strip()) > 0:
            if r.article_id not in content_pool or len(r.content) > len(content_pool[r.article_id][0]):
                content_pool[r.article_id] = (r.content, r.sentiment_score or 0.0)

    print(f"Articles with valid content pool: {len(content_pool):,}")

    # Prepare ScyllaDB updates for empty records
    scylla_updates = []
    stmt_update = scylla_session.prepare(
        "UPDATE stock_news SET content = ?, sentiment_score = ? WHERE stock_code = ? AND date = ? AND article_id = ?"
    )

    sibling_fixed = 0
    title_fallback_fixed = 0

    for r in rows:
        has_cnt = bool(r.content and len(r.content.strip()) > 0)
        if not has_cnt:
            if r.article_id in content_pool:
                best_cnt, best_score = content_pool[r.article_id]
                scylla_updates.append((best_cnt, float(best_score), r.stock_code, r.date, r.article_id))
                sibling_fixed += 1
            elif r.title and len(r.title.strip()) > 0:
                fallback_cnt = r.title.strip()
                if r.pdf_link:
                    fallback_cnt += f"\n\n[Tài liệu đính kèm]({r.pdf_link})"
                elif r.link:
                    fallback_cnt += f"\n\n[Chi tiết]({r.link})"
                scylla_updates.append((fallback_cnt, float(r.sentiment_score or 0.0), r.stock_code, r.date, r.article_id))
                title_fallback_fixed += 1

    print(f"\n[Step 2] Updating ScyllaDB empty records ({len(scylla_updates):,} items)...")
    print(f"  - From sibling articles (e.g. multi-bank news): {sibling_fixed:,}")
    print(f"  - From title + attachment links (e.g. BCTC reports): {title_fallback_fixed:,}")

    # Execute in concurrent batches
    batch_size = 500
    for i in range(0, len(scylla_updates), batch_size):
        chunk = scylla_updates[i:i+batch_size]
        execute_concurrent_with_args(scylla_session, stmt_update, chunk, concurrency=30, raise_on_first_error=False)
        if (i // batch_size) % 5 == 0 or i + batch_size >= len(scylla_updates):
            print(f"  Updated {min(i + batch_size, len(scylla_updates)):,} / {len(scylla_updates):,} ScyllaDB records...")

    print("ScyllaDB update completed!")

    # 4. Enrich PostgreSQL fact_news
    print("\n[Step 3] Enriching PostgreSQL fact_news in Warehouse...")
    
    # Query empty rows in fact_news
    pg_cur.execute("SELECT stock_code, news_date, article_id FROM fact_news WHERE content IS NULL OR content = ''")
    empty_pg_rows = pg_cur.fetchall()
    print(f"Found {len(empty_pg_rows):,} empty records in PostgreSQL fact_news.")

    # Re-fetch updated rows from ScyllaDB for those keys
    scylla_dict = {}
    refreshed_scylla = list(scylla_session.execute(
        "SELECT stock_code, date, article_id, content, sentiment_score FROM stock_news"
    ))
    for r in refreshed_scylla:
        clean_code = r.stock_code.replace(".VN", "") if r.stock_code.endswith(".VN") else r.stock_code
        dt = r.date.date() if hasattr(r.date, "date") else r.date
        key = (clean_code, dt, r.article_id)
        if r.content and len(r.content.strip()) > 0:
            scylla_dict[key] = (r.content, float(r.sentiment_score or 0.0))

    pg_updates = []
    for code, ndate, aid in empty_pg_rows:
        key = (code, ndate, aid)
        if key in scylla_dict:
            cnt, sc = scylla_dict[key]
            pg_updates.append((code, ndate, aid, cnt, sc))
        elif aid in content_pool:
            cnt, sc = content_pool[aid]
            pg_updates.append((code, ndate, aid, cnt, sc))

    print(f"Prepared {len(pg_updates):,} updates for PostgreSQL fact_news.")

    if pg_updates:
        execute_values(
            pg_cur,
            """
            UPDATE fact_news AS f SET
                content = v.content,
                sentiment_score = v.sentiment_score
            FROM (VALUES %s) AS v(stock_code, news_date, article_id, content, sentiment_score)
            WHERE f.stock_code = v.stock_code 
              AND f.news_date = v.news_date 
              AND f.article_id = v.article_id
            """,
            pg_updates,
            page_size=500
        )
        pg_conn.commit()
        print(f"Successfully updated {len(pg_updates):,} records in PostgreSQL fact_news!")

    scylla_cluster.shutdown()
    pg_cur.close()
    pg_conn.close()

    duration = time.time() - start_time
    print("=" * 70)
    print(f"ALL DONE IN {duration:.2f}s!")
    print("=" * 70)

if __name__ == "__main__":
    main()
