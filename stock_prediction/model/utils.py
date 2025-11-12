import re
import numpy as np
import pandas as pd
from collections import Counter
from sqlalchemy import create_engine
import ta
import torch
import os
import dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import CommaSeparatedListOutputParser
import tempfile
import subprocess
import re
import pandas as pd
import numpy as np
from typing import Tuple, List, Optional

dotenv.load_dotenv()
POSTGRES_URL = os.getenv('POSTGRES_URL')
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
engine = create_engine(POSTGRES_URL)

def collect_data(tickers):
    tickers = [tickers] if isinstance(tickers, str) else tickers
    data = {}
    
    for ticker in tickers:
        df = pd.read_sql(f"""
            SELECT p.stock_code, p.trade_date, p.open, p.high, p.low, p.close, p.volume,
                   AVG(n.sentiment_score) AS {ticker}_polarity
            FROM fact_daily_prices AS p
            LEFT JOIN fact_news AS n ON p.stock_code = n.stock_code AND p.trade_date = n.news_date
            WHERE p.stock_code = '{ticker}'
            GROUP BY p.stock_code, p.trade_date, p.open, p.high, p.low, p.close, p.volume
            ORDER BY p.trade_date;
        """, engine)
        
        if df.empty:
            data[ticker] = pd.DataFrame()
            continue
        
        df.set_index('trade_date', inplace=True)

        listed_companies = pd.read_sql("SELECT stock_code FROM dim_stock;", engine)['stock_code'].tolist()
        contents = pd.read_sql(f"SELECT content FROM fact_news WHERE stock_code = '{ticker}'", engine)['content'].tolist()
        
        co_occurrences = Counter()
        for content in contents:
            companies = {c.upper() for c in listed_companies if re.search(r'\b' + re.escape(c) + r'\b', content, re.IGNORECASE)}
            if ticker.upper() in companies:
                co_occurrences.update(companies - {ticker.upper()})

        for rel in [comp for comp, _ in co_occurrences.most_common(5)]:
            rel_df = pd.read_sql(f"""
                SELECT p.trade_date, AVG(n.sentiment_score) AS {rel}_polarity
                FROM fact_daily_prices AS p
                LEFT JOIN fact_news AS n ON n.stock_code = '{rel}' AND p.trade_date = n.news_date
                WHERE p.stock_code = '{ticker}'
                GROUP BY p.trade_date ORDER BY p.trade_date;
            """, engine).set_index('trade_date')
            df = df.join(rel_df, how='left')

        close = df['close']
        df["SMA_5"] = ta.trend.SMAIndicator(close, 5).sma_indicator()
        df["SMA_20"] = ta.trend.SMAIndicator(close, 20).sma_indicator()
        df["EMA_10"] = ta.trend.EMAIndicator(close, 10).ema_indicator()
        df["Momentum_3"] = ta.momentum.ROCIndicator(close, 3).roc()
        df["Momentum_10"] = ta.momentum.ROCIndicator(close, 10).roc()
        df["RSI_14"] = ta.momentum.RSIIndicator(close, 14).rsi()
        macd = ta.trend.MACD(close)
        df["MACD"], df["MACD_Signal"] = macd.macd(), macd.macd_signal()
        bb = ta.volatility.BollingerBands(close)
        df["BB_Upper"], df["BB_Lower"] = bb.bollinger_hband(), bb.bollinger_lband()
        df["OBV"] = ta.volume.OnBalanceVolumeIndicator(close, df['volume']).on_balance_volume()

        df[[c for c in df.columns if '_polarity' in c]] = df[[c for c in df.columns if '_polarity' in c]].fillna(0)
        data[ticker] = df.dropna().reset_index()

    return data

def clean_column_names(df: pd.DataFrame) -> pd.DataFrame:
    """Chuẩn hóa tên cột để tránh lỗi eval"""
    df_clean = df.copy()
    df_clean.columns = df_clean.columns.str.replace(' ', '_').str.replace('[^a-zA-Z0-9_]', '', regex=True)
    return df_clean

def validate_and_clean_formula(formula: str, available_columns: list) -> tuple[bool, str]:
    """
    Validate và clean công thức alpha
    Returns: (is_valid, cleaned_formula)
    """
    try:
        # Loại bỏ "Alpha1 = ", "Alpha2 = " etc.
        if '=' in formula:
            formula = formula.split('=', 1)[-1].strip()
        
        # Loại bỏ các ký tự không mong muốn
        formula = formula.strip().strip('",;')
        
        # Thay thế các operator phổ biến
        replacements = {
            '×': '*',
            '÷': '/',
            '−': '-',
            '≥': '>=',
            '≤': '<=',
        }
        for old, new in replacements.items():
            formula = formula.replace(old, new)
        
        # Check for forbidden patterns
        forbidden_patterns = [
            r'\.shift\(',
            r'\.rolling\(',
            r'\.mean\(',
            r'\.std\(',
            r'\.sum\(',
            r'\.max\(',
            r'\.min\(',
        ]
        
        for pattern in forbidden_patterns:
            if re.search(pattern, formula):
                print(f"Cảnh báo: Công thức chứa hàm không được phép: {pattern}")
                return False, formula
        
        # Extract tên cột từ công thức
        potential_cols = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', formula)
        
        # Allowed built-in functions/constants
        allowed_builtins = ['np', 'abs', 'log', 'sqrt', 'exp', 'mean', 'std', 'sum', 'max', 'min']
        
        # Check xem tất cả các cột có tồn tại không
        missing_cols = [col for col in potential_cols 
                       if col not in available_columns and col not in allowed_builtins]
        
        if missing_cols:
            print(f"Cảnh báo: Công thức chứa cột không tồn tại: {missing_cols}")
            return False, formula
        
        # Kiểm tra syntax cơ bản
        if formula.count('(') != formula.count(')'):
            print("Cảnh báo: Số dấu ngoặc không khớp")
            return False, formula
        
        return True, formula
        
    except Exception as e:
        print(f"Lỗi validate công thức: {e}")
        return False, formula


def generate_stock_alphas(data: pd.DataFrame, stock_key: str = "STB", model_name: str = "gemini-2.5-flash-lite", temperature: float = 0.7):
    google_api_key = os.getenv("GOOGLE_API_KEY")
    if not google_api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment variables")

    df = data[stock_key]
    input_data = df.tail(5).to_json(orient="records")
    column_names = ", ".join(map(str, df.columns[7:12].tolist()))

    output_parser = CommaSeparatedListOutputParser()
    format_instructions = output_parser.get_format_instructions()

    # Get actual available columns from the dataframe
    available_features = df.columns.tolist()
    available_features_str = ", ".join(available_features)
    
    # Separate columns by type for clearer instruction
    base_cols = ['open', 'high', 'low', 'close', 'volume']
    tech_indicators = ['SMA_5', 'SMA_20', 'EMA_10', 'Momentum_3', 'Momentum_10', 
                       'RSI_14', 'MACD', 'MACD_Signal', 'BB_Upper', 'BB_Lower', 'OBV']
    polarity_cols = [col for col in available_features if '_polarity' in col]
    
    prompt = PromptTemplate(
        template="""
Task: Generate predictive alphas (formulaic signals) for Vietnam stock {stock_key}.

CRITICAL: You MUST use ONLY the columns listed below. DO NOT invent or assume any other column names exist.

AVAILABLE COLUMNS (Complete List):
- Base features: {base_cols}
- Technical indicators: {tech_indicators}
- Sentiment columns: {polarity_cols}

Input data sample (last 5 rows):
{input_data}

STRICT RULES:
1. Use ONLY columns from the lists above - verify each column name exists in one of the three lists
2. Column names are CASE-SENSITIVE: use 'volume' NOT 'Volume', 'close' NOT 'Close'
3. If a column name doesn't appear in the lists above, DO NOT USE IT
4. Use ONLY these operators: +, -, *, /, ()
5. NO FUNCTIONS: Do NOT use .shift(), .rolling(), .mean(), .std(), or any pandas methods
6. Each formula must be a SINGLE LINE arithmetic expression
7. If you want to reference another stock's polarity, check if it exists in the sentiment columns list first

REQUIREMENTS:
1. Create EXACTLY 5 different alpha formulas
2. Focus on: price momentum, mean reversion, sentiment divergence, or volatility
3. Use ratios, differences, or weighted combinations
4. Each formula must be mathematically valid and use only available columns

OUTPUT FORMAT (comma-separated):
Alpha1 = (close - SMA_20) / SMA_20, Alpha2 = (RSI_14 - 50) / 50, Alpha3 = ..., Alpha4 = ..., Alpha5 = ...

{format_instructions}
""",
        input_variables=["base_cols", "tech_indicators", "polarity_cols", "input_data", "stock_key"],
        partial_variables={"format_instructions": format_instructions}
    )

    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=google_api_key
    )

    chain = prompt | llm | output_parser
    return chain.invoke({
        "input_data": input_data,
        "base_cols": ", ".join(base_cols),
        "tech_indicators": ", ".join(tech_indicators),
        "polarity_cols": ", ".join(polarity_cols) if polarity_cols else "None available",
        "stock_key": stock_key
    })


def apply_generated_alphas(df: pd.DataFrame, stock_code: str, alpha_formulas: list):
    """Tạo các cột Alpha mới trong DataFrame dựa trên danh sách công thức."""
    df_new = df.copy()
    available_columns = df.columns.tolist()
    
    for i, formula in enumerate(alpha_formulas, 1):
        try:
            # Extract expression after "="
            if "=" in formula:
                expr = formula.split("=", 1)[-1].strip()
            else:
                expr = formula.strip()
            
            # Skip empty expressions
            if not expr or expr == "":
                print(f"Cảnh báo: Công thức {i} rỗng, bỏ qua")
                return None, alpha_formulas
            
            # Validate expression has valid columns
            is_valid, cleaned_expr = validate_and_clean_formula(expr, available_columns)
            if not is_valid:
                print(f"Cảnh báo: Công thức {i} không hợp lệ: {expr}")
                return None, alpha_formulas
            
            # Apply the formula
            df_new[f"Alpha{i}"] = df_new.eval(cleaned_expr)
            
        except Exception as e:
            print(f"Lỗi áp dụng công thức {i} cho {stock_code}: {e}")
            print(f"  Formula: {formula}")
            return None, alpha_formulas
    
    return df_new, alpha_formulas



def create_temp_file(filename: str):
    tmp_dir = tempfile.gettempdir()
    tmp_path = os.path.join(tmp_dir, filename)
    return tmp_path

def save_checkpoint_to_temp(checkpoint: dict, tmp_path: str):
    torch.save(checkpoint, tmp_path)


def push_checkpoint_to_ggdrive(tmp_path: str, remote_folder: str = "Checkpoints_DATN"):
    """Push checkpoint to Google Drive and remove local temp file"""
    try:
        subprocess.run(["rclone", "copy", tmp_path, f"gdrive_model:/{remote_folder}/"], check=True)
    except subprocess.CalledProcessError:
        pass
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    

def pull_checkpoint_from_ggdrive(filename: str, remote_folder: str = "Checkpoints_DATN"):
    """Pull checkpoint from Google Drive and load it"""
    tmp_dir = tempfile.gettempdir()
    tmp_path_download = os.path.join(tmp_dir, filename)
    subprocess.run(["rclone", "copyto", f"gdrive_model:/{remote_folder}/{filename}", tmp_path_download], check=True)
    checkpoint = torch.load(tmp_path_download, weights_only=False)
    if os.path.exists(tmp_path_download):
        os.remove(tmp_path_download)
    return checkpoint


def delete_checkpoint_from_ggdrive(filename: str, remote_folder: str = "Checkpoints_DATN"):
    """Delete a checkpoint file from Google Drive"""
    try:
        subprocess.run(["rclone", "delete", f"gdrive_model:/{remote_folder}/{filename}"], check=True)
    except Exception:
        pass


if __name__ == "__main__":
    # data = collect_data(['STB'])
    # data['STB'].head()
    # data['STB'].sort_values(by='trade_date')
    # result = generate_stock_alphas(data, stock_key="STB")
    # alpha_formulas = [alpha.strip() for alpha in result]
    # df_with_alphas = apply_generated_alphas(data['STB'], alpha_formulas)
    # df_with_alphas.head()
    # df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
    # df_with_alphas.info()
    push_checkpoint_to_ggdrive("/home/bbsw/obito/model/checkpoint/StockTransformer_AAA_20251105_174957_best.pt")