from math import log
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import pendulum
from news_stock.newscrawler import NewsCrawler
import os
import requests
import logging
import dotenv
from typing import Optional, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage
from langchain.output_parsers.json import SimpleJsonOutputParser


dotenv.load_dotenv()
crawler = NewsCrawler()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MAX_WORKERS = 50

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Khởi tạo model chỉ khi có API key
model = None
parser = None
if GOOGLE_API_KEY:
    try:
        model = ChatGoogleGenerativeAI(
            model="gemini-2.5-flash-lite",
            api_key=GOOGLE_API_KEY,
            temperature=0.3
        )
        parser = SimpleJsonOutputParser()
        logger.info("✅ Google AI model initialized")
    except Exception as e:
        logger.warning(f"⚠️ Failed to initialize Google AI model: {e}")
        model = None
        parser = None
else:
    logger.warning("⚠️ GOOGLE_API_KEY not set, AI processing disabled")

def check_article_exists(articles_id: list[str]) -> list[dict]:
    """Kiểm tra bài báo đã tồn tại trong DB chưa"""
    try:
        if not articles_id:
            return []
        
        # Tạo placeholder cho IN clause
        placeholders = ','.join(['%s'] * len(articles_id))
        query = f"SELECT article_id FROM stock_news WHERE article_id IN ({placeholders}) ALLOW FILTERING"
        rows = crawler.db.execute(query, articles_id, timeout=60)
        return [row.article_id for row in rows]
    except Exception as e:
        logger.error(f"Lỗi kiểm tra bài báo: {e}")
        return []

def fetch_pdf(pdf_link: str) -> Optional[bytes]:
    """Tải PDF từ link"""
    try:
        resp = requests.get(pdf_link, timeout=15)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        logger.error(f"Lỗi tải PDF: {e}")
        return None

def analyze_pdf(pdf_data: bytes, stock_code: str) -> Optional[Dict]:
    """Phân tích PDF bằng Gemini AI"""
    if not model or not parser:
        logger.warning("⚠️ AI model not available, skipping PDF analysis")
        return {
            "summary": "N/A - AI analysis disabled",
            "sentiment_score": 0
        }
    
    try:
        prompt = f"""
        Đọc nội dung PDF và trả JSON như sau:
        {{
            "sentiment_score": số từ -1 đến 1 (âm = tiêu cực, 0 = trung lập, dương = tích cực)
        }}
        Cổ phiếu mục tiêu: {stock_code}
        Nếu không liên quan tài chính, trả:
        {{
            "sentiment_score": 0
        }}
        """

        msg = HumanMessage(
            content=[
                {"type": "media", "data": pdf_data, "mime_type": "application/pdf"},
                {"type": "text", "text": prompt}
            ]
        )

        response = model.invoke([msg])
        return parser.parse(response.content)

    except Exception as e:
        logger.error(f"Lỗi phân tích PDF: {e}")
        return None

def analyze_text_sentiment(content: str, stock_code: str) -> Optional[Dict]:
    """Phân tích sentiment cho content text"""
    if not model or not parser:
        logger.warning("⚠️ AI model not available, skipping text analysis")
        return {"sentiment_score": 0}
    
    try:
        prompt = f"""
        Phân tích sentiment của nội dung sau và trả JSON:
        {{`
            "sentiment_score": số từ -1 đến 1 (âm = tiêu cực, 0 = trung lập, dương = tích cực)
        }}
        
        Nội dung: {content[:1000]}...
        Cổ phiếu mục tiêu: {stock_code}
        
        Chỉ trả về số sentiment_score, không cần tóm tắt.
        """

        msg = HumanMessage(content=prompt)
        response = model.invoke([msg])
        return parser.parse(response.content)

    except Exception as e:
        logger.error(f"Lỗi phân tích sentiment text: {e}")
        return None

def process_pdf_article(article: dict) -> Optional[dict]:
    """Xử lý 1 bài báo PDF"""
    try:
        pdf_link = article.get('pdf_link', article.get('link'))
        pdf_data = fetch_pdf(pdf_link)
        if not pdf_data:
            logger.warning(f"Bỏ qua (không tải được): {pdf_link}")
            return None

        result = analyze_pdf(pdf_data, article['code'])
        if not result:
            return None

        return {
            'article_id': article['id'],
            'stock_code': article['code'],
            'title': article['title'],
            'link': article['link'],
            'date': datetime.now(),
            'is_pdf': True,
            'content': '',
            'pdf_link': pdf_link,
            'sentiment_score': result.get('sentiment_score', 0),
            'crawled_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

    except Exception as e:
        logger.error(f"Lỗi khi xử lý PDF: {e}")
        return None

def process_text_article(article: dict) -> Optional[dict]:
    """Xử lý 1 bài báo có content text"""
    try:
        content = article.get('content', '')
        result = analyze_text_sentiment(content, article['code'])
        sentiment_score = result.get('sentiment_score', 0) if result else 0
        return {
            'article_id': article['id'],
            'stock_code': article['code'],
            'title': article['title'],
            'link': article['link'],
            'date': datetime.now(),
            'is_pdf': False,
            'content': content,
            'pdf_link': None,
            'sentiment_score': sentiment_score,
            'crawled_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }
    except Exception as e:
        logger.error(f"Lỗi khi xử lý text: {e}")
        return None

def task_get_date_range(**context):
    try:
        crawler.connect_to_db()
        from_date, to_date = crawler.get_date_range()
        context['ti'].xcom_push(key='from_date', value=from_date.strftime('%Y-%m-%d'))
        context['ti'].xcom_push(key='to_date', value=to_date.strftime('%Y-%m-%d'))
        logger.info(f"Từ ngày: {from_date.strftime('%Y-%m-%d')} đến ngày: {to_date.strftime('%Y-%m-%d')}")
    except Exception as e:
        logger.error(f"Lỗi khi lấy khoảng ngày: {e}")
        return
    finally:
        crawler.close_db()

def task_fetch_articles(**context):
    try:
        crawler.connect_to_db()
        from_date = datetime.strptime(context['ti'].xcom_pull(key='from_date'), '%Y-%m-%d')
        to_date = datetime.strptime(context['ti'].xcom_pull(key='to_date'), '%Y-%m-%d')
        logger.info(f"Từ ngày: {from_date.strftime('%Y-%m-%d')} đến ngày: {to_date.strftime('%Y-%m-%d')}")
        articles = crawler.crawl_articles(from_date, to_date)
        
        new_articles = []
        logger.info(f"Bắt đầu kiểm tra bài báo tồn tại trong DB")
        # Lấy hết articles_id trong articles
        articles_id = [article['id'] for article in articles]
        existing_articles = check_article_exists(articles_id)
        for article in articles:
            if article['id'] not in existing_articles:
                new_articles.append(article)
            else:
                logger.info(f"Bài báo đã tồn tại: {article['id']}")
        logger.info(f"Tổng số bài mới cần xử lý: {len(new_articles)}")
        context['ti'].xcom_push(key='articles', value=new_articles)
    except Exception as e:
        logger.error(f"Lỗi khi lấy bài báo: {e}")
        return
    finally:
        crawler.close_db()


def task_process_articles(**context):
    articles = context['ti'].xcom_pull(key='articles')
    if not articles:
        logger.info("Không có dữ liệu để xử lý.")
        context['ti'].xcom_push(key='processed_articles', value=[])
        return

    pdf_articles = []
    text_articles = []
    
    for article in articles:
        if article.get('is_pdf'):
            pdf_articles.append(article)
        else:
            text_articles.append(article)
    
    processed_articles = []
    
    # Xử lý PDF articles
    if pdf_articles:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_pdf_article, article): article for article in pdf_articles}
            for future in as_completed(futures):
                article = futures[future]
                try:
                    result = future.result()
                    if result:
                        processed_articles.append(result)
                        logger.info(f"✓ Đã xử lý PDF: {article['id']}")
                    else:
                        text_result = process_text_article(article)
                        if text_result:
                            processed_articles.append(text_result)
                            logger.info(f"✓ Fallback text: {article['id']}")
                except Exception as e:
                    logger.error(f"Lỗi xử lý PDF: {e}")
                    continue
    
    # Xử lý text articles
    if text_articles:
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {executor.submit(process_text_article, article): article for article in text_articles}
            for future in as_completed(futures):
                article = futures[future]
                try:
                    result = future.result()
                    if result:
                        processed_articles.append(result)
                except Exception as e:
                    logger.error(f"Lỗi xử lý text: {e}")
                    continue
    
    logger.info(f"Hoàn thành xử lý {len(processed_articles)} bài báo")
    context['ti'].xcom_push(key='processed_articles', value=processed_articles)

def task_save_to_db(**context):
    try:
        crawler.connect_to_db()
        processed_articles = context['ti'].xcom_pull(key='processed_articles')
        # ... (code kiểm tra if not processed_articles) ...

        logger.info(f"Chuẩn bị lưu {len(processed_articles)} bài báo...")
        query = crawler.db.prepare("""
            INSERT INTO stock_news (article_id,stock_code,title,link,date,is_pdf,content,sentiment_score,pdf_link,crawled_at)
            VALUES (?,?,?,?,?,?,?,?,?,toTimestamp(now()))
        """)
        
        futures = []
        for article in processed_articles:
            try:
                params = (
                    article['article_id'], 
                    article['stock_code'], 
                    article['title'], 
                    article['link'],
                    article['date'],
                    article['is_pdf'], 
                    article['content'], 
                    article['sentiment_score'],
                    article['pdf_link'],
                )
                future = crawler.db.execute_async(query, params, timeout=60) 
                
                futures.append(future)
            except Exception as e:
                logger.error(f"[SAVE PREPARE ERROR] Bài {article.get('article_id', 'UNKNOWN')}: {e}")

        saved_count = 0
        failed_count = 0
        
        for future in futures:
            try:
                future.result() 
                
                saved_count += 1
            except Exception as e:
                logger.error(f"[SAVE EXECUTE ERROR] {e}") 
                failed_count += 1   
        logger.info(f"[SAVE STATUS] Đã lưu {saved_count}/{len(processed_articles)} bài báo (Thất bại: {failed_count})")
        if failed_count > 0:
            raise Exception(f"Lưu CSDL thất bại {failed_count} trên tổng số {len(processed_articles)} bản ghi.")
    except Exception as e:
        logger.error(f"[SAVE TASK ERROR] {e}")
        raise
    finally:
        crawler.close_db()

default_args = {
    'owner': 'airflow',
    'retries': 3,
    'retry_delay': timedelta(minutes=2),
    'execution_timeout': timedelta(minutes=60),
}

with DAG(
    dag_id='vietstock_news_crawler',
    default_args=default_args,
    schedule_interval='@hourly',  # Chạy mỗi 1 tiếng
    start_date=pendulum.datetime(2025, 1, 1, tz='Asia/Ho_Chi_Minh'),
    catchup=False,
    tags=['vietstock', 'crawler']
) as dag:

    get_date_range = PythonOperator(
        task_id='get_date_range_task',
        python_callable=task_get_date_range,
        provide_context=True
    )

    fetch_articles = PythonOperator(
        task_id='fetch_articles_task',
        python_callable=task_fetch_articles,
        provide_context=True
    )

    process_articles = PythonOperator(
        task_id='process_articles_task',
        python_callable=task_process_articles,
        provide_context=True
    )

    save_to_db = PythonOperator(
        task_id='save_to_db_task',
        python_callable=task_save_to_db,
        provide_context=True
    )

    get_date_range >> fetch_articles >> process_articles >> save_to_db
