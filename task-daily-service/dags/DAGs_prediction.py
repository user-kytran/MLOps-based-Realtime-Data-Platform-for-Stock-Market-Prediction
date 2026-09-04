import logging
import os
from datetime import datetime, timedelta
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


def check_tomorrow_trading_day(**context):
    """
    Kiểm tra xem ngày mai có phải là ngày giao dịch hay không.
    Nếu ngày mai là cuối tuần (Thứ 7, CN) hoặc ngày nghỉ lễ VN -> Trả về False (Skip các task tiếp theo).
    Nếu ngày mai là ngày giao dịch -> Trả về True (Tiếp tục chạy dự đoán).
    """
    vn_holidays = holidays.country_holidays('VN')
    current_date = pendulum.now(tz=local_tz).date()
    tomorrow = current_date + timedelta(days=1)

    # 1. Kiểm tra cuối tuần (Thứ 7 = 5, Chủ Nhật = 6)
    if tomorrow.weekday() >= 5:
        weekday_name = "Thứ Bảy" if tomorrow.weekday() == 5 else "Chủ Nhật"
        logger.info(f"[ShortCircuit] Ngày mai ({tomorrow}) là {weekday_name} (cuối tuần). Bỏ qua phiên dự đoán.")
        return False

    # 2. Kiểm tra ngày nghỉ lễ Việt Nam
    if tomorrow in vn_holidays:
        holiday_name = vn_holidays.get(tomorrow)
        logger.info(f"[ShortCircuit] Ngày mai ({tomorrow}) là ngày lễ '{holiday_name}'. Bỏ qua phiên dự đoán.")
        return False

    logger.info(f"[ShortCircuit] Ngày mai ({tomorrow}) là ngày giao dịch hợp lệ. Tiếp tục chạy dự đoán.")
    return True


with DAG(
    dag_id='DAGs_prediction',
    default_args=default_args,
    description='Daily TradingAgents Multi-Agents Prediction for VN30',
    schedule_interval='0 17 * * 1-5',  # 17:00 Thứ 2 -> Thứ 6 (Sau khi DAGs_warehouse hoàn tất)
    start_date=pendulum.datetime(2025, 1, 1, tz=local_tz),
    catchup=False,
    tags=['DAGs_prediction', 'prediction', 'tradingagents', 'daily'],
) as dag:

    check_trading_day_task = ShortCircuitOperator(
        task_id='Check_If_Tomorrow_Is_Trading_Day',
        python_callable=check_tomorrow_trading_day,
    )

    predict_vn30_task = BashOperator(
        task_id='TradingAgents_VN30_Prediction',
        bash_command="""
        export PYTHONUNBUFFERED=1
        export TARGET_DATE=$(python -c "
import pendulum, datetime
current = pendulum.now(tz='Asia/Ho_Chi_Minh').date()
target = current + datetime.timedelta(days=1)
print(target.strftime('%Y-%m-%d'))
")
        echo "[Airflow] Khởi chạy TradingAgents phân tích dự đoán cho ngày: $TARGET_DATE"
        python -u /opt/TradingAgents/main.py --date "$TARGET_DATE" --symbols all --workers 2
        """,
        execution_timeout=timedelta(hours=4),
    )

    check_trading_day_task >> predict_vn30_task