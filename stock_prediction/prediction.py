#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'model'))

import pandas as pd
from datetime import datetime, timedelta
import pytz
from sqlalchemy import create_engine
import dotenv
from model.auto_pipeline import AutoPipeline
from model.utils import collect_data, apply_generated_alphas, pull_checkpoint_from_ggdrive
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

dotenv.load_dotenv()
POSTGRES_URL = os.getenv('POSTGRES_URL')

class StockPredictor(AutoPipeline):
    def __init__(self, stock_code):
        self.stock_code = stock_code
        self.db = self._init_db()
        self.warehouse_engine = create_engine(POSTGRES_URL)
        self.device = self._init_device()
        self.checkpoint_cache = None
        self.model_cache = None
        self.best_model_info = None
    
    def _init_db(self):
        from model.db_manager import ModelTrainingDB
        return ModelTrainingDB()
    
    def _init_device(self):
        import torch
        return torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    def get_best_model(self):
        history = self.db.get_training_history()
        candidates = []
        
        for model_name, date_train, mse_loss, alphas in history:
            if self.stock_code in model_name:
                candidates.append({
                    'model_name': model_name,
                    'mse_loss': mse_loss,
                    'alphas': alphas,
                    'date_train': date_train
                })
        
        if not candidates:
            return None
        
        candidates.sort(key=lambda x: x['mse_loss'])
        return candidates[0]
    
    def prepare_data_until(self, checkpoint, end_date):
        data = collect_data([self.stock_code])
        
        if data[self.stock_code].empty:
            return None
        
        df = data[self.stock_code].sort_values(by='trade_date')
        df['trade_date'] = pd.to_datetime(df['trade_date'])
        df = df[df['trade_date'] <= pd.to_datetime(end_date)]
        
        if df.empty:
            return None
        
        alphas = checkpoint.get('alphas', checkpoint.get('alpha_formulas', []))
        df_with_alphas, _ = apply_generated_alphas(df, self.stock_code, alphas)
        
        if df_with_alphas is None:
            logger.error(f"Không thể apply alpha formulas cho {self.stock_code}")
            return None
            
        df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
        df_with_alphas = df_with_alphas.replace([float('inf'), -float('inf')], float('nan'))
        df_with_alphas = df_with_alphas.ffill().bfill().fillna(0)
        
        window_size = checkpoint['window_size']
        if len(df_with_alphas) < window_size:
            return None
        
        last_window = df_with_alphas.tail(window_size).copy()
        
        enc_data = checkpoint['scaler_encoder'].transform(last_window[checkpoint['encoder_features']].values)
        close_data = checkpoint['scaler_close'].transform(last_window[['close']].values)
        
        last_window['trade_date'] = pd.to_datetime(last_window['trade_date'])
        day = (last_window['trade_date'].dt.day - 1).values
        week = last_window['trade_date'].dt.dayofweek.values
        month = (last_window['trade_date'].dt.month - 1).values
        
        import torch
        enc_tensor = torch.tensor(enc_data, dtype=torch.float32).unsqueeze(0).to(self.device)
        dec_tensor = torch.tensor(close_data, dtype=torch.float32).unsqueeze(0).to(self.device)
        day_tensor = torch.tensor(day, dtype=torch.long).unsqueeze(0).to(self.device)
        week_tensor = torch.tensor(week, dtype=torch.long).unsqueeze(0).to(self.device)
        month_tensor = torch.tensor(month, dtype=torch.long).unsqueeze(0).to(self.device)
        
        return enc_tensor, dec_tensor, day_tensor, week_tensor, month_tensor
    
    def save_prediction_custom(self, predicted_price, model_name, confidence, prediction_date):
        df = pd.DataFrame([{
            'stock_code': self.stock_code,
            'prediction_date': prediction_date,
            'predicted_price': predicted_price,
            'model_version': model_name,
            'confidence_score': confidence
        }])
        
        try:
            df.to_sql('fact_predictions', self.warehouse_engine, if_exists='append', index=False)
            return True
        except Exception as e:
            logger.error(f"Lỗi lưu DB: {e}")
            return False
    
    def _check_file_exists_on_drive(self, filename):
        import subprocess
        try:
            result = subprocess.run(
                ["rclone", "lsf", f"gdrive_model:/Checkpoints_DATN/{filename}"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0 and filename in result.stdout.decode()
        except:
            return False
    
    def run(self, end_date, prediction_date):
        history = self.db.get_training_history()
        candidates = []
        
        for model_name, date_train, mse_loss, alphas in history:
            if self.stock_code in model_name:
                candidates.append({
                    'model_name': model_name,
                    'mse_loss': mse_loss,
                    'alphas': alphas,
                    'date_train': date_train
                })
        
        if not candidates:
            logger.error(f"Không tìm thấy model cho {self.stock_code}")
            return None
        
        candidates.sort(key=lambda x: x['mse_loss'])
        
        if self.checkpoint_cache is None:
            for idx, best_model in enumerate(candidates):
                model_name = best_model['model_name']
                filename = f"{model_name}_best.pt"
                
                if not self._check_file_exists_on_drive(filename):
                    continue
                
                try:
                    logger.info(f"Load checkpoint {idx+1}/{len(candidates)}: {filename}")
                    self.checkpoint_cache = pull_checkpoint_from_ggdrive(filename)
                    self.model_cache = self.load_model_from_checkpoint(self.checkpoint_cache)
                    self.best_model_info = best_model
                    logger.info(f"✓ Load thành công")
                    break
                except Exception as e:
                    logger.warning(f"Lỗi load {filename}: {str(e)[:80]}")
                    continue
            
            if self.checkpoint_cache is None:
                logger.error(f"Không tìm thấy checkpoint nào khả dụng cho {self.stock_code}")
                return None
        
        best_model = self.best_model_info
        model_name = best_model['model_name']
        
        inputs = self.prepare_data_until(self.checkpoint_cache, end_date)
        
        if inputs is None:
            logger.error(f"Không đủ dữ liệu cho {self.stock_code} đến {end_date}")
            return None
        
        predicted_price = self.predict(self.model_cache, self.checkpoint_cache, inputs)
        confidence = 1 / (1 + best_model['mse_loss'])
        saved = self.save_prediction_custom(predicted_price, model_name, confidence, prediction_date)
        
        return {
            'stock_code': self.stock_code,
            'predicted_price': predicted_price,
            'model_name': model_name,
            'confidence': confidence,
            'saved': saved,
            'prediction_date': prediction_date
        }

def get_trading_dates():
    engine = create_engine(POSTGRES_URL)
    query = """
        SELECT DISTINCT trade_date 
        FROM fact_daily_prices 
        WHERE trade_date BETWEEN '2025-10-24' AND '2025-11-07'
        ORDER BY trade_date
    """
    df = pd.read_sql(query, engine)
    dates = pd.to_datetime(df['trade_date']).dt.date.tolist()
    
    date_pairs = []
    for i in range(len(dates) - 1):
        end_date = dates[i].strftime('%Y-%m-%d')
        prediction_date = dates[i + 1].strftime('%Y-%m-%d')
        date_pairs.append((end_date, prediction_date))
    
    return date_pairs

def main():
    stock_codes = sys.argv[1:] if len(sys.argv) > 1 else os.getenv('symbols', 'AAA').split(',')
    date_pairs = get_trading_dates()
    
    logger.info(f"Bắt đầu predict {len(date_pairs)} ngày cho {len(stock_codes)} mã")
    
    total_success = 0
    total_failed = 0
    
    for stock_code in stock_codes:
        logger.info(f"\n{'='*80}")
        logger.info(f"Bắt đầu predict cho mã {stock_code}")
        logger.info(f"{'='*80}")
        
        predictor = StockPredictor(stock_code)
        success_count = 0
        
        for end_date, prediction_date in date_pairs:
            try:
                result = predictor.run(end_date, prediction_date)
                
                if result:
                    saved = "✓" if result['saved'] else "✗"
                    logger.info(f"{saved} {end_date} → {prediction_date}: {result['predicted_price']:.2f}")
                    if result['saved']:
                        success_count += 1
                        total_success += 1
                    else:
                        total_failed += 1
                else:
                    logger.error(f"✗ {end_date} → {prediction_date}: Failed")
                    total_failed += 1
            except Exception as e:
                logger.error(f"✗ {end_date} → {prediction_date}: {str(e)}")
                total_failed += 1
        
        logger.info(f"Hoàn thành {stock_code}: {success_count}/{len(date_pairs)} predictions")
    
    logger.info(f"\n{'='*80}")
    logger.info(f"Tổng kết: {total_success} thành công, {total_failed} thất bại")
    logger.info(f"{'='*80}")

if __name__ == "__main__":
    main()

