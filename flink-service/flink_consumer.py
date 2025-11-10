from pyflink.table import EnvironmentSettings, StreamTableEnvironment
import sys, signal, logging, json, datetime
from datetime import timezone
from pyflink.common import Configuration, Time, Types
from pyflink.datastream import StreamExecutionEnvironment, OutputTag
from pyflink.datastream.functions import KeyedProcessFunction, RuntimeContext, MapFunction
from pyflink.datastream.state import ValueStateDescriptor, StateTtlConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class BaseScyllaSink(MapFunction):
    def __init__(self):
        self._cluster = None
        self._session = None
        self._stmts = {}

    def open(self, runtime_context: RuntimeContext):
        """Khởi tạo connection Cassandra/Scylla tại task manager"""
        from cassandra.cluster import Cluster
        from cassandra.policies import DCAwareRoundRobinPolicy
        self._cluster = Cluster(
            ["scylla-node1","scylla-node2","scylla-node3"], 
            port=9042, 
            load_balancing_policy=DCAwareRoundRobinPolicy(),
            protocol_version=4,
            compression=True,
            executor_threads=4
            )
        self._session = self._cluster.connect("stock_data")
        self._session.default_timeout = 10
        self._prepare_statements()
        
    def _prepare_statements(self):
        raise NotImplementedError("Subclasses must implement _prepare_statements")

    def map(self, value):
        try:
            # self._get_connection()
            # Sử dụng execute_async cho tốc độ cao
            self._process_record_async(value)
        except Exception as e:
            logger.error(f"❌ {self.__class__.__name__} error: {e}")
        return value

    def _process_record_async(self, value):
        try:
            # Gọi process_record và sử dụng async execution trong đó
            self._process_record(value)
        except Exception as e:
            logger.error(f"❌ Async processing error: {e}")

    def _process_record(self, value):
        raise NotImplementedError("Subclasses must implement _process_record")

    def close(self):
        if self._session and not self._session.is_shutdown:
            self._session.shutdown()
        if self._cluster:
            self._cluster.shutdown()

    def __del__(self):
        try:
            self.close()
        except:
            pass



# Sink for Raw Stock Prices
class StockPricesSink(BaseScyllaSink):
    def _prepare_statements(self):
        self._stmts = {
            'prices': self._session.prepare(
                "INSERT INTO stock_prices (symbol, timestamp, change, change_percent, day_volume, exchange, last_size, market_hours, price, price_hint, quote_type, producer_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
        }

    def _process_record(self, value):
        symbol, price, timestamp_str, exchange, quote_type, market_hours, change_percent, day_volume, change, last_size, price_hint, producer_timestamp = value
        
        ts_str = str(timestamp_str) if not isinstance(timestamp_str, str) else timestamp_str

        # Insert into stock_prices với async
        future = self._session.execute_async(self._stmts['prices'], [
            str(symbol), str(ts_str), round(float(change), 2), round(float(change_percent), 2), 
            int(day_volume), str(exchange), int(last_size), int(market_hours), 
            round(float(price), 2), str(price_hint), int(quote_type),
            int(producer_timestamp) if producer_timestamp else None
        ])



# Sink for Latest Stock Prices
class StockLatestSink(BaseScyllaSink):
    def _prepare_statements(self):
        self._stmts = {
            'latest': self._session.prepare(
                "INSERT INTO stock_latest_prices (symbol, change, change_percent, day_volume, exchange, last_size, market_hours, price, price_hint, quote_type, timestamp, producer_timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
        }

    def _process_record(self, value):
        symbol, price, timestamp_str, exchange, quote_type, market_hours, change_percent, day_volume, change, last_size, price_hint, producer_timestamp = value
        
        ts_str = str(timestamp_str) if not isinstance(timestamp_str, str) else timestamp_str
        try:
            ts_numeric = int(ts_str) if ts_str.isdigit() else int(float(ts_str))
            ts_datetime = datetime.datetime.fromtimestamp(
                ts_numeric / 1000 if ts_numeric > 1000000000000 else ts_numeric
            )
        except:
            ts_datetime = datetime.datetime.now()

        # Insert into stock_latest_prices với async
        future = self._session.execute_async(self._stmts['latest'], [
            str(symbol), round(float(change), 2), round(float(change_percent), 2), int(day_volume), 
            str(exchange), int(last_size), int(market_hours), round(float(price), 2), 
            str(price_hint), int(quote_type), ts_datetime,
            int(producer_timestamp) if producer_timestamp else None
        ])
        return future



# Sink for Aggregated Stock Prices
class StockAggSink(BaseScyllaSink):
    def _prepare_statements(self):
        self._stmts = {
            'agg': self._session.prepare(
                "INSERT INTO stock_prices_agg (symbol, bucket_date, interval, ts, close, high, low, open, volume, vwap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
        }

    def _process_record(self, value):
        # Field order: symbol, bucket_date, interval_type, ts, open_price, close_price, high_price, low_price, volume, vwap
        symbol, bucket_date, interval_type, ts, open_price, close_price, high_price, low_price, volume, vwap = value

        # Insert into stock_prices_agg với async
        future = self._session.execute_async(self._stmts['agg'], [
            str(symbol), bucket_date, str(interval_type), ts,
            round(float(close_price), 2), round(float(high_price), 2), round(float(low_price), 2), 
            round(float(open_price), 2), int(volume), round(float(vwap), 2)
        ])
        return future
        
        
        
# Sink for Daily Summary
class StockDailySink(BaseScyllaSink):
    def _prepare_statements(self):
        self._stmts = {
            # Upsert statement cho continuous updates
            'summary': self._session.prepare(
                "INSERT INTO stock_daily_summary (symbol, trade_date, change, change_percent, close, exchange, high, low, market_hours, open, quote_type, volume, vwap) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )
        }

    def _process_record(self, value):
        # Xử lý stateful aggregated data từ StatefulDailyAggregator
        try:
            # Stateful data format: symbol, trade_date, tick_count, open_price, close_price, high_price, low_price, total_volume, vwap_price
            symbol, trade_date, tick_count, open_price, close_price, high_price, low_price, total_volume, vwap_price = value
            
            # Log continuous update
            if tick_count % 100 == 0:  # Log mỗi 100 ticks
                logger.info(f"Continuous daily update: {symbol} - {tick_count} ticks, OHLC: {open_price:.2f}/{high_price:.2f}/{low_price:.2f}/{close_price:.2f}")
                
        except (ValueError, TypeError):
            # Fallback: xử lý trường hợp thiếu tick_count
            try:
                symbol, trade_date, open_price, close_price, high_price, low_price, total_volume, vwap_price = value[:8]
                tick_count = 1
            except (ValueError, TypeError):
                logger.error(f"Stateful daily data processing error: Invalid format, value: {value}")
                return
        
        # Xử lý dữ liệu an toàn với kiểm tra null và conversion
        try:
            safe_open = max(0.0, float(open_price)) if open_price is not None else 0.0
            safe_close = max(0.0, float(close_price)) if close_price is not None else 0.0
            safe_high = max(0.0, float(high_price)) if high_price is not None else 0.0
            safe_low = max(0.0, float(low_price)) if low_price is not None else 0.0
            safe_volume = max(0, int(total_volume)) if total_volume is not None else 0
            safe_vwap = max(0.0, float(vwap_price)) if vwap_price is not None else 0.0
            
            # Tính change và change_percent từ aggregated data
            final_change = round(safe_close - safe_open, 2) if safe_open > 0 else 0.0
            final_change_percent = round((final_change / safe_open * 100), 2) if safe_open > 0 else 0.0
            
            # Đảm bảo high >= max(open, close) và low <= min(open, close)
            final_high = max(safe_high, safe_open, safe_close)
            final_low = min(safe_low, safe_open, safe_close) if safe_low > 0 else min(safe_open, safe_close)
            
            # Fix trade_date format - chỉ lấy phần date
            if isinstance(trade_date, str):
                # Nếu là '2025-09-17 19:06:30' thì lấy '2025-09-17'
                clean_trade_date = trade_date.split()[0] if ' ' in trade_date else trade_date
            else:
                clean_trade_date = str(trade_date)
                
            # Insert into stock_daily_summary với async
            future = self._session.execute_async(self._stmts['summary'], [
                str(symbol), clean_trade_date, final_change, final_change_percent, 
                round(safe_close, 2), 'NASDAQ',  # exchange default 
                round(final_high, 2), round(final_low, 2), 
                1,  # market_hours default
                round(safe_open, 2), 1,  # quote_type default
                safe_volume, round(safe_vwap, 2)
            ])
            return future
            
        except (ValueError, TypeError, AttributeError) as e:
            logger.error(f"Daily data processing error: {e}, value: {value}")
            


# Output types
DAILY_OUTPUT_TYPE = Types.TUPLE([Types.STRING(), Types.STRING(), Types.INT(), Types.FLOAT(), Types.FLOAT(), Types.FLOAT(), Types.FLOAT(), Types.LONG(), Types.FLOAT()])
MINUTE_OUTPUT_TYPE = Types.TUPLE([Types.STRING(), Types.STRING(), Types.STRING(), Types.SQL_TIMESTAMP(), Types.FLOAT(), Types.FLOAT(), Types.FLOAT(), Types.FLOAT(), Types.LONG(), Types.FLOAT()])
RAW_INPUT_TYPE = Types.TUPLE([Types.STRING(), Types.FLOAT(), Types.STRING(), Types.STRING(), Types.INT(), Types.INT(), Types.FLOAT(), Types.LONG(), Types.FLOAT(), Types.LONG(), Types.STRING(), Types.LONG()])
# Output tags cho side outputs
DailyFinalOutputTag = OutputTag("daily-final", DAILY_OUTPUT_TYPE)
MinuteFinalOutputTag = OutputTag("minute-final", MINUTE_OUTPUT_TYPE)



def parse_timestamp(ts):
    '''Chuyển đổi timestamp từ string hoặc số sang epoch milliseconds'''
    if isinstance(ts, str):
        if ts.isdigit(): return int(ts)
        return int(datetime.datetime.fromisoformat(ts.replace('Z', '+00:00')).timestamp() * 1000)
    return int(ts)

def get_datetime(ts):
    '''Chuyển đổi timestamp từ string hoặc số sang datetime với timezone UTC'''
    if isinstance(ts, str):
        if ts.isdigit():  # Nếu là chuỗi số
            ts = int(ts)
            # Nếu timestamp lớn hơn 10^10, coi là milliseconds
            if ts > 1e10:
                ts /= 1000
            return datetime.datetime.fromtimestamp(ts, tz=timezone.utc)
        else:  # ISO format
            return datetime.datetime.fromisoformat(ts.replace('Z', '+00:00'))
    elif isinstance(ts, (int, float)):
        # Nếu timestamp lớn hơn 10^10, coi là milliseconds
        if ts > 1e10:
            ts /= 1000
        return datetime.datetime.fromtimestamp(ts, tz=timezone.utc)
    else:
        raise ValueError("Timestamp không hợp lệ")

def get_trade_date(ts): 
    '''Chuyển đổi timestamp từ string hoặc số sang ngày giao dịch'''
    return get_datetime(ts).strftime('%Y-%m-%d')

def get_minute_bucket(ts):
    '''Chuyển đổi timestamp từ string hoặc số sang bucket phút'''
    return get_datetime(ts).strftime('%Y-%m-%d %H:%M')


# Stateful Aggregator
class StatefulAggregator(KeyedProcessFunction):
    def __init__(self, is_daily=True):
        self.is_daily = is_daily

    def open(self, ctx: RuntimeContext):
        ttl = Time.days(2) if self.is_daily else Time.hours(2)
        self.state = ctx.get_state(ValueStateDescriptor(
            "stock_state",
            Types.STRING() if self.is_daily else Types.TUPLE([
                Types.STRING(), Types.FLOAT(), Types.FLOAT(), Types.FLOAT(),
                Types.FLOAT(), Types.LONG(), Types.DOUBLE(), Types.DOUBLE()
            ])
        ))
        self.state.enable_time_to_live(StateTtlConfig.new_builder(ttl).build())
        self.timer_state = ctx.get_state(ValueStateDescriptor("timer", Types.LONG()))

    def process_element(self, value, ctx):
        symbol, price, timestamp, exchange, quote_type, market_hours, change_percent, day_volume, change, last_size, price_hint, producer_timestamp = value
        if market_hours != 1: return
        if self.is_daily:
            yield from self._process_daily(symbol, price, timestamp, exchange, market_hours, day_volume, last_size, ctx)
        else:
            yield from self._process_minute(symbol, price, timestamp, day_volume, last_size, ctx)

    def on_timer(self, timestamp, ctx):
        state = self.state.value()
        if not state: return
        if not self.is_daily:
            bucket_time, o,h,l,c,v,ws,vwap = state
            ctx.output(MinuteFinalOutputTag, (
                ctx.get_current_key(), bucket_time.split()[0], '1m',
                datetime.datetime.strptime(bucket_time, '%Y-%m-%d %H:%M'),
                round(o,2), round(c,2), round(h,2), round(l,2), int(v), round(vwap,2)
            ))
        self.state.clear()
        self.timer_state.clear()

    # --- Internal processing functions ---
    def _process_daily(self, symbol, price, timestamp, exchange, market_hours, day_volume, last_size, ctx):
        state_json = self.state.value()
        trade_date = get_trade_date(timestamp)

        if not state_json or json.loads(state_json).get('trade_date') != trade_date:
            state = {
                'open_price': price, 
                'high_price': price, 
                'low_price': price, 
                'close_price': price,
                'total_volume': day_volume,  
                'weighted_price_sum': price * last_size,
                'vwap': price,
                'tick_count': 1,
                'trade_date': trade_date,
                'exchange': exchange,
                'market_hours': market_hours,
                'quote_type': 'stock'
            }
        else:
            state = json.loads(state_json)
            state['high_price'] = max(state['high_price'], price)
            state['low_price'] = min(state['low_price'], price)
            state['close_price'] = price
            state['total_volume'] = day_volume  # fix
            state['weighted_price_sum'] += price * last_size
            state['vwap'] = state['weighted_price_sum'] / state['total_volume'] if state['total_volume'] > 0 else price
            state['tick_count'] += 1
        self.state.update(json.dumps(state))
        # yield trực tiếp để sink có thể insert ngay
        yield (
            symbol, state['trade_date'], state['tick_count'],
            round(state['open_price'], 2), round(state['close_price'], 2),
            round(state['high_price'], 2), round(state['low_price'], 2),
            state['total_volume'], round(state['vwap'], 2)
        )
        self._set_timer(timestamp, ctx, daily=True)

    def _process_minute(self, symbol, price, timestamp, day_volume, last_size, ctx):
        bucket = get_minute_bucket(timestamp)
        state = self.state.value()

        if not state or state[0] != bucket:
            state = (bucket, price, price, price, price, last_size, price * last_size, price)
        else:
            _, o, h, l, c, v, ws, vwap = state
            h = max(h, price)
            l = min(l, price)
            c = price
            v += last_size
            ws += price * last_size
            vwap = ws / v if v > 0 else price
            state = (bucket, o, h, l, c, v, ws, vwap)

        self.state.update(state)
        ts = datetime.datetime.strptime(bucket, '%Y-%m-%d %H:%M')
        # yield luôn mỗi tick
        yield (
            symbol, bucket.split()[0], '1m', ts,
            round(state[1], 2), round(state[4], 2),
            round(state[2], 2), round(state[3], 2),
            int(state[5]), round(state[7], 2)
        )
        self._set_timer(bucket, ctx, daily=False)

    def _set_timer(self, ts, ctx, daily=True):
        if self.timer_state.value() is not None: return
        dt = get_datetime(ts) if daily else datetime.datetime.strptime(ts,'%Y-%m-%d %H:%M')
        target = dt.replace(hour=23,minute=59,second=59,microsecond=0) if daily else dt.replace(second=59,microsecond=999999)
        ctx.timer_service().register_event_time_timer(int(target.timestamp()*1000))
        self.timer_state.update(int(target.timestamp()*1000))
        

def main():
    env = StreamExecutionEnvironment.get_execution_environment()
    env.set_parallelism(12)
    config = Configuration()
    st_env = StreamTableEnvironment.create(env, environment_settings=EnvironmentSettings.new_instance().in_streaming_mode().with_configuration(config).build())

    ddl = """
        CREATE TABLE yfinance_source (
        symbol STRING,
        price FLOAT,
        `timestamp` STRING,
        exchange STRING,
        quote_type INT,
        market_hours INT,
        change_percent FLOAT,
        day_volume BIGINT,
        change FLOAT,
        last_size BIGINT,
        price_hint STRING,
        producer_timestamp BIGINT,
        event_time AS TO_TIMESTAMP(`timestamp`),
        proc_time AS PROCTIME()
        ) WITH (
            'connector' = 'kafka',
            'topic' = 'yfinance',
            'properties.bootstrap.servers' = 'broker-1:19092,broker-2:19092,broker-3:19092',
            'properties.group.id' = 'flink-simple-reader',
            'scan.startup.mode' = 'latest-offset',
            'format' = 'avro-confluent',
            'avro-confluent.url' = 'http://schema-registry:8081'
        )
    """
    st_env.execute_sql(ddl)
    
    raw_table = st_env.sql_query("SELECT symbol, price, `timestamp`, exchange, quote_type, market_hours, change_percent, day_volume, change, last_size, price_hint, producer_timestamp, event_time, proc_time FROM yfinance_source WHERE price > 0 AND day_volume > 0 AND price < 1000000 AND ABS(change_percent) < 50")
    
    logger.info("=== Creating Data Streams ===")
    raw_stream = st_env.to_data_stream(raw_table).map(
        lambda r: (
            r[0], float(r[1]), r[2], r[3], int(r[4]),
            int(r[5]), float(r[6]), int(r[7]), float(r[8]), int(r[9]), r[10],
            int(r[11]) if r[11] else None
        ), output_type=RAW_INPUT_TYPE
    )
    
    daily_stream = raw_stream.key_by(lambda r: r[0]).process(StatefulAggregator(is_daily=True), output_type=DAILY_OUTPUT_TYPE)
    minute_stream = raw_stream.key_by(lambda r: r[0]).process(StatefulAggregator(is_daily=False), output_type=MINUTE_OUTPUT_TYPE)
    
    
    raw_stream.map(StockPricesSink(), output_type=RAW_INPUT_TYPE)
    raw_stream.key_by(lambda r: r[0]).reduce(lambda a, b: b).map(StockLatestSink(), output_type=RAW_INPUT_TYPE)
    daily_stream.map(StockDailySink(), output_type=DAILY_OUTPUT_TYPE)
    minute_stream.map(StockAggSink(), output_type=MINUTE_OUTPUT_TYPE)
    
    # Bắt tín hiệu dừng để thoát sạch
    logger.info("=== Starting Job Execution ===")
    signal.signal(signal.SIGINT, lambda s, f: sys.exit(0))
    signal.signal(signal.SIGTERM, lambda s, f: sys.exit(0))
    
    try:
        env.execute("Stock Processing Pipeline - Tumbling Window Daily Aggregation")
    except KeyboardInterrupt:
        logger.info("Job interrupted by user")
    except Exception as e:
        logger.error(f"Job failed: {e}")
        raise

if __name__ == "__main__":
    main()
