import logging
import os
import requests
from datetime import datetime, timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import pendulum
import pandas as pd
import holidays
import dotenv

dotenv.load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
TRAINING_API_URL = os.getenv("TRAINING_API_URL")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

def is_next_day_trading():
    tomorrow = datetime.now().date() + timedelta(days=1)
    if tomorrow.weekday() >= 5:
        return False
    vn_holidays = holidays.VN(years=tomorrow.year)
    return tomorrow not in vn_holidays

def run_prediction():
    if not is_next_day_trading():
        logger.info("Tomorrow is not a trading day. Skipping prediction.")
        return
    logger.info(str(datetime.now().date() + timedelta(days=1)))
    try:
        requests.post(TRAINING_API_URL,json = {
                                                "prediction_date": str(datetime.now().date() + timedelta(days=1))
                                            }, timeout=5)
        logger.info("Prediction API triggered successfully")
    except Exception as e:
        logger.warning(f"Failed to trigger prediction API: {e}")


default_args = {
    'owner': 'airflow',
    'retries': 3,
    'retry_delay': timedelta(minutes=2),
    'execution_timeout': timedelta(minutes=60),
}

with DAG(
    dag_id='stock_prediction_daily',
    default_args=default_args,
    schedule_interval='0 23 * * *', # Chạy 23:00 hàng ngày
    start_date=pendulum.datetime(2025, 1, 1, tz='Asia/Ho_Chi_Minh'),
    catchup=False,
    tags=['stock', 'prediction', 'daily'],
) as dag:

    run_prediction_task = PythonOperator(
        task_id='Train_model_and_predict',
        python_callable=run_prediction,
    )

    run_prediction_task