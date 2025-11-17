import asyncio
from ...db import get_db
from fastapi import WebSocket, WebSocketDisconnect, Depends, APIRouter, Response
from cassandra.util import Date 
import datetime
import json
import logging
import yfinance as yf
import psycopg2
import os
import time
from prometheus_client import Histogram, Counter, Gauge, generate_latest, CONTENT_TYPE_LATEST
from zoneinfo import ZoneInfo

logger = logging.getLogger(__name__)

stock_router = APIRouter()

cdc_latency = Histogram('cdc_latency_ms', 'CDC end-to-end latency', ['symbol'], buckets=[10,50,100,200,500,1000,2000,5000])
cdc_events = Counter('cdc_events_total', 'Total CDC events', ['symbol'])
cdc_connections = Gauge('cdc_active_connections', 'Active WebSocket connections')

def in_trading_hours():
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.datetime.now(vn_tz)
    weekday = now.weekday()
    trading_time = now.time()
    hour = now.hour
    minute = now.minute
    if weekday >= 5: 
        return False
    start = datetime.time(9, 0)
    end = datetime.time(15, 0)
    is_trading = start <= trading_time < end
    return is_trading


def next_trading_time():
    """Tính thời điểm tiếp theo cần chạy CDC (start hoặc end)"""
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.datetime.now(vn_tz)
    if in_trading_hours():
        end_time = datetime.datetime.combine(now.date(), datetime.time(15, 0))
        if end_time > now:
            return end_time
        next_day = now + datetime.timedelta(days=1)
        return datetime.datetime.combine(next_day.date(), datetime.time(9, 0))
    weekday = now.weekday()
    if weekday >= 5:
        days_until_monday = 7 - weekday
        next_date = now.date() + datetime.timedelta(days=days_until_monday)
        return datetime.datetime.combine(next_date, datetime.time(9, 0))
    if now.time() < datetime.time(9, 0):
        return datetime.datetime.combine(now.date(), datetime.time(9, 0))
    next_day = now + datetime.timedelta(days=1)
    return datetime.datetime.combine(next_day.date(), datetime.time(9, 0)) 

def cassandra_date_to_iso(cass_date):
    """
    Chuyển cassandra.util.Date sang string ISO yyyy-mm-dd
    """
    if isinstance(cass_date, Date):
        dt = datetime.date(1970, 1, 1) + datetime.timedelta(days=cass_date.days_from_epoch)
        return dt.isoformat()
    return cass_date


@stock_router.get("/metrics")
async def metrics():
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
    

@stock_router.get("/get_reference")
async def read_stocks(db=Depends(get_db)):
    query = "SELECT symbol, trade_date, open, high, low, close, volume FROM stock_daily_summary where trade_date = %s"
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.datetime.now(vn_tz)
    # Xác định ngày giao dịch gần nhất (tránh cuối tuần)
    trading_date = now.date()
    if now.hour < 9 :
        trading_date = trading_date - datetime.timedelta(days=1)
        while trading_date.weekday() >= 4:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 3))
    else:
        if trading_date.weekday() >= 5:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 3))
        elif trading_date.weekday() == 0:
            trading_date = trading_date - datetime.timedelta(days=3)
        else:
            trading_date = trading_date - datetime.timedelta(days=1)
    rows = db.execute(query, (trading_date,))
    results = []
    for row in rows:
        results.append({
            "symbol": row.symbol.split(".")[0],
            "trade_date": cassandra_date_to_iso(row.trade_date),
            "close": row.close,
            "open": row.open,
            "high": row.high,
            "low": row.low,
            "volume": row.volume
        })
    # Sắp xếp theo symbol
    results = sorted(results, key=lambda x: x["symbol"])
    return results


@stock_router.get("/get_stocks")
async def read_stocks(db=Depends(get_db)):
    query = "SELECT symbol, trade_date, open, high, low, close, volume FROM stock_daily_summary where trade_date = %s"
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.datetime.now(vn_tz)
    # Xác định ngày giao dịch gần nhất (tránh cuối tuần)
    trading_date = now.date()
    if now.hour < 9:
        if trading_date.weekday() >= 5:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 4))
        elif trading_date.weekday() == 0:
            trading_date = trading_date - datetime.timedelta(days=3)
        else:
            trading_date = trading_date - datetime.timedelta(days=1)
    else:
        if trading_date.weekday() >= 5:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 4))
    rows = db.execute(query, (trading_date,))
    results = []
    for row in rows:
        results.append({
            "symbol": row.symbol.split(".")[0],
            "trade_date": cassandra_date_to_iso(row.trade_date),
            "close": row.close,
            "open": row.open,
            "high": row.high,
            "low": row.low,
            "volume": row.volume
        })
    # Sắp xếp theo symbol
    results = sorted(results, key=lambda x: x["symbol"])
    return results


@stock_router.get("/stocks_latest")
async def read_stocks_latest(db=Depends(get_db)):
    query = "SELECT * FROM stock_latest_prices"
    rows = db.execute(query)
    def row_to_dict(row):
        return {
            "symbol": row.symbol,
            "price": row.price,
            "change": row.change,
            "change_percent": row.change_percent,
            "day_volume": row.day_volume,
            "last_size": row.last_size if hasattr(row, 'last_size') else 0,
            'exchange': row.exchange,
            'timestamp': row.timestamp
        }
    # Sắp xếp theo symbol
    rows = sorted(rows.all(), key=lambda x: x.symbol)
    return [row_to_dict(row) for row in rows]


# Top 10 stocks by volume today
@stock_router.get("/stocks_VN30")
async def read_vn30_stocks(db=Depends(get_db)):
    VN30_LIST = ["ACB.VN","BCM.VN","BID.VN","CTG.VN","DGC.VN","FPT.VN","GAS.VN","GVR.VN","HDB.VN","HPG.VN","LPB.VN","MBB.VN","MSN.VN","MWG.VN","PLX.VN","SAB.VN","SHB.VN","SSB.VN","SSI.VN","STB.VN","TCB.VN","TPB.VN","VCB.VN","VHM.VN","VIB.VN","VIC.VN","VJC.VN","VNM.VN","VPB.VN","VRE.VN"]
    symbols_str = "', '".join(VN30_LIST)
    query = f"SELECT * FROM stock_latest_prices WHERE symbol IN ('{symbols_str}')"
    rows = db.execute(query)
    def row_to_dict(row):
        return {
            "symbol": row.symbol,
            "price": row.price,
            "change": row.change,
            "change_percent": row.change_percent,
            "day_volume": row.day_volume,
            "last_size": row.last_size if hasattr(row, 'last_size') else 0,
            'exchange': row.exchange,
            'timestamp': row.timestamp
        }
    return [row_to_dict(row) for row in rows.all()]


# Top 5 gainers, losers
@stock_router.get("/stocks_gainers_losers")
async def read_gainers_losers(db=Depends(get_db)):
    query = "SELECT * FROM stock_latest_prices"
    rows = db.execute(query)
    sorted_rows = sorted(rows.all(), key=lambda x: x.change_percent if x.change_percent is not None else 0, reverse=True)
    gainers = sorted_rows[:5]
    losers = sorted_rows[-5:][::-1]
    def row_to_dict(row):
        return {
            "symbol": row.symbol.split(".")[0],
            "price": row.price,
            "change": row.change,
            "change_percent": row.change_percent,
            "day_volume": row.day_volume,
            'exchange': row.exchange,
            'timestamp': row.timestamp
        }
    return {"gainers": [row_to_dict(row) for row in gainers], "losers": [row_to_dict(row) for row in losers]}


@stock_router.get("/stock_price_by_symbol")
async def read_stock_price_by_symbol(symbol: str, db=Depends(get_db)):
    vn_tz = ZoneInfo("Asia/Ho_Chi_Minh")
    now = datetime.datetime.now(vn_tz)
    # Xác định ngày giao dịch gần nhất (tránh cuối tuần)
    trading_date = now.date()
    if now.hour < 9:
        if trading_date.weekday() >= 5:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 4))
        elif trading_date.weekday() == 0:
            trading_date = trading_date - datetime.timedelta(days=3)
        else:
            trading_date = trading_date - datetime.timedelta(days=1)
    else:
        if trading_date.weekday() >= 5:
            trading_date = trading_date - datetime.timedelta(days=int(trading_date.weekday() - 4))
    # Lấy dữ liệu từ 9h đến 15h của ngày giao dịch (dùng VN timezone)
    start_dt = datetime.datetime.combine(trading_date, datetime.time(9, 0, 0), tzinfo=vn_tz)
    end_dt = datetime.datetime.combine(trading_date, datetime.time(15, 0, 0), tzinfo=vn_tz)
    start_timestamp_ms = str(int(start_dt.timestamp() * 1000))
    end_timestamp_ms = str(int(end_dt.timestamp() * 1000))
    query = "SELECT * FROM stock_prices WHERE symbol = %s AND timestamp >= %s AND timestamp <= %s;"
    rows = db.execute(query, (symbol + ".VN", start_timestamp_ms, end_timestamp_ms))
    def row_to_dict(row):
        return {
            "symbol": row.symbol,
            "timestamp": row.timestamp,
            "price": row.price,
            "change": row.change,
            "change_percent": row.change_percent,
            "day_volume": row.day_volume,
            "last_size": row.last_size,
        }
    return [row_to_dict(row) for row in rows.all()]


@stock_router.get("/stock_info/{symbol}")
async def get_stock_info(symbol: str):
    try:
        ticker = yf.Ticker(f'{symbol}.VN')
        info = ticker.info
        
        company_officers = []
        if 'companyOfficers' in info and info['companyOfficers']:
            for officer in info['companyOfficers']:
                company_officers.append({
                    'name': officer.get('name'),
                    'age': officer.get('age'),
                    'title': officer.get('title'),
                    'yearBorn': officer.get('yearBorn')
                })
        
        return {
            'symbol': symbol,
            'shortName': info.get('shortName', ''),
            'longName': info.get('longName', ''),
            'exchange': info.get('exchange', ''),
            'currency': info.get('currency', 'VND'),
            
            'address1': info.get('address1'),
            'address2': info.get('address2'),
            'city': info.get('city'),
            'country': info.get('country'),
            'phone': info.get('phone'),
            'website': info.get('website'),
            
            'industry': info.get('industry'),
            'industryDisp': info.get('industryDisp'),
            'sector': info.get('sector'),
            'sectorDisp': info.get('sectorDisp'),
            'longBusinessSummary': info.get('longBusinessSummary'),
            'fullTimeEmployees': info.get('fullTimeEmployees'),
            'companyOfficers': company_officers,
            
            'currentPrice': info.get('currentPrice', info.get('regularMarketPrice', 0)),
            'previousClose': info.get('previousClose', 0),
            'open': info.get('open', info.get('regularMarketOpen', 0)),
            'dayLow': info.get('dayLow', info.get('regularMarketDayLow', 0)),
            'dayHigh': info.get('dayHigh', info.get('regularMarketDayHigh', 0)),
            
            'volume': info.get('volume', info.get('regularMarketVolume', 0)),
            'averageVolume': info.get('averageVolume', 0),
            
            'marketCap': info.get('marketCap'),
            'enterpriseValue': info.get('enterpriseValue'),
            'beta': info.get('beta'),
            
            'fiftyTwoWeekLow': info.get('fiftyTwoWeekLow'),
            'fiftyTwoWeekHigh': info.get('fiftyTwoWeekHigh'),
            'fiftyDayAverage': info.get('fiftyDayAverage'),
            'twoHundredDayAverage': info.get('twoHundredDayAverage'),
            
            'trailingPE': info.get('trailingPE'),
            'priceToBook': info.get('priceToBook'),
            'dividendYield': info.get('dividendYield'),
            'dividendRate': info.get('dividendRate'),
            'payoutRatio': info.get('payoutRatio'),
            
            'totalRevenue': info.get('totalRevenue'),
            'revenuePerShare': info.get('revenuePerShare'),
            'revenueGrowth': info.get('revenueGrowth'),
            'grossMargins': info.get('grossMargins'),
            'ebitdaMargins': info.get('ebitdaMargins'),
            'operatingMargins': info.get('operatingMargins'),
            'profitMargins': info.get('profitMargins'),
            
            'totalCash': info.get('totalCash'),
            'totalDebt': info.get('totalDebt'),
            'debtToEquity': info.get('debtToEquity'),
            'currentRatio': info.get('currentRatio'),
            'quickRatio': info.get('quickRatio'),
            
            'returnOnAssets': info.get('returnOnAssets'),
            'returnOnEquity': info.get('returnOnEquity'),
            'freeCashflow': info.get('freeCashflow'),
            'operatingCashflow': info.get('operatingCashflow'),
            
            'earningsGrowth': info.get('earningsGrowth'),
            'epsTrailingTwelveMonths': info.get('epsTrailingTwelveMonths'),
            
            'bookValue': info.get('bookValue'),
            'sharesOutstanding': info.get('sharesOutstanding'),
            'floatShares': info.get('floatShares'),
            'heldPercentInsiders': info.get('heldPercentInsiders'),
            'heldPercentInstitutions': info.get('heldPercentInstitutions')
        }
    except Exception as e:
        logger.error(f"Error fetching stock info for {symbol}: {e}")
        return {"error": str(e)}


@stock_router.get("/stock_daily_by_symbol")
async def get_stock_daily_by_symbol(symbol: str, from_date: str = None, to_date: str = None, db=Depends(get_db)):
    query = "SELECT * FROM stock_daily_summary WHERE symbol = %s"
    params = [symbol + ".VN"]
    
    if from_date and to_date:
        try:
            from_date_obj = datetime.datetime.strptime(from_date, "%Y-%m-%d").date()
            to_date_obj = datetime.datetime.strptime(to_date, "%Y-%m-%d").date()
            query += " AND trade_date >= %s AND trade_date <= %s"
            params.extend([from_date_obj, to_date_obj])
        except:
            pass
    
    rows = db.execute(query, tuple(params))
    def row_to_dict(row):
        return {
            "symbol": row.symbol,
            "trade_date": cassandra_date_to_iso(row.trade_date),
            "open": row.open,
            "high": row.high,
            "low": row.low,
            "close": row.close,
            "volume": row.volume
        }
    return [row_to_dict(row) for row in rows.all()]


# Lấy dữ liệu dự đoán mới nhất từ warehouse
@stock_router.get("/stock_predictions") 
async def get_stock_predictions():
    WAREHOUSE_CONFIG = {
        'host': os.getenv('WAREHOUSE_HOST', 'warehouse-db'),
        'database': os.getenv('WAREHOUSE_DB', 'warehouse'),
        'user': os.getenv('WAREHOUSE_USER', 'warehouse_user'),
        'password': os.getenv('WAREHOUSE_PASSWORD', 'warehouse_pass')
    }
    
    try:
        conn = psycopg2.connect(**WAREHOUSE_CONFIG)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT DISTINCT ON (stock_code) 
                stock_code, prediction_date, predicted_price, confidence_score 
            FROM fact_predictions 
            ORDER BY stock_code, prediction_date DESC
        """)
        
        results = []
        for row in cur.fetchall():
            results.append({
                "symbol": row[0],
                "prediction_date": row[1].isoformat(),
                "predicted_price": float(row[2]),
                "confidence_score": float(row[3]) if row[3] is not None else None
            })
            
        return results
            
    except Exception as e:
        logger.error(f"Error fetching predictions from warehouse: {e}")
        raise
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()


# Lấy tất cả dữ liệu dự đoán từ warehouse (có thể filter theo symbol)
@stock_router.get("/stock_predictions_history")
async def get_stock_predictions_history(symbol: str = None):
    WAREHOUSE_CONFIG = {
        'host': os.getenv('WAREHOUSE_HOST', 'warehouse-db'),
        'database': os.getenv('WAREHOUSE_DB', 'warehouse'),
        'user': os.getenv('WAREHOUSE_USER', 'warehouse_user'),
        'password': os.getenv('WAREHOUSE_PASSWORD', 'warehouse_pass')
    }
    
    try:
        conn = psycopg2.connect(**WAREHOUSE_CONFIG)
        cur = conn.cursor()
        
        if symbol:
            cur.execute("""
                SELECT stock_code, prediction_date, predicted_price, confidence_score 
                FROM fact_predictions 
                WHERE stock_code = %s
                ORDER BY prediction_date DESC
            """, (symbol,))
        else:
            cur.execute("""
                SELECT stock_code, prediction_date, predicted_price, confidence_score 
                FROM fact_predictions 
                ORDER BY stock_code, prediction_date DESC
            """)
        
        results = []
        for row in cur.fetchall():
            results.append({
                "symbol": row[0],
                "prediction_date": row[1].isoformat(),
                "predicted_price": float(row[2]),
                "confidence_score": float(row[3]) if row[3] is not None else None
            })
            
        return results
            
    except Exception as e:
        logger.error(f"Error fetching predictions history from warehouse: {e}")
        raise
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()


# Tính Accuracy của mô hình dự đoán
@stock_router.get("/stock_predictions_accuracy")
async def get_stock_predictions_accuracy(db=Depends(get_db)):
    WAREHOUSE_CONFIG = {
        'host': os.getenv('WAREHOUSE_HOST', 'warehouse-db'),
        'database': os.getenv('WAREHOUSE_DB', 'warehouse'),
        'user': os.getenv('WAREHOUSE_USER', 'warehouse_user'),
        'password': os.getenv('WAREHOUSE_PASSWORD', 'warehouse_pass')
    }
    
    try:
        conn = psycopg2.connect(**WAREHOUSE_CONFIG)
        cur = conn.cursor()
        
        cur.execute("""
            SELECT stock_code, prediction_date, predicted_price
            FROM fact_predictions
            ORDER BY stock_code, prediction_date
        """)
        
        predictions = cur.fetchall()
        
        price_cache = {}
        symbol_dates_map = {}
        
        for pred in predictions:
            stock_code = pred[0]
            prediction_date = pred[1]
            
            if stock_code not in symbol_dates_map:
                symbol_dates_map[stock_code] = set()
            
            symbol_dates_map[stock_code].add(prediction_date)
            
            prev_date = prediction_date - datetime.timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date = prev_date - datetime.timedelta(days=1)
            symbol_dates_map[stock_code].add(prev_date)
        
        for stock_code, dates in symbol_dates_map.items():
            symbol_with_exchange = stock_code + ".VN"
            min_date = min(dates)
            max_date = max(dates)
            
            query = "SELECT trade_date, close FROM stock_daily_summary WHERE symbol = %s AND trade_date >= %s AND trade_date <= %s"
            rows = db.execute(query, (symbol_with_exchange, min_date, max_date))
            for row in rows:
                trade_date = row.trade_date
                if hasattr(trade_date, 'date'):
                    trade_date = trade_date.date()
                price_cache[(stock_code, trade_date)] = float(row.close)
        
        results = []
        accuracy_by_symbol = {}
        
        for pred in predictions:
            stock_code = pred[0]
            prediction_date = pred[1]
            predicted_price = float(pred[2])
            
            prev_date = prediction_date - datetime.timedelta(days=1)
            while prev_date.weekday() >= 5:
                prev_date = prev_date - datetime.timedelta(days=1)
            
            prev_close = price_cache.get((stock_code, prev_date))
            actual_close = price_cache.get((stock_code, prediction_date))
            
            if prev_close is None or actual_close is None:
                continue
            
            predicted_trend = "up" if predicted_price > prev_close else ("down" if predicted_price < prev_close else "neutral")
            actual_trend = "up" if actual_close > prev_close else ("down" if actual_close < prev_close else "neutral")
            
            is_correct = predicted_trend == actual_trend
            
            if stock_code not in accuracy_by_symbol:
                accuracy_by_symbol[stock_code] = {"correct": 0, "total": 0}
            
            accuracy_by_symbol[stock_code]["total"] += 1
            if is_correct:
                accuracy_by_symbol[stock_code]["correct"] += 1
        
        for symbol, stats in accuracy_by_symbol.items():
            accuracy = (stats["correct"] / stats["total"]) * 100 if stats["total"] > 0 else 0
            results.append({
                "symbol": symbol,
                "accuracy": round(accuracy, 2),
                "correct": stats["correct"],
                "total": stats["total"]
            })
        
        results.sort(key=lambda x: x["symbol"])
        return results
        
    except Exception as e:
        logger.error(f"Error calculating predictions accuracy: {e}")
        raise
    finally:
        if 'cur' in locals():
            cur.close()
        if 'conn' in locals():
            conn.close()
    



@stock_router.get("/stock_prices_week")
async def get_stock_prices_week(symbol: str, db=Depends(get_db)):
    end_date = datetime.date.today()
    start_date = end_date - datetime.timedelta(days=7)
    weekday_end = end_date.weekday()
    if weekday_end == 5:
        end_date = end_date
    elif weekday_end == 6:
        end_date = end_date - datetime.timedelta(days=1)
    start_dt = datetime.datetime.combine(start_date, datetime.time(0, 0, 0))
    end_dt = datetime.datetime.combine(end_date, datetime.time(23, 59, 59))
    start_timestamp_ms = str(int(start_dt.timestamp() * 1000))
    end_timestamp_ms = str(int(end_dt.timestamp() * 1000))
    query = "SELECT * FROM stock_prices WHERE symbol = %s AND timestamp >= %s AND timestamp <= %s"
    rows = db.execute(query, (symbol + ".VN", start_timestamp_ms, end_timestamp_ms))
    def row_to_dict(row):
        return {
            "symbol": row.symbol,
            "timestamp": row.timestamp,
            "price": row.price,
            "change": row.change,
            "change_percent": row.change_percent,
            "day_volume": row.day_volume,
            "last_size": row.last_size,
        }
    return [row_to_dict(row) for row in rows.all()]


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        self.cdc_task: asyncio.Task = None
        self.cdc_process = None

    async def connect(self, websocket: WebSocket):
        logger.info("🔗 Manager.connect() called")
        await websocket.accept()
        self.active_connections.append(websocket)
        cdc_connections.set(len(self.active_connections))
        logger.info(f"WebSocket accepted. Total connections: {len(self.active_connections)}")
        
        if self.cdc_task is None or self.cdc_task.done():
            logger.info("🚀 Starting CDC task...")
            self.cdc_task = asyncio.create_task(self.cdc_consumer_task())
        else:
            logger.info("⏳ CDC task already running")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        cdc_connections.set(len(self.active_connections))
        
        if not self.active_connections and self.cdc_task:
            self.cdc_task.cancel()
            if self.cdc_process:
                self.cdc_process.terminate()

    async def broadcast(self, message: str):
        if not self.active_connections:
            logger.warning("No active connections to broadcast to")
            return
        
        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_text(message)
            except Exception as e:
                logger.error(f"Failed to send message to connection: {e}")
                disconnected.append(connection)
        
        for connection in disconnected:
            self.disconnect(connection)

    def parse_cdc_field(self, line: str, field_name: str):
        if f"│ {field_name}:" in line:
            parts = line.split(f"{field_name}:")
            if len(parts) > 1:
                value = parts[1].strip().split("│")[0].strip()
                if value == "null":
                    return None
                
                # Parse CDC type wrappers: BigInt(123), Double(45.6), Text("abc"), Timestamp(...)
                if value.startswith("BigInt(") and value.endswith(")"):
                    return value[7:-1]
                elif value.startswith("Double(") and value.endswith(")"):
                    return value[7:-1]
                elif value.startswith("Text(") and value.endswith(")"):
                    return value[6:-2]  # Remove Text(" and ")
                elif value.startswith("Int(") and value.endswith(")"):
                    return value[4:-1]
                elif "Timestamp(" in value and "CqlTimestamp(" in value:
                    # Format: 'Timestamp(CqlTimestamp(1761185959000))'
                    import re
                    match = re.search(r'\d+', value)
                    if match:
                        return match.group(0)
                
                return value.replace('"', '')
        return None

    async def cdc_consumer_task(self):
        try:
            cdc_bin = os.getenv('CDC_PRINTER_PATH', '/home/obito/main/scylla-cdc-printer/target/release/scylla-cdc-printer')
            cassandra_host_raw = os.getenv('CASSANDRA_HOST', 'localhost')
            keyspace = os.getenv('CASSANDRA_KEYSPACE', 'stock_data')
            
            cassandra_host = cassandra_host_raw
            if cassandra_host_raw.startswith('['):
                try:
                    import json
                    hosts = json.loads(cassandra_host_raw)
                    cassandra_host = hosts[0] if hosts else 'localhost'
                    logger.info(f"Parsed CASSANDRA_HOST from array, using: {cassandra_host}")
                except Exception as e:
                    logger.error(f"Failed to parse CASSANDRA_HOST: {e}, using default")
                    cassandra_host = 'localhost'
            
            if not os.path.exists(cdc_bin):
                logger.error(f"CDC binary not found at {cdc_bin}")
                logger.error("Please build scylla-cdc-printer or set CDC_PRINTER_PATH env var")
                return
            
            args = [
                cdc_bin,
                "-k", keyspace,
                "-t", "stock_latest_prices",
                "-h", cassandra_host,
                "--window-size", "1",
                "--safety-interval", "0",
                "--sleep-interval", "0"
            ]
            logger.info(f"CDC consumer task started. CDC bin: {cdc_bin}, Cassandra host: {cassandra_host}, Keyspace: {keyspace}")
            
            while True:
                now = datetime.datetime.now()
                logger.info(f"Checking trading hours at {now.strftime('%Y-%m-%d %H:%M:%S')}")
                
                if not in_trading_hours():
                    next_time = next_trading_time()
                    wait_seconds = (next_time - datetime.datetime.now()).total_seconds()
                    if wait_seconds > 0:
                        logger.info(f"Outside trading hours. Waiting until {next_time.strftime('%Y-%m-%d %H:%M')} to start CDC")
                        await asyncio.sleep(wait_seconds)
                
                logger.info("✅ In trading hours, starting CDC process")
                
                logger.info(f"Starting CDC process with command: {' '.join(args)}")
                
                try:
                    self.cdc_process = await asyncio.create_subprocess_exec(
                        *args,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                except Exception as e:
                    logger.error(f"Failed to start CDC process: {e}")
                    await asyncio.sleep(5)
                    continue
                
                if self.cdc_process.returncode is not None:
                    logger.error(f"CDC process exited immediately with code {self.cdc_process.returncode}")
                    stderr = await self.cdc_process.stderr.read()
                    logger.error(f"CDC stderr: {stderr.decode()}")
                    await asyncio.sleep(5)
                    continue
                
                current_record = {}
                logger.info("CDC process started, listening for changes...")
                
                # Start stderr reader in background
                async def read_stderr():
                    try:
                        async for line_bytes in self.cdc_process.stderr:
                            line = line_bytes.decode('utf-8').strip()
                            if line:
                                logger.warning(f"CDC stderr: {line}")
                    except Exception as e:
                        logger.error(f"Error reading CDC stderr: {e}")
                
                stderr_task = asyncio.create_task(read_stderr())
                
                # Biến để track t3 khi nhận dòng đầu tiên của mỗi record
                t3_first_line = None
                msg_count = 0
                
                try:
                    async for line_bytes in self.cdc_process.stdout:
                        if not in_trading_hours():
                            logger.info("Trading hours ended, breaking CDC loop")
                            break
                        
                        line = line_bytes.decode('utf-8').strip()
                        if not line:
                            continue
                        
                        # ✅ OPTIMIZATION: Tính t3 ngay khi nhận dòng ĐẦU TIÊN của record
                        if t3_first_line is None and ("│ symbol:" in line or "│ price:" in line):
                            t3_first_line = int(time.time() * 1000)
                            
                        if "│ symbol:" in line or "│ price:" in line or "└─" in line:
                            logger.debug(f"CDC line: {line}")
                        
                        if "└─" in line:
                            if current_record and "symbol" in current_record:
                                producer_ts = current_record.get("producer_timestamp")
                                symbol = current_record["symbol"]
                                
                                # ✅ Dùng t3 đã tính từ dòng đầu tiên (chính xác hơn 20-50ms!)
                                if producer_ts and t3_first_line:
                                    try:
                                        t1_ms = int(producer_ts)
                                        latency = t3_first_line - t1_ms
                                        cdc_latency.labels(symbol=symbol).observe(latency)
                                    except (ValueError, TypeError) as e:
                                        logger.error(f"Error parsing producer_timestamp {producer_ts}: {e}")
                                
                                cdc_events.labels(symbol=symbol).inc()
                                
                                # Log mỗi 100 messages để giảm I/O overhead
                                msg_count += 1
                                if msg_count % 100 == 0:
                                    logger.info(f"📊 Processed {msg_count} CDC messages")
                                
                                await self.broadcast(json.dumps(current_record, ensure_ascii=False))
                            
                            if not in_trading_hours():
                                logger.info("Trading hours ended during processing")
                                break
                            
                            # Reset cho record tiếp theo
                            current_record = {}
                            t3_first_line = None
                            continue
                        
                        # Tối ưu: Parse 1 lần thay vì loop qua tất cả fields
                        if "│ symbol:" in line:
                            value = self.parse_cdc_field(line, "symbol")
                            if value:
                                current_record["symbol"] = value.split(".")[0]
                        elif "│ price:" in line:
                            value = self.parse_cdc_field(line, "price")
                            if value:
                                try:
                                    current_record["price"] = float(value)
                                except (ValueError, TypeError):
                                    pass
                        elif "│ change:" in line:
                            value = self.parse_cdc_field(line, "change")
                            if value:
                                try:
                                    current_record["change"] = float(value)
                                except (ValueError, TypeError):
                                    pass
                        elif "│ change_percent:" in line:
                            value = self.parse_cdc_field(line, "change_percent")
                            if value:
                                try:
                                    current_record["change_percent"] = float(value)
                                except (ValueError, TypeError):
                                    pass
                        elif "│ day_volume:" in line:
                            value = self.parse_cdc_field(line, "day_volume")
                            if value:
                                try:
                                    current_record["day_volume"] = int(value)
                                except (ValueError, TypeError):
                                    pass
                        elif "│ last_size:" in line:
                            value = self.parse_cdc_field(line, "last_size")
                            if value:
                                try:
                                    current_record["last_size"] = int(value)
                                except (ValueError, TypeError):
                                    pass
                        elif "│ producer_timestamp:" in line:
                            value = self.parse_cdc_field(line, "producer_timestamp")
                            if value:
                                current_record["producer_timestamp"] = value
                
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error(f"CDC read error: {e}")
                    logger.exception(e)
                
                finally:
                    logger.info("Stopping CDC process")
                    try:
                        stderr_task.cancel()
                    except:
                        pass
                    if self.cdc_process:
                        try:
                            self.cdc_process.terminate()
                            await asyncio.wait_for(self.cdc_process.wait(), timeout=3)
                        except Exception as e:
                            logger.error(f"Error stopping CDC process: {e}")
                            try:
                                self.cdc_process.kill()
                            except:
                                pass
                
        except asyncio.CancelledError:
            logger.info("CDC consumer cancelled")
            if self.cdc_process:
                try:
                    self.cdc_process.terminate()
                    await asyncio.wait_for(self.cdc_process.wait(), timeout=3)
                except:
                    self.cdc_process.kill()
        except Exception as e:
            logger.error(f"CDC consumer error: {e}")
            logger.exception(e)
        finally:
            if self.cdc_process:
                try:
                    self.cdc_process.terminate()
                    try:
                        self.cdc_process.kill()
                    except:
                        pass
                except:
                    pass

manager = ConnectionManager()

@stock_router.websocket("/ws/stocks_realtime")
async def websocket_endpoint(websocket: WebSocket):
    logger.info("WebSocket connection request received")
    
    is_in_hours = in_trading_hours()
    logger.info(f"Trading hours check: {is_in_hours}")
    
    if not is_in_hours:
        await websocket.accept()
        await websocket.send_text(json.dumps({"error": "Outside trading hours"}))
        await websocket.close()
        return
    
    logger.info("Accepting WebSocket connection")
    await manager.connect(websocket)
    logger.info(f"WebSocket connected. Total connections: {len(manager.active_connections)}")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)
        await websocket.close()
