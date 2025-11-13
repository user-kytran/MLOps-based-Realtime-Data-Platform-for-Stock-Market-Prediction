import logging
import os
import requests
from datetime import timedelta
from airflow import DAG
from airflow.operators.python import PythonOperator
import pendulum


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def run_prediction():
    try:
        response = requests.get("http://localhost:8006/stock-prediction")
        response.raise_for_status()
        data = response.json()
        logger.info(f"Prediction results: {data}")
    except Exception as e:
        logger.error(f"Error running prediction: {e}")


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
        task_id='run_prediction',
        python_callable=run_prediction,
    )

    run_prediction_task