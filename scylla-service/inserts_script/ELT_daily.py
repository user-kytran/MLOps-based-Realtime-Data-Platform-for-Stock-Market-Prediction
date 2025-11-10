import os
import time
import json
import logging
import dotenv
import requests
import pandas as pd
from datetime import datetime
from typing import Optional, Dict
from concurrent.futures import ThreadPoolExecutor, as_completed
from threading import Lock

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage
from langchain.output_parsers.json import SimpleJsonOutputParser

# ======================
# CONFIG
# ======================
dotenv.load_dotenv()
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

INPUT_FILE = "/home/obito/main/scylla-service/stock_news.csv"
OUTPUT_FILE = "/home/obito/main/scylla-service/pdf_analysis_results.csv"
MAX_WORKERS = 150  # number of concurrent threads

# ======================
# LOGGING
# ======================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# ======================
# MODEL INIT
# ======================
model = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite",
    api_key=GOOGLE_API_KEY,
    temperature=0.3
)
parser = SimpleJsonOutputParser()

# ======================
# CSV UTILS
# ======================
lock = Lock()


def init_output_file():
    """Tạo file output nếu chưa tồn tại"""
    if not os.path.exists(OUTPUT_FILE):
        df = pd.DataFrame(columns=[
            'stock_code', 'date', 'article_id', 'content', 'crawled_at',
            'is_pdf', 'link', 'pdf_link', 'title', 'sentiment_score'
        ])
        df.to_csv(OUTPUT_FILE, index=False)
        logger.info(f"Tạo mới file output: {OUTPUT_FILE}")
    else:
        logger.info(f"File output đã tồn tại: {OUTPUT_FILE}")


def get_processed_keys() -> set:
    """Đọc key đã xử lý trong file output"""
    if not os.path.exists(OUTPUT_FILE):
        return set()
    df = pd.read_csv(OUTPUT_FILE)
    df = df.fillna("")
    keys = set(df.apply(lambda r: f"{r['stock_code']}|{r['date']}|{r['article_id']}", axis=1))
    return keys


def save_result(row_dict: dict):
    """Ghi 1 kết quả vào file CSV (an toàn luồng)"""
    with lock:
        df_new = pd.DataFrame([row_dict])
        df_new.to_csv(OUTPUT_FILE, mode="a", header=False, index=False)


# ======================
# CORE FUNCTIONS
# ======================
def fetch_pdf(pdf_link: str) -> Optional[bytes]:
    try:
        resp = requests.get(pdf_link, timeout=15)
        resp.raise_for_status()
        return resp.content
    except Exception as e:
        logger.error(f"Lỗi tải PDF: {e}")
        return None


def analyze_pdf(pdf_data: bytes, stock_code: str) -> Optional[Dict]:
    """Gọi API Gemini phân tích PDF"""
    try:
        prompt = f"""
        Đọc nội dung PDF và trả JSON như sau:
        {{
            "summary": "Tóm tắt ngắn gọn nội dung tài chính và các số liệu chính (<=200 từ, tiếng Việt)",
            "sentiment_score": số từ -1 đến 1 (âm = tiêu cực, 0 = trung lập, dương = tích cực)
        }}
        Cổ phiếu mục tiêu: {stock_code}
        Nếu không liên quan tài chính, trả:
        {{
            "summary": "N/A",
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


def process_row(row) -> Optional[dict]:
    """Xử lý 1 dòng PDF"""
    try:
        pdf_data = fetch_pdf(row['pdf_link'])
        if not pdf_data:
            logger.warning(f"Bỏ qua (không tải được): {row['pdf_link']}")
            return None

        result = analyze_pdf(pdf_data, row['stock_code'])
        if not result:
            return None

        return {
            'stock_code': row['stock_code'],
            'date': row.get('date', ''),
            'article_id': row['article_id'],
            'content': result.get('summary', 'N/A'),
            'crawled_at': row.get('crawled_at', ''),
            'is_pdf': row['is_pdf'],
            'link': row.get('link', ''),
            'pdf_link': row['pdf_link'],
            'title': row['title'],
            'sentiment_score': result.get('sentiment_score', 0)
        }

    except Exception as e:
        logger.error(f"Lỗi khi xử lý dòng: {e}")
        return None


def process_dataframe(df: pd.DataFrame, limit: Optional[int] = None):
    """Xử lý toàn bộ dataframe theo batch song song"""
    df_pdf = df[(df['is_pdf'] == True) | (df['is_pdf'] == 'True')]
    df_pdf = df_pdf[df_pdf['pdf_link'].notna()].reset_index(drop=True)

    processed_keys = get_processed_keys()
    df_pdf['key'] = df_pdf.apply(lambda r: f"{r['stock_code']}|{r['date']}|{r['article_id']}", axis=1)
    df_pdf = df_pdf[~df_pdf['key'].isin(processed_keys)]

    if limit:
        df_pdf = df_pdf.head(limit)

    logger.info(f"Tổng số PDF cần xử lý: {len(df_pdf)} (đã bỏ qua {len(processed_keys)})")

    success = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_row, row): row for _, row in df_pdf.iterrows()}

        for future in as_completed(futures):
            row = futures[future]
            try:
                result = future.result()
                if result:
                    save_result(result)
                    success += 1
                    logger.info(f"✓ Đã lưu: {row['article_id']} ({success}/{len(df_pdf)})")
            except Exception as e:
                logger.error(f"Lỗi tương lai (future): {e}")
                continue

    return success


# ======================
# MAIN
# ======================
if __name__ == "__main__":
    init_output_file()

    logger.info("Đang đọc file input...")
    df = pd.read_csv(INPUT_FILE, on_bad_lines="skip")
    logger.info(f"Tổng số bản ghi: {len(df)}")

    total_processed = process_dataframe(df)
    logger.info(f"\n=== HOÀN TẤT ===")
    logger.info(f"Tổng số đã xử lý: {total_processed}")
    logger.info(f"Kết quả lưu tại: {OUTPUT_FILE}")
