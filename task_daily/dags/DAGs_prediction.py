import logging
import os
import requests
from datetime import timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import pendulum
import dotenv
dotenv.load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '.env'))
TRAINING_API_URL = os.getenv("TRAINING_API_URL")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def run_prediction():
    try:
        logger.info(f"Triggering prediction API: {TRAINING_API_URL}")
        requests.post(TRAINING_API_URL, timeout=5)  # Chỉ trigger, không đợi kết quả
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