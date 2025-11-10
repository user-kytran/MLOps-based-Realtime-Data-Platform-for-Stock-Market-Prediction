"""
Daily ETL: Dump data from ScyllaDB to Warehouse (Star Schema)
"""
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta, time
from contextlib import contextmanager
import logging
from cassandra.cluster import Cluster
from cassandra.policies import DCAwareRoundRobinPolicy
import psycopg2
from psycopg2.extras import execute_values
from dateutil import parser as date_parser
import os
import pendulum
from dotenv import load_dotenv

load_dotenv()

SCYLLA_NODES = [os.getenv('SCYLLA_NODE1'), os.getenv('SCYLLA_NODE2'), os.getenv('SCYLLA_NODE3')]
SCYLLA_KEYSPACE = os.getenv('SCYLLA_KEYSPACE')
SCYLLA_PORT = int(os.getenv('SCYLLA_PORT', 9042))
SCYLLA_DC = os.getenv('SCYLLA_DC', 'datacenter1')
WAREHOUSE_CONFIG = {
    'host': os.getenv('HOST'),
    'database': os.getenv('DATABASE'),
    'user': os.getenv('USER'),
    'password': os.getenv('PASSWORD')
}

local_tz = pendulum.timezone("Asia/Ho_Chi_Minh")
now_vn = pendulum.now(tz=local_tz)

@contextmanager
def get_scylla_session():
    """Context manager for ScyllaDB connection"""
    cluster = Cluster(SCYLLA_NODES, port=SCYLLA_PORT, 
                    load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=SCYLLA_DC),
                    protocol_version=4)
    session = cluster.connect(SCYLLA_KEYSPACE)
    try:
        yield session
    finally:
        session.shutdown()
        cluster.shutdown()


@contextmanager
def get_warehouse_cursor():
    """Context manager for Warehouse connection"""
    conn = psycopg2.connect(**WAREHOUSE_CONFIG)
    cursor = conn.cursor()
    try:
        yield cursor, conn
    finally:
        cursor.close()
        conn.close()


def upsert_dim_stock(cursor, stocks):
    '''
        Upsert stocks to dim_stock, if stock_code already exists, update the record with new values
    '''
    if not stocks:
        return
    
    execute_values(cursor, """
        INSERT INTO dim_stock (stock_code, exchange, quote_type)
        VALUES %s
        ON CONFLICT (stock_code) DO UPDATE SET
            exchange = EXCLUDED.exchange,
            quote_type = EXCLUDED.quote_type,
            updated_at = CURRENT_TIMESTAMP
    """, stocks, page_size=500)

# Lấy ngày mới nhất trong warehouse
def get_latest_date_in_daily_prices():
    with get_warehouse_cursor() as (cursor, conn):
        cursor.execute("SELECT MAX(trade_date) FROM fact_daily_prices")
        return cursor.fetchone()[0]
def get_latest_date_in_news():
    with get_warehouse_cursor() as (cursor, conn):
        cursor.execute("SELECT MAX(news_date) FROM fact_news")
        result = cursor.fetchone()
        return result[0] if result and result[0] else None

default_args = {
    'owner': 'airflow',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(minutes=60),
}

dag = DAG(
    'dump_to_warehouse',
    default_args=default_args,
    description='Daily dump ScyllaDB to Warehouse',
    schedule_interval='0 15 * * *',  # 15:00 Vietnam time (UTC+7)
    start_date=pendulum.datetime(2025, 10, 1, tz=local_tz),
    catchup=False,
    tags=['warehouse', 'etl'],
)

def dump_daily_data(**context):
    """Dump daily OHLCV data to fact_stock_daily"""
    try:
        with get_scylla_session() as session, get_warehouse_cursor() as (cursor, conn):
            latest_date_in_warehouse = get_latest_date_in_daily_prices()
            
            # If warehouse is empty, dump all historical data
            if latest_date_in_warehouse is None:
                logging.info("Warehouse is empty. Dumping ALL historical data from ScyllaDB...")
                use_date_filter = False
            else:
                logging.info(f"Latest date in warehouse: {latest_date_in_warehouse}")
                latest_date_in_warehouse = latest_date_in_warehouse + timedelta(days=1)
                logging.info(f"Dumping data from {latest_date_in_warehouse} onwards...")
                use_date_filter = True
                    
            # First, get all unique symbols
            symbols_result = session.execute("SELECT DISTINCT symbol FROM stock_daily_summary")
            symbols = [row.symbol for row in symbols_result]
            
            logging.info(f"Found {len(symbols)} symbols to process")
            
            stocks_data = []
            prices_data = []
            
            for symbol in symbols:
                if use_date_filter:
                    # Incremental: only new data from latest_date onwards
                    rows = session.execute("""
                        SELECT symbol, trade_date, open, high, low, close, volume, 
                               change, change_percent, vwap, exchange, quote_type, market_hours
                        FROM stock_daily_summary
                        WHERE symbol = %s AND trade_date >= %s
                    """, [symbol, str(latest_date_in_warehouse)])
                else:
                    # Full dump: all historical data
                    rows = session.execute("""
                        SELECT symbol, trade_date, open, high, low, close, volume, 
                               change, change_percent, vwap, exchange, quote_type, market_hours
                        FROM stock_daily_summary
                        WHERE symbol = %s
                    """, [symbol])
                
                rows_list = list(rows)
                
                for r in rows_list:
                    # Convert Cassandra Date to Python date
                    trade_date = r.trade_date
                    if hasattr(trade_date, 'date') and callable(trade_date.date):
                        trade_date = trade_date.date()
                    
                    # Remove .VN suffix from symbol
                    clean_symbol = r.symbol.replace('.VN', '') if r.symbol.endswith('.VN') else r.symbol
                    
                    stocks_data.append((
                        clean_symbol,
                        r.exchange,
                        r.quote_type
                    ))
                    
                    prices_data.append((
                        clean_symbol,
                        trade_date,
                        float(r.open) if r.open else None,
                        float(r.high) if r.high else None,
                        float(r.low) if r.low else None,
                        float(r.close) if r.close else None,
                        r.volume,
                        float(r.change) if r.change else None,
                        float(r.change_percent) if r.change_percent else None,
                        float(r.vwap) if r.vwap else None,
                        r.market_hours
                    ))
            
            logging.info(f"Collected {len(prices_data)} records from ScyllaDB")
            
            if stocks_data:
                # Deduplicate stocks_data by stock_code
                unique_stocks = {}
                for stock_code, exchange, quote_type in stocks_data:
                    if stock_code not in unique_stocks:
                        unique_stocks[stock_code] = (stock_code, exchange, quote_type)
                stocks_data_unique = list(unique_stocks.values())
                
                logging.info(f"Upserting {len(stocks_data_unique)} unique stocks to dim_stock")
                upsert_dim_stock(cursor, stocks_data_unique)
                conn.commit()
                logging.info(f"Upserted {len(stocks_data_unique)} stocks to dim_stock")
            else:
                logging.warning("No stocks to upsert to dim_stock")
            
            if prices_data:
                logging.info(f"Inserting {len(prices_data)} price records to fact_daily_prices")
                execute_values(cursor, """
                    INSERT INTO fact_daily_prices 
                    (stock_code, trade_date, "open", high, low, "close", 
                     volume, change, change_percent, vwap, market_hours)
                    VALUES %s
                    ON CONFLICT (stock_code, trade_date) DO UPDATE SET
                        "open" = EXCLUDED."open", high = EXCLUDED.high,
                        low = EXCLUDED.low, "close" = EXCLUDED."close",
                        volume = EXCLUDED.volume, change = EXCLUDED.change,
                        change_percent = EXCLUDED.change_percent, vwap = EXCLUDED.vwap,
                        market_hours = EXCLUDED.market_hours
                """, prices_data, page_size=500)
                conn.commit()
                logging.info(f"✅ Successfully inserted {len(prices_data)} records to fact_daily_prices")
            else:
                logging.warning(f"No new data to insert to fact_daily_prices")
                
    except Exception as e:
        logging.error(f"Error in dump_daily_data: {str(e)}")
        raise





def dump_news(**context):
    """Dump news articles to fact_stock_news"""    
    try:
        with get_scylla_session() as session, get_warehouse_cursor() as (cursor, conn):
            filtered_rows = []
            latest_date_in_warehouse = get_latest_date_in_news()
            
            if latest_date_in_warehouse is None:
                logging.info("Warehouse is empty. Dumping ALL historical news from ScyllaDB...")
                # Get all stock codes
                stock_codes = session.execute("SELECT DISTINCT stock_code FROM stock_news")
                stock_codes = [row.stock_code for row in stock_codes]
                
                for stock_code in stock_codes:
                    # Full dump: all historical news
                    rows = session.execute("""
                        SELECT article_id, stock_code, "date", content, sentiment_score, crawled_at
                        FROM stock_news
                        WHERE stock_code = %s
                    """, [stock_code])
                    all_rows = list(rows)
                    logging.info(f"Total news for {stock_code} from ScyllaDB: {len(all_rows)}")
                    filtered_rows.extend(all_rows)
            else:
                logging.info(f"Latest date in warehouse: {latest_date_in_warehouse}")
                latest_date_in_warehouse = latest_date_in_warehouse + timedelta(days=1)
                logging.info(f"Dumping news from {latest_date_in_warehouse} onwards...")
                query_timestamp = datetime.combine(latest_date_in_warehouse, time.min)
                
                # Get all stock codes
                stock_codes = session.execute("SELECT DISTINCT stock_code FROM stock_news")
                stock_codes = [row.stock_code for row in stock_codes]
                
                for stock_code in stock_codes:
                    # Incremental: only new news from latest_date onwards
                    rows = session.execute("""
                        SELECT article_id, stock_code, "date", content, sentiment_score, crawled_at
                        FROM stock_news
                        WHERE stock_code = %s AND "date" >= %s
                    """, [stock_code, query_timestamp])
                    all_rows = list(rows)
                    logging.info(f"Total news for {stock_code} from ScyllaDB: {len(all_rows)}")
                    filtered_rows.extend(all_rows)
            
            logging.info(f"Filtered news rows: {len(filtered_rows)}")
            
            stocks_data = []
            news_data = []
            
            for r in filtered_rows:
                # Remove .VN suffix from stock_code
                clean_stock_code = r.stock_code.replace('.VN', '') if r.stock_code.endswith('.VN') else r.stock_code
                
                stocks_data.append((clean_stock_code, 'NASDAQ', 1))
                content = r.content if r.content is not None else ""
                news_data.append((
                    clean_stock_code,
                    r.date,
                    content,
                    r.article_id,
                    r.sentiment_score
                ))
                
            logging.info(f"Collected {len(news_data)} news records to insert")
                
            if stocks_data:
                # Deduplicate stocks_data by stock_code
                unique_stocks = {}
                for stock_code, exchange, quote_type in stocks_data:
                    if stock_code not in unique_stocks:
                        unique_stocks[stock_code] = (stock_code, exchange, quote_type)
                stocks_data_unique = list(unique_stocks.values())
                
                logging.info(f"Upserting {len(stocks_data_unique)} unique stocks from news")
                upsert_dim_stock(cursor, stocks_data_unique)
                conn.commit()
                logging.info(f"Upserted {len(stocks_data_unique)} stocks from news to dim_stock")
            else:
                logging.warning("No stocks to upsert from news to dim_stock")
                
            if news_data:
                logging.info(f"Inserting {len(news_data)} news records to fact_news")
                execute_values(cursor, """
                    INSERT INTO fact_news 
                    (stock_code, news_date, content, article_id, sentiment_score)
                    VALUES %s
                    ON CONFLICT (stock_code, news_date, article_id) DO UPDATE SET
                        content = EXCLUDED.content,
                        sentiment_score = EXCLUDED.sentiment_score
                """, news_data, page_size=200)
                conn.commit()
                logging.info(f"✅ Successfully inserted {len(news_data)} records to fact_news")
            else:
                logging.warning(f"No new data to insert to fact_news")
                
    except Exception as e:
        logging.error(f"Error in dump_news: {str(e)}")
        raise


dump_daily_task = PythonOperator(
    task_id='dump_daily_data',
    python_callable=dump_daily_data,
    dag=dag,
)

dump_news_task = PythonOperator(
    task_id='dump_news',
    python_callable=dump_news,
    dag=dag,
)

# Parallel execution
[dump_daily_task, dump_news_task]
