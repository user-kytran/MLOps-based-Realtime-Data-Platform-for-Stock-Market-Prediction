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
from .db_manager import ModelTrainingDB

dotenv.load_dotenv()
POSTGRES_URL = os.getenv('POSTGRES_URL', '').strip('"\'')
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
engine = create_engine(POSTGRES_URL) if POSTGRES_URL else None

def collect_data(tickers, end_date=None):
    tickers = [tickers] if isinstance(tickers, str) else tickers
    data = {}
    
    for ticker in tickers:
        date_filter = f"AND p.trade_date < '{end_date}'" if end_date else ""
        
        df = pd.read_sql(f"""
            SELECT p.stock_code, p.trade_date, p.open, p.high, p.low, p.close, p.volume,
                   AVG(n.sentiment_score) AS {ticker}_polarity
            FROM fact_daily_prices AS p
            LEFT JOIN fact_news AS n ON p.stock_code = n.stock_code AND p.trade_date = n.news_date
            WHERE p.stock_code = '{ticker}' {date_filter}
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
                WHERE p.stock_code = '{ticker}' {date_filter}
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


def apply_generated_alphas(df: pd.DataFrame, stock_code: str, alpha_formulas: list, ensure_count: int = None):
    """Tạo các cột Alpha mới trong DataFrame dựa trên danh sách công thức.
    
    Args:
        df: DataFrame chứa dữ liệu
        stock_code: Mã cổ phiếu
        alpha_formulas: Danh sách công thức alpha
        ensure_count: Nếu không None, đảm bảo trả về đúng số công thức này
    
    Returns:
        df_new: DataFrame với các cột Alpha
        valid_formulas: Danh sách công thức hợp lệ
    """
    df_new = df.copy()
    available_columns = df.columns.tolist()
    valid_formulas = []
    
    for i, formula in enumerate(alpha_formulas[:ensure_count] if ensure_count else alpha_formulas):
        alpha_col = f"Alpha{i+1}"
        try:
            # Extract expression after "="
            if "=" in formula:
                expr = formula.split("=", 1)[-1].strip()
            else:
                expr = formula.strip()
            
            # Skip empty expressions
            if not expr or expr == "":
                print(f"Cảnh báo: Công thức {i+1} rỗng, bỏ qua")
                continue
            
            # Validate expression has valid columns
            is_valid, cleaned_expr = validate_and_clean_formula(expr, available_columns)
            if not is_valid:
                print(f"Cảnh báo: Công thức {i+1} không hợp lệ: {expr}")
                continue
            
            # Apply the formula
            df_new[alpha_col] = df_new.eval(cleaned_expr)
            valid_formulas.append(formula)
            
        except Exception as e:
            print(f"Lỗi áp dụng công thức {i+1} cho {stock_code}: {e}")
            print(f"  Formula: {formula}")
            continue
    
    if len(valid_formulas) == 0:
        print(f"Không có công thức nào hợp lệ cho {stock_code}")
        return None, []
    
    return df_new, valid_formulas


def calculate_ic_from_column(df: pd.DataFrame, alpha_col: str) -> tuple[float, float, int]:
    """
    Tính RankIC từ cột alpha đã có sẵn
    Returns: (rank_ic, pvalue, n_samples)
    """
    from scipy.stats import spearmanr
    
    if alpha_col not in df.columns or 'close' not in df.columns:
        return np.nan, np.nan, 0
    
    try:
        df_temp = df[[alpha_col, 'close']].copy()
        df_temp['future_return'] = ((df_temp['close'].shift(-1) - df_temp['close']) / df_temp['close']) * 100
        df_temp = df_temp.replace([float('inf'), -float('inf')], float('nan')).dropna()
        
        if len(df_temp) < 10:
            return np.nan, np.nan, 0
        
        corr, pvalue = spearmanr(df_temp[alpha_col], df_temp['future_return'])
        return corr, pvalue, len(df_temp)
    
    except Exception:
        return np.nan, np.nan, 0


def select_best_alphas(df: pd.DataFrame, stock_code: str, alpha_formulas: list, top_n: int = 5, max_retries: int = 2):
    """Chọn top N alpha formula tốt nhất dựa vào RankIC. Luôn sinh thêm công thức mới để có nhiều lựa chọn."""
    
    # Bước 1: Load công thức từ DB
    db_formulas = []
    try:
        history_alphas = ModelTrainingDB().get_alpha_metrics(stock_code)
        for row in history_alphas:
            if len(row) == 5:
                _, formula, ic, pval, n = row
                db_formulas.append((formula, ic, pval, n))
        if db_formulas:
            print(f"{stock_code}: Đã tìm thấy {len(db_formulas)} công thức trong DB")
    except:
        pass
    
    # Bước 2: Kết hợp tất cả công thức (input + DB + sinh mới)
    all_formulas = list(set(alpha_formulas))
    
    # Thêm công thức từ DB vào pool
    for formula, _, _, _ in db_formulas:
        if formula not in all_formulas:
            all_formulas.append(formula)
    
    # Bước 3: Sinh thêm công thức mới (luôn chạy đủ max_retries lần)
    for retry in range(max_retries):
        print(f"{stock_code}: Sinh công thức lần {retry + 1}/{max_retries}...")
        try:
            result = generate_stock_alphas({stock_code: df}, stock_key=stock_code)
            new_formulas = [alpha.strip() for alpha in result if alpha.strip()]
            for formula in new_formulas:
                if formula not in all_formulas:
                    all_formulas.append(formula)
        except Exception as e:
            print(f"{stock_code}: Lỗi sinh công thức lần {retry + 1}: {e}")
    
    print(f"{stock_code}: Tổng cộng có {len(all_formulas)} công thức để đánh giá")
    
    # Bước 4: Apply và tính RankIC cho TẤT CẢ công thức
    df_with_all_alphas, valid_formulas = apply_generated_alphas(df, stock_code, all_formulas)
    
    if df_with_all_alphas is None or len(valid_formulas) == 0:
        print(f"{stock_code}: Không có công thức nào hợp lệ")
        return None, None
    
    print(f"{stock_code}: Có {len(valid_formulas)} công thức hợp lệ")
    
    # Tính RankIC cho tất cả
    list_alphas = []
    for idx, alpha_formula in enumerate(valid_formulas):
        alpha_col = f"Alpha{idx+1}"
        if alpha_col in df_with_all_alphas.columns:
            rank_ic, pvalue, n_samples = calculate_ic_from_column(df_with_all_alphas, alpha_col)
            list_alphas.append((alpha_formula, rank_ic, pvalue, n_samples))
    
    if len(list_alphas) == 0:
        print(f"{stock_code}: Không tính được IC cho công thức nào")
        return None, None
    
    # Bước 5: Sort và chọn top N công thức tốt nhất
    def safe_sort_key(x):
        val = x[1]
        if isinstance(val, (int, float)):
            return val if not np.isnan(val) else -999
        return -999
    
    best_alphas_with_ic = sorted(list_alphas, key=safe_sort_key, reverse=True)
    
    if len(best_alphas_with_ic) < top_n:
        print(f"{stock_code}: Chỉ có {len(best_alphas_with_ic)}/{top_n} công thức")
        return None, None
    
    # Chọn top N
    top_alphas = best_alphas_with_ic[:top_n]
    best_formulas = [alpha[0] for alpha in top_alphas]
    
    # Bước 6: Apply lại với đúng top N công thức
    df_final, final_valid = apply_generated_alphas(df, stock_code, best_formulas, ensure_count=top_n)
    
    if df_final is None or len(final_valid) != top_n:
        print(f"{stock_code}: Không apply được {top_n} công thức tốt nhất")
        return None, None
    
    # Lưu vào DB (xóa cũ, chỉ giữ 5 công thức tốt nhất)
    try:
        db = ModelTrainingDB()
        deleted = db.delete_alpha_metrics(stock_code)
        if deleted > 0:
            print(f"{stock_code}: Đã xóa {deleted} công thức cũ trong DB")
        for i in range(top_n):
            db.save_alpha_metrics(stock_code, top_alphas[i][0], 
                                top_alphas[i][1], 
                                top_alphas[i][2], 
                                top_alphas[i][3])
        print(f"{stock_code}: Đã lưu {top_n} công thức mới vào DB")
    except Exception as e:
        print(f"{stock_code}: Lỗi lưu DB: {e}")
    
    print(f"{stock_code}: ✓ Chọn được {top_n} công thức tốt nhất (RankIC: {top_alphas[0][1]:.4f} - {top_alphas[-1][1]:.4f})")
    return df_final, final_valid



def create_temp_file(filename: str):
    tmp_dir = tempfile.gettempdir()
    tmp_path = os.path.join(tmp_dir, filename)
    return tmp_path

def save_checkpoint_to_temp(checkpoint: dict, tmp_path: str):
    torch.save(checkpoint, tmp_path)


def push_checkpoint_to_ggdrive(tmp_path: str, remote_folder: str = "Checkpoints_DATN"):
    """Push checkpoint to Google Drive and remove local temp file"""
    try:
        # Chạy rclone với stderr bị suppress để tránh spam log
        subprocess.run(
            ["rclone", "copy", tmp_path, f"gdrive_model:/{remote_folder}/"], 
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except subprocess.CalledProcessError:
        # Nếu rclone fail, không làm gì (checkpoint vẫn ở local)
        pass
    except FileNotFoundError:
        # Nếu rclone không được cài đặt
        print(f"Warning: rclone not found, checkpoint saved locally only: {tmp_path}")
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
    

def pull_checkpoint_from_ggdrive(filename: str, remote_folder: str = "Checkpoints_DATN"):
    """Pull checkpoint from Google Drive and load it"""
    tmp_dir = tempfile.gettempdir()
    tmp_path_download = os.path.join(tmp_dir, filename)
    
    try:
        subprocess.run(
            ["rclone", "copyto", f"gdrive_model:/{remote_folder}/{filename}", tmp_path_download], 
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        raise Exception(f"Failed to download checkpoint from Google Drive: {e}")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    checkpoint = torch.load(tmp_path_download, map_location=device, weights_only=False)
    
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