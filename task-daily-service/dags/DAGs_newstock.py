import logging, pendulum, requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from airflow import DAG
from airflow.operators.python import PythonOperator
from news_stock import config, NewsRepository, VietstockCrawler, DataLabKeyPool, DataLabConverter, DataLabConversionError, DataLabTryNextKey, SentimentAnalyzer, NewsArticleProcessor, NewsCrawler

logger = logging.getLogger(__name__)

repository, crawler, analyzer = NewsRepository(), VietstockCrawler(), SentimentAnalyzer()
DATALAB_KEY_POOL = DataLabKeyPool(config.load_datalab_api_keys())
processor = NewsArticleProcessor(datalab_converter=DataLabConverter(key_pool=DATALAB_KEY_POOL), sentiment_analyzer=analyzer, max_workers=config.MAX_WORKERS)

def convert_pdf_to_markdown(pdf_data: bytes, filename: str = "document.pdf") -> Optional[str]: return DataLabConverter(key_pool=DATALAB_KEY_POOL).convert(pdf_data, filename=filename)
def fetch_pdf(pdf_link: str) -> Optional[bytes]: return NewsArticleProcessor.fetch_pdf(pdf_link)
def analyze_text_sentiment(content: str, stock_code: str, max_chars: int = config.LLM_MARKDOWN_MAX_CHARS) -> Optional[Dict[str, Any]]: return analyzer.analyze_text(content, stock_code, max_chars=max_chars)
def normalize_sentiment_score(result: Optional[Dict[str, Any]]) -> float: return SentimentAnalyzer.normalize_score(result)
def process_pdf_article(article: Dict[str, Any]) -> Optional[Dict[str, Any]]: return processor.process_pdf_article(article, fetch_fn=fetch_pdf, convert_fn=convert_pdf_to_markdown, analyze_text_fn=analyze_text_sentiment, normalize_fn=normalize_sentiment_score)
def process_text_article(article: Dict[str, Any]) -> Optional[Dict[str, Any]]: return processor.process_text_article(article, analyze_text_fn=analyze_text_sentiment, normalize_fn=normalize_sentiment_score)


def task_get_date_range(**context):
    with repository:
        from_date, to_date = repository.get_latest_news_date(crawler.codes)
        context["ti"].xcom_push(key="from_date", value=from_date.strftime("%Y-%m-%d"))
        context["ti"].xcom_push(key="to_date", value=to_date.strftime("%Y-%m-%d"))
        logger.info("Date range: %s to %s", from_date.strftime("%Y-%m-%d"), to_date.strftime("%Y-%m-%d"))


def task_fetch_articles(**context):
    from_date = datetime.strptime(context["ti"].xcom_pull(key="from_date"), "%Y-%m-%d")
    to_date = datetime.strptime(context["ti"].xcom_pull(key="to_date"), "%Y-%m-%d")
    articles = crawler.crawl_all(from_date, to_date)
    if not articles:
        context["ti"].xcom_push(key="articles", value=[])
        return

    with repository:
        existing_ids = set(repository.check_articles_exist([a["id"] for a in articles]))
    new_articles = [a for a in articles if a["id"] not in existing_ids]
    logger.info("Found %d articles (%d new, %d existing)", len(articles), len(new_articles), len(existing_ids))
    context["ti"].xcom_push(key="articles", value=new_articles)


def task_process_articles(**context):
    articles = context["ti"].xcom_pull(key="articles") or []
    processed = processor.process_batch(articles, process_pdf_fn=process_pdf_article, process_text_fn=process_text_article) if articles else []
    context["ti"].xcom_push(key="processed_articles", value=processed)


def task_save_to_db(**context):
    articles = context["ti"].xcom_pull(key="processed_articles") or []
    if articles:
        with repository: repository.save_articles_batch(articles)


default_args = {"owner": "airflow", "retries": 3, "retry_delay": timedelta(minutes=2), "execution_timeout": timedelta(minutes=60)}

with DAG(
    dag_id="DAGs_newstock",
    default_args=default_args,
    schedule="@hourly",
    start_date=pendulum.datetime(2025, 1, 1, tz="Asia/Ho_Chi_Minh"),
    catchup=False,
    tags=["DAGs_newstock", "crawler"],
) as dag:
    get_date_range = PythonOperator(task_id="get_date_range_task", python_callable=task_get_date_range)
    fetch_articles = PythonOperator(task_id="fetch_articles_task", python_callable=task_fetch_articles)
    process_articles = PythonOperator(task_id="process_articles_task", python_callable=task_process_articles)
    save_to_db = PythonOperator(task_id="save_to_db_task", python_callable=task_save_to_db)

    get_date_range >> fetch_articles >> process_articles >> save_to_db
