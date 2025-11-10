import logging
from datetime import date, datetime, timedelta
from typing import List, Tuple

from cassandra.cluster import Cluster
from cassandra.policies import DCAwareRoundRobinPolicy
import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# ScyllaDB config
SCYLLA_NODES = ['localhost']
SCYLLA_PORT = 9042
SCYLLA_KEYSPACE = 'stock_data'

# Warehouse (PostgreSQL) config
WAREHOUSE_CONFIG = {
    'host': 'localhost',
    'port': 5433,
    'database': 'warehouse',
    'user': 'warehouse_user',
    'password': 'warehouse_pass'
}


def get_scylla_session():
    cluster = Cluster(SCYLLA_NODES, port=SCYLLA_PORT,
                      load_balancing_policy=DCAwareRoundRobinPolicy(local_dc='datacenter1'))
    session = cluster.connect(SCYLLA_KEYSPACE)
    return cluster, session


def get_pg_conn():
    return psycopg2.connect(**WAREHOUSE_CONFIG)


def upsert_dim_stock(cursor, stocks: List[Tuple[str, str, int]]):
    if not stocks:
        return
    # deduplicate by stock_code
    unique = {}
    for code, exch, qt in stocks:
        if code not in unique:
            unique[code] = (code, exch, qt)
    data = list(unique.values())
    execute_values(cursor, """
        INSERT INTO dim_stock (stock_code, exchange, quote_type)
        VALUES %s
        ON CONFLICT (stock_code) DO UPDATE SET
            exchange = EXCLUDED.exchange,
            quote_type = EXCLUDED.quote_type,
            updated_at = CURRENT_TIMESTAMP
    """, data, page_size=1000)


def fetch_daily_from_scylla(session):
    symbols_res = session.execute("SELECT DISTINCT symbol FROM stock_daily_summary")
    symbols = [r.symbol for r in symbols_res]
    logger.info(f"Found {len(symbols)} symbols")

    stocks: List[Tuple[str, str, int]] = []
    prices: List[Tuple] = []

    for sym in symbols:
        rows = session.execute("""
            SELECT symbol, trade_date, open, high, low, close, volume,
                   change, change_percent, vwap, exchange, quote_type, market_hours
            FROM stock_daily_summary
            WHERE symbol = %s
        """, [sym])

        for r in rows:
            tdate = r.trade_date
            if hasattr(tdate, 'date') and callable(tdate.date):
                tdate = tdate.date()

            stocks.append((r.symbol, r.exchange, r.quote_type))
            prices.append((
                r.symbol,
                tdate,
                float(r.open) if r.open is not None else None,
                float(r.high) if r.high is not None else None,
                float(r.low) if r.low is not None else None,
                float(r.close) if r.close is not None else None,
                int(r.volume) if r.volume is not None else None,
                float(r.change) if r.change is not None else None,
                float(r.change_percent) if r.change_percent is not None else None,
                float(r.vwap) if r.vwap is not None else None,
                int(r.market_hours) if r.market_hours is not None else None,
            ))

    return stocks, prices


def insert_daily_to_warehouse():
    logger.info(f"Start insert")
    (cluster, scy_session) = (None, None)
    pg_conn = None
    try:
        cluster, scy_session = get_scylla_session()
        pg_conn = get_pg_conn()
        cur = pg_conn.cursor()

        stocks, prices = fetch_daily_from_scylla(scy_session)
        logger.info(f"Fetched: stocks={len(stocks)}, prices={len(prices)}")

        if stocks:
            upsert_dim_stock(cur, stocks)
            pg_conn.commit()
            logger.info("Upserted dim_stock")
        else:
            logger.warning("No stocks to upsert")

        if prices:
            execute_values(cur, """
                INSERT INTO fact_daily_prices (
                    stock_code, trade_date, "open", high, low, "close",
                    volume, change, change_percent, vwap, market_hours
                ) VALUES %s
                ON CONFLICT (stock_code, trade_date) DO UPDATE SET
                    "open" = EXCLUDED."open",
                    high = EXCLUDED.high,
                    low = EXCLUDED.low,
                    "close" = EXCLUDED."close",
                    volume = EXCLUDED.volume,
                    change = EXCLUDED.change,
                    change_percent = EXCLUDED.change_percent,
                    vwap = EXCLUDED.vwap,
                    market_hours = EXCLUDED.market_hours
            """, prices, page_size=1000)
            pg_conn.commit()
            logger.info(f"Inserted {len(prices)} rows into fact_daily_prices")
        else:
            logger.warning("No price rows to insert")

    finally:
        if pg_conn:
            pg_conn.close()
        if cluster:
            cluster.shutdown()
    logger.info("Done")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--date', help='YYYY-MM-DD; default: yesterday')
    args = parser.parse_args()

    insert_daily_to_warehouse()
