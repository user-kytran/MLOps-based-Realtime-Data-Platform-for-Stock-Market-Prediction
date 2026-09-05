import logging
from datetime import timedelta
import holidays
import pendulum
from airflow import DAG
from airflow.operators.bash import BashOperator
from airflow.operators.python import ShortCircuitOperator

logger = logging.getLogger(__name__)
local_tz = pendulum.timezone("Asia/Ho_Chi_Minh")

default_args = {
    'owner': 'airflow',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(hours=4),
}


def check_today_trading_day(**context):
    vn_holidays = holidays.country_holidays('VN')
    today = pendulum.now(tz=local_tz).date()

    if today.weekday() >= 5 or today in vn_holidays:
        logger.info(f"[ShortCircuit] {today} là ngày nghỉ/lễ. Bỏ qua dự đoán.")
        return False

    return True


with DAG(
    dag_id='DAGs_prediction',
    default_args=default_args,
    description='Daily TradingAgents VN30 Prediction (02:00 AM)',
    schedule_interval='0 2 * * 1-5',
    start_date=pendulum.datetime(2025, 1, 1, tz=local_tz),
    catchup=False,
    tags=['DAGs_prediction', 'prediction', 'tradingagents', 'daily'],
) as dag:

    check_trading_day_task = ShortCircuitOperator(
        task_id='Check_If_Today_Is_Trading_Day',
        python_callable=check_today_trading_day,
    )

    predict_vn30_task = BashOperator(
        task_id='TradingAgents_VN30_Prediction',
        bash_command="""
        export PYTHONUNBUFFERED=1
        export TARGET_DATE=$(python -c "import pendulum; print(pendulum.now(tz='Asia/Ho_Chi_Minh').date().strftime('%Y-%m-%d'))")
        echo "[Airflow] Chạy TradingAgents dự đoán cho ngày: $TARGET_DATE"
        python -u /opt/TradingAgents/main.py --date "$TARGET_DATE" --symbols all --workers 2
        """,
        execution_timeout=timedelta(hours=4),
    )

    check_trading_day_task >> predict_vn30_task
