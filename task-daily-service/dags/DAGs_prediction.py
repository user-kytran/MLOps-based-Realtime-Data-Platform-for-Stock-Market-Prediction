import logging
import os
from datetime import datetime, timedelta
import holidays
import pendulum
from airflow import DAG
from airflow.operators.bash import BashOperator

logger = logging.getLogger(__name__)
local_tz = pendulum.timezone("Asia/Ho_Chi_Minh")

default_args = {
    'owner': 'airflow',
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'execution_timeout': timedelta(hours=3),
}

with DAG(
    dag_id='DAGs_prediction',
    default_args=default_args,
    description='Daily TradingAgents Multi-Agents Prediction for VN30',
    schedule_interval='0 17 * * 1-5',  # 17:00 Thứ 2 -> Thứ 6 (Sau khi DAGs_warehouse hoàn tất)
    start_date=pendulum.datetime(2025, 1, 1, tz=local_tz),
    catchup=False,
    tags=['DAGs_prediction', 'prediction', 'tradingagents', 'daily'],
) as dag:

    predict_vn30_task = BashOperator(
        task_id='TradingAgents_VN30_Prediction',
        bash_command="""
        export TARGET_DATE=$(python -c "
import holidays, pendulum, datetime
vn_holidays = holidays.country_holidays('VN')
current = pendulum.now(tz='Asia/Ho_Chi_Minh').date()
target = current + datetime.timedelta(days=1)
while target.weekday() >= 5 or target in vn_holidays:
    target += datetime.timedelta(days=1)
print(target.strftime('%Y-%m-%d'))
")
        echo "🎯 [Airflow] Khởi chạy TradingAgents phân tích dự đoán cho ngày: $TARGET_DATE"
        python /opt/TradingAgents/main.py --date "$TARGET_DATE" --symbols all --workers 1
        """,
        execution_timeout=timedelta(hours=3),
    )

    predict_vn30_task