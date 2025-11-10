from cassandra.cluster import Cluster
from cassandra.auth import PlainTextAuthProvider
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ScyllaDBSetup:
    def __init__(self):
        # Use container names when running in Docker, localhost when running from host
        import os
        in_docker = os.environ.get('RUNNING_IN_DOCKER', 'false').lower() == 'true'
        self.contact_points = ['scylla-node1', 'scylla-node2', 'scylla-node3'] if in_docker else ['localhost']
        self.port = 9042 
        self.keyspace = 'stock_data'
        
    def connect_to_cluster(self, max_retries=30, retry_delay=5):
        """Connect to ScyllaDB cluster với retry logic"""
        from cassandra.policies import DCAwareRoundRobinPolicy
        
        for attempt in range(max_retries):
            try:
                cluster = Cluster(
                    contact_points=self.contact_points,
                    port=self.port,
                    protocol_version=4,
                    load_balancing_policy=DCAwareRoundRobinPolicy(local_dc='datacenter1')
                )
                session = cluster.connect()
                logger.info(f"Connected to ScyllaDB cluster on attempt {attempt + 1}")
                return cluster, session
            except Exception as e:
                logger.warning(f"Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(retry_delay)
                continue
        
        raise Exception(f"Could not connect to ScyllaDB cluster after {max_retries} attempts")
    
    def create_keyspace(self, session):
        """Create keyspace if not exists"""
        create_keyspace_query = f"""
        CREATE KEYSPACE IF NOT EXISTS {self.keyspace}
        WITH REPLICATION = {{
            'class': 'NetworkTopologyStrategy',
            'datacenter1': 3
        }}
        AND TABLETS = {{'enabled': false}}
        """
        
        try:
            session.execute(create_keyspace_query)
            logger.info(f"Keyspace '{self.keyspace}' created successfully")
        except Exception as e:
            logger.error(f"Error creating keyspace: {e}")
            raise
    
    def create_tables(self, session):
        """Create required tables"""
        
        session.execute(f"USE {self.keyspace}")
        
        # Raw stock prices table - match producer schema
        create_stock_prices_table = """
        CREATE TABLE IF NOT EXISTS stock_prices (
            symbol text,
            timestamp text,
            price double,
            exchange text,
            quote_type int,
            market_hours int,
            change_percent double,
            day_volume bigint,
            change double,
            last_size bigint,
            price_hint text,
            producer_timestamp bigint,
            PRIMARY KEY (symbol, timestamp)
        ) WITH CLUSTERING ORDER BY (timestamp DESC)
        AND cdc = {
            'enabled': true,
            'preimage': false,  
            'postimage': false, 
            'ttl': '120'  
        };
        """
        
        # Aggregated data table
        create_aggregated_table = """
        CREATE TABLE IF NOT EXISTS stock_prices_agg (
            symbol text,
            bucket_date date,              -- Ngày (partition key chính)
            interval text,                 -- Khoảng tổng hợp: '1m', '5m', '1h', '1d'
            ts timestamp,                  -- Thời điểm bắt đầu của interval (ví dụ: 09:30:00)
            open double,                   -- Giá mở cửa trong interval
            high double,                   -- Giá cao nhất
            low double,                    -- Giá thấp nhất
            close double,                  -- Giá đóng cửa
            volume bigint,                 -- Tổng volume
            vwap double,                   -- Volume Weighted Avg Price (tuỳ chọn)
            PRIMARY KEY ((symbol, bucket_date, interval), ts)
        ) WITH CLUSTERING ORDER BY (ts ASC)
        AND cdc = {'enabled': false};
        """
        
        # Daily summary table - with producer fields
        create_daily_summary_table = """
        CREATE TABLE IF NOT EXISTS stock_daily_summary (
            symbol text,
            trade_date date,
            open double,
            high double,
            low double,
            close double,
            volume bigint,
            change double,
            change_percent double,
            vwap double,
            exchange text,
            quote_type int,
            market_hours int,
            PRIMARY KEY (symbol, trade_date)
        ) WITH CLUSTERING ORDER BY (trade_date DESC)
        AND cdc = {'enabled': false};
        """
        
        # Latest prices table - match producer schema
        create_latest_prices_table = """
        CREATE TABLE IF NOT EXISTS stock_latest_prices (
            symbol text PRIMARY KEY,
            price double,
            timestamp timestamp,
            exchange text,
            quote_type int,
            market_hours int,
            change_percent double,
            day_volume bigint,
            change double,
            last_size bigint,
            price_hint text,
            producer_timestamp bigint
        ) WITH cdc = {
            'enabled': true,
            'preimage': false,  
            'postimage': false, 
            'ttl': '120'
        };
        """
        
        # News table - for storing crawled news
        create_news_table = """
        CREATE TABLE IF NOT EXISTS stock_news (
                article_id text,
                stock_code text,
                title text,
                link text,
                date timestamp,
                is_pdf boolean,
                content text,
                sentiment_score float,
                pdf_link text,
                crawled_at timestamp,
                PRIMARY KEY (stock_code, date, article_id)
            ) WITH CLUSTERING ORDER BY (date DESC, article_id DESC)
            AND cdc = {'enabled': false};
        """
        
        tables = [
            ("stock_prices", create_stock_prices_table),
            ("stock_aggregated", create_aggregated_table),
            ("daily_summary", create_daily_summary_table),
            ("latest_prices", create_latest_prices_table),
            ("stock_news", create_news_table)
        ]
        
        for table_name, create_query in tables:
            try:
                session.execute(create_query)
                logger.info(f"Table '{table_name}' created successfully")
            except Exception as e:
                logger.error(f"Error creating table '{table_name}': {e}")
                raise
    
    def create_indexes(self, session):
        """Create indexes for better query performance"""
        
        # Index on exchange for stock_prices
        create_exchange_index = """
        CREATE INDEX IF NOT EXISTS ON stock_prices (exchange)
        """
        
        # Index on trade_date for stock_daily_summary
        create_date_index = """
        CREATE INDEX IF NOT EXISTS ON stock_daily_summary (trade_date)
        """
        
        indexes = [
            ("exchange_idx", create_exchange_index),
            ("date_idx", create_date_index)
        ]
        
        for index_name, create_query in indexes:
            try:
                session.execute(create_query)
                logger.info(f"Index '{index_name}' created successfully")
            except Exception as e:
                logger.warning(f"Error creating index '{index_name}': {e}")
    
    def verify_setup(self, session):
        """Verify the setup by describing tables"""
        
        session.execute(f"USE {self.keyspace}")
        
        # Get all tables in keyspace
        tables_query = """
        SELECT table_name FROM system_schema.tables 
        WHERE keyspace_name = %s
        """
        
        try:
            rows = session.execute(tables_query, [self.keyspace])
            tables = [row.table_name for row in rows]
            
            logger.info(f"Tables in keyspace '{self.keyspace}': {tables}")
            
            # Describe each table
            for table in tables:
                describe_query = f"DESCRIBE TABLE {self.keyspace}.{table}"
                try:
                    result = session.execute(describe_query)
                    logger.info(f"Table '{table}' structure verified")
                except Exception as e:
                    logger.warning(f"Could not describe table '{table}': {e}")
                    
        except Exception as e:
            logger.error(f"Error verifying setup: {e}")
    
    def setup(self):
        """Run complete setup"""
        logger.info("Starting ScyllaDB setup...")
        
        # Wait for ScyllaDB cluster to be ready
        logger.info("Waiting for ScyllaDB cluster to be ready...")
        
        try:
            # Connect to cluster
            cluster, session = self.connect_to_cluster()
            
            # Create keyspace
            self.create_keyspace(session)
            
            # Create tables
            self.create_tables(session)
            
            # Wait for CDC metadata to sync across cluster
            logger.info("Waiting for CDC metadata to sync across cluster...")
            time.sleep(10)
            
            # Create indexes
            self.create_indexes(session)
            
            # Verify setup
            self.verify_setup(session)
            
            logger.info("ScyllaDB setup completed successfully!")
            
        except Exception as e:
            logger.error(f"Setup failed: {e}")
            raise
        finally:
            if 'cluster' in locals():
                cluster.shutdown()

def main():
    setup = ScyllaDBSetup()
    setup.setup()

if __name__ == "__main__":
    main()