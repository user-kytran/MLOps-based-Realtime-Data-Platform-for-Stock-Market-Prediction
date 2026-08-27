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
import re
import threading
import time
from contextlib import contextmanager
from urllib.parse import urlparse
from typing import Optional, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser


dotenv.load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
crawler = NewsCrawler()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MAX_WORKERS = 50

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

DATALAB_CONVERT_URL = "https://www.datalab.to/api/v1/convert"
DATALAB_MAX_FILE_BYTES = 200 * 1024 * 1024
DATALAB_MODE = os.getenv("DATALAB_MODE", "balanced")
DATALAB_POLL_INTERVAL_SECONDS = float(os.getenv("DATALAB_POLL_INTERVAL_SECONDS", "2"))
DATALAB_POLL_TIMEOUT_SECONDS = int(os.getenv("DATALAB_POLL_TIMEOUT_SECONDS", "900"))
DATALAB_MAX_CONCURRENT_PER_KEY = int(os.getenv("DATALAB_MAX_CONCURRENT_PER_KEY", "2"))
DATALAB_KEY_WAIT_TIMEOUT_SECONDS = int(os.getenv("DATALAB_KEY_WAIT_TIMEOUT_SECONDS", "120"))
LLM_MARKDOWN_MAX_CHARS = int(os.getenv("LLM_MARKDOWN_MAX_CHARS", "12000"))


def load_datalab_api_keys() -> list[str]:
    """Load API_KEY_DataLab<N> values without exposing them in logs."""
    pattern = re.compile(r"^API_KEY_DATALAB(\d+)$", re.IGNORECASE)
    indexed_keys = []
    for name, value in os.environ.items():
        match = pattern.match(name)
        if match and value.strip():
            indexed_keys.append((int(match.group(1)), value.strip()))
    return [value for _, value in sorted(indexed_keys)]


class DataLabConversionError(RuntimeError):
    pass


class DataLabTryNextKey(RuntimeError):
    pass


class DataLabKeyPool:
    """Thread-safe round-robin pool with per-key concurrency and cooldown."""

    def __init__(self, keys: list[str], max_concurrent_per_key: int = 2):
        self._keys = list(keys)
        self._max_concurrent = max(1, max_concurrent_per_key)
        self._states = [{"disabled": False, "cooldown": 0.0, "inflight": 0} for _ in keys]
        self._cursor = 0
        self._lock = threading.Lock()

    @property
    def size(self) -> int:
        return len(self._keys)

    @contextmanager
    def acquire(self, excluded: Optional[set[int]] = None):
        excluded = excluded or set()
        deadline = time.monotonic() + DATALAB_KEY_WAIT_TIMEOUT_SECONDS
        selected = None
        while selected is None:
            with self._lock:
                now = time.monotonic()
                for offset in range(len(self._keys)):
                    index = (self._cursor + offset) % len(self._keys)
                    state = self._states[index]
                    if index not in excluded and not state["disabled"] and state["cooldown"] <= now and state["inflight"] < self._max_concurrent:
                        selected = index
                        state["inflight"] += 1
                        self._cursor = (index + 1) % len(self._keys)
                        break
                if selected is None and not any(
                    index not in excluded and not state["disabled"]
                    for index, state in enumerate(self._states)
                ):
                    raise DataLabConversionError("No DataLab API key is available")
            if selected is None:
                if time.monotonic() >= deadline:
                    raise DataLabConversionError("Timed out waiting for a DataLab API key")
                time.sleep(0.25)

        try:
            yield selected, self._keys[selected]
        finally:
            with self._lock:
                self._states[selected]["inflight"] -= 1

    def mark(self, index: int, *, disabled: bool = False, cooldown: float = 0):
        with self._lock:
            self._states[index]["disabled"] |= disabled
            self._states[index]["cooldown"] = max(
                self._states[index]["cooldown"], time.monotonic() + cooldown
            )


DATALAB_API_KEYS = load_datalab_api_keys()
DATALAB_KEY_POOL = DataLabKeyPool(
    DATALAB_API_KEYS,
    max_concurrent_per_key=DATALAB_MAX_CONCURRENT_PER_KEY,
)
PDF_MAX_WORKERS = (
    min(MAX_WORKERS, DATALAB_KEY_POOL.size * DATALAB_MAX_CONCURRENT_PER_KEY)
    if DATALAB_KEY_POOL.size
    else MAX_WORKERS
)

if DATALAB_API_KEYS:
    logger.info("DataLab PDF conversion enabled with %d API key slots", len(DATALAB_API_KEYS))
else:
    logger.warning("No API_KEY_DataLab<N> values found; PDF-to-Markdown conversion disabled")


def _response_detail(response: requests.Response) -> str:
    try:
        payload = response.json()
        detail = payload.get("detail") or payload.get("error") or payload
    except Exception:
        detail = response.text
    return str(detail)[:300]


def _retry_after_seconds(response: requests.Response, default: float = 60.0) -> float:
    try:
        return max(1.0, float(response.headers.get("Retry-After", default)))
    except (TypeError, ValueError):
        return default


def _json_response(response: requests.Response, phase: str) -> dict:
    try:
        return response.json()
    except ValueError as exc:
        raise DataLabConversionError(f"DataLab {phase} returned invalid JSON") from exc


def _key_http_action(response: requests.Response, transient_delay: float = 10.0):
    if response.status_code in (401, 402, 403):
        return "disable", 0.0
    if response.status_code == 429:
        return "cooldown", _retry_after_seconds(response)
    if response.status_code in (500, 529):
        return "cooldown", transient_delay
    return None


def _validate_datalab_check_url(check_url: str):
    parsed = urlparse(check_url)
    hostname = parsed.hostname or ""
    if parsed.scheme != "https" or not (
        hostname == "datalab.to" or hostname.endswith(".datalab.to")
    ):
        raise DataLabConversionError("DataLab returned an invalid request_check_url")


def _poll_datalab_markdown(check_url: str, key_index: int, api_key: str) -> str:
    _validate_datalab_check_url(check_url)
    deadline = time.monotonic() + DATALAB_POLL_TIMEOUT_SECONDS
    transient_attempt = 0

    while time.monotonic() < deadline:
        try:
            response = requests.get(
                check_url,
                headers={"X-API-Key": api_key},
                timeout=(10, 30),
            )
        except requests.RequestException as exc:
            transient_attempt += 1
            delay = min(30.0, 2 ** min(transient_attempt, 5))
            logger.warning("DataLab poll network error on key slot %d; retrying in %.0fs: %s", key_index, delay, exc)
            time.sleep(delay)
            continue

        transient_attempt += response.status_code in (500, 529)
        action = _key_http_action(
            response,
            transient_delay=min(30.0, 2 ** min(transient_attempt, 5)),
        )
        if action:
            kind, delay = action
            DATALAB_KEY_POOL.mark(key_index, disabled=kind == "disable", cooldown=delay)
            if kind == "disable":
                raise DataLabConversionError(
                    f"DataLab key slot {key_index} became unavailable while polling: HTTP {response.status_code}"
                )
            logger.warning("DataLab poll HTTP %d on key slot %d; retrying in %.0fs", response.status_code, key_index, delay)
            time.sleep(delay)
            continue
        if not response.ok:
            raise DataLabConversionError(
                f"DataLab poll failed with HTTP {response.status_code}: {_response_detail(response)}"
            )

        result = _json_response(response, "poll")
        status = str(result.get("status", "")).lower()
        if status == "complete":
            if not result.get("success", False):
                raise DataLabConversionError(
                    f"DataLab conversion failed: {str(result.get('error', 'unknown error'))[:300]}"
                )
            markdown = result.get("markdown")
            if not isinstance(markdown, str) or not markdown.strip():
                raise DataLabConversionError("DataLab completed without Markdown output")
            return markdown.strip()
        if status == "failed":
            raise DataLabConversionError(
                f"DataLab conversion failed: {str(result.get('error', 'unknown error'))[:300]}"
            )

        time.sleep(DATALAB_POLL_INTERVAL_SECONDS)

    raise DataLabConversionError("Timed out waiting for DataLab PDF conversion")


def _submit_datalab_pdf(pdf_data: bytes, filename: str, key_index: int, api_key: str) -> str:
    try:
        response = requests.post(
            DATALAB_CONVERT_URL,
            headers={"X-API-Key": api_key},
            files={"file": (filename, pdf_data, "application/pdf")},
            data={
                "output_format": "markdown",
                "mode": DATALAB_MODE,
                "disable_image_extraction": "true",
                "disable_image_captions": "true",
                "token_efficient_markdown": "true",
            },
            timeout=(15, 90),
        )
    except requests.RequestException as exc:
        DATALAB_KEY_POOL.mark(key_index, cooldown=10)
        logger.warning("DataLab submit network error on key slot %d: %s", key_index, exc)
        raise DataLabTryNextKey from exc

    action = _key_http_action(response)
    if action:
        kind, delay = action
        DATALAB_KEY_POOL.mark(key_index, disabled=kind == "disable", cooldown=delay)
        logger.warning("DataLab submit HTTP %d on key slot %d; switching key", response.status_code, key_index)
        raise DataLabTryNextKey
    if not response.ok:
        raise DataLabConversionError(
            f"DataLab rejected {filename} with HTTP {response.status_code}: {_response_detail(response)}"
        )

    submission = _json_response(response, "submission")
    if not submission.get("success", False):
        error = str(submission.get("error", "unknown submission error"))
        error_lower = error.lower()
        if any(word in error_lower for word in ("spend", "credit", "cap", "rate limit")):
            exhausted = any(word in error_lower for word in ("spend", "credit", "cap"))
            DATALAB_KEY_POOL.mark(key_index, disabled=exhausted, cooldown=0 if exhausted else 60)
            raise DataLabTryNextKey
        raise DataLabConversionError(f"DataLab submission failed: {error[:300]}")

    check_url = submission.get("request_check_url")
    if not check_url:
        raise DataLabConversionError("DataLab submission returned no request_check_url")
    return check_url


def convert_pdf_to_markdown(pdf_data: bytes, filename: str = "document.pdf") -> Optional[str]:
    """Convert a PDF using DataLab, rotating keys only before submission."""
    if not pdf_data or DATALAB_KEY_POOL.size == 0:
        return None
    if len(pdf_data) > DATALAB_MAX_FILE_BYTES:
        logger.error("PDF exceeds DataLab's 200 MB upload limit: %s", filename)
        return None

    attempted_keys: set[int] = set()
    while len(attempted_keys) < DATALAB_KEY_POOL.size:
        try:
            with DATALAB_KEY_POOL.acquire(attempted_keys) as (key_index, api_key):
                attempted_keys.add(key_index)
                check_url = _submit_datalab_pdf(pdf_data, filename, key_index, api_key)
                return _poll_datalab_markdown(check_url, key_index, api_key)
        except DataLabTryNextKey:
            continue
        except DataLabConversionError as exc:
            logger.error("DataLab conversion unavailable for %s: %s", filename, exc)
            break

    logger.error("All DataLab API key slots were unavailable for %s", filename)
    return None

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
        parser = JsonOutputParser()
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

def analyze_text_sentiment(content: str, stock_code: str, max_chars: int = 1000) -> Optional[Dict]:
    """Phân tích sentiment cho content text"""
    if not model or not parser:
        logger.warning("⚠️ AI model not available, skipping text analysis")
        return {"sentiment_score": 0}
    
    try:
        content_for_llm = (content or "")[:max(1, max_chars)]
        prompt = f"""
        Phân tích sentiment của nội dung sau và trả JSON:
        {{
            "sentiment_score": số từ -1 đến 1 (âm = tiêu cực, 0 = trung lập, dương = tích cực)
        }}
        
        Nội dung: {content_for_llm}
        Cổ phiếu mục tiêu: {stock_code}
        
        Chỉ trả về số sentiment_score, không cần tóm tắt.
        """

        msg = HumanMessage(content=prompt)
        response = model.invoke([msg])
        return parser.parse(response.content)

    except Exception as e:
        logger.error(f"Lỗi phân tích sentiment text: {e}")
        return None


def normalize_sentiment_score(result: Optional[Dict]) -> float:
    try:
        score = float((result or {}).get('sentiment_score', 0))
        return max(-1.0, min(1.0, score))
    except (TypeError, ValueError):
        return 0.0

def process_pdf_article(article: dict) -> Optional[dict]:
    """Xử lý 1 bài báo PDF"""
    try:
        pdf_link = article.get('pdf_link', article.get('link'))
        pdf_data = fetch_pdf(pdf_link)
        if not pdf_data:
            logger.warning(f"Bỏ qua (không tải được): {pdf_link}")
            return None

        filename = os.path.basename(urlparse(pdf_link).path) or f"{article['code']}-{article['id']}.pdf"
        if not filename.lower().endswith('.pdf'):
            filename = f"{filename}.pdf"

        markdown = convert_pdf_to_markdown(pdf_data, filename=filename)
        if markdown:
            logger.info(
                "✓ DataLab converted PDF %s to Markdown (%d characters)",
                article['id'],
                len(markdown),
            )
            result = analyze_text_sentiment(
                markdown,
                article['code'],
                max_chars=LLM_MARKDOWN_MAX_CHARS,
            )
            sentiment_score = normalize_sentiment_score(result)
        else:
            logger.warning(
                "DataLab conversion unavailable for PDF %s; falling back to direct Gemini PDF analysis",
                article['id'],
            )
            result = analyze_pdf(pdf_data, article['code'])
            if not result:
                return None
            sentiment_score = normalize_sentiment_score(result)

        return {
            'article_id': article['id'],
            'stock_code': article['code'],
            'title': article['title'],
            'link': article['link'],
            'date': datetime.now(),
            'is_pdf': True,
            'content': markdown or '',
            'pdf_link': pdf_link,
            'sentiment_score': sentiment_score,
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
        sentiment_score = normalize_sentiment_score(result)
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
        with ThreadPoolExecutor(max_workers=PDF_MAX_WORKERS) as executor:
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
    dag_id='DAGs_newstock',
    default_args=default_args,
    schedule_interval='@hourly',  # Chạy mỗi 1 tiếng
    start_date=pendulum.datetime(2025, 1, 1, tz='Asia/Ho_Chi_Minh'),
    catchup=False,
    tags=['DAGs_newstock', 'crawler']
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
