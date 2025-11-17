import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', message='.*google.api_core.*')

import torch
import torch.nn as nn
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
import pytz
from sqlalchemy import create_engine
from torch.utils.data import DataLoader
import sqlite3
import json
import os
import sys
import threading
import wandb
from concurrent.futures import ThreadPoolExecutor, as_completed
import dotenv

# Thêm thư mục cha vào sys.path để import được các module
if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    sys.path.insert(0, parent_dir)

from model.db_manager import ModelTrainingDB
from model.utils import (collect_data, generate_stock_alphas, apply_generated_alphas,
                   push_checkpoint_to_ggdrive, pull_checkpoint_from_ggdrive,
                   save_checkpoint_to_temp, create_temp_file, select_best_alphas)
from model.dataset import StockDataset
from model.gen_alpha import gen_all_alpha_formulas
from model.models import StockTransformer, StockLSTM

dotenv.load_dotenv()
WANDB_API_KEY = os.getenv('WANDB_API_KEY', '').strip('"\'')
POSTGRES_URL = os.getenv('POSTGRES_URL', '').strip('"\'')

db_lock = threading.Lock()

class AutoPipeline:
    def __init__(self, stock_code, db_path=None, enable_wandb=True, prediction_date=None):
        self.stock_code = stock_code
        self.db = ModelTrainingDB(db_path)
        self.warehouse_engine = create_engine(POSTGRES_URL)
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.timestamp = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y%m%d_%H%M%S")
        self.enable_wandb = enable_wandb
        self.prediction_date = prediction_date
        
        if self.enable_wandb:
            os.environ['WANDB_API_KEY'] = WANDB_API_KEY
            wandb.init(
                project=f'stock-training-{stock_code}',
                name=f'train_{self.timestamp}',
                config={
                    'stock_code': stock_code,
                    'window_size': 5,
                    'batch_size': 128,
                    'epochs': 30,
                    'learning_rate': 1e-4
                },
                tags=['auto-pipeline', 'production'],
                reinit=True
            )
        
    def get_yesterday_best_model(self):
        yesterday = (datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")) - timedelta(days=1)).strftime("%d/%m/%Y")
        with db_lock:  # Đồng bộ truy cập database
            conn = sqlite3.connect(self.db.db_path)
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT model_name, mse_loss, alphas
                FROM train_stock_model
                WHERE model_name LIKE ? AND date_train = ?
                ORDER BY mse_loss ASC LIMIT 1
            """, (f"%_{self.stock_code}_%", yesterday))
            
            row = cursor.fetchone()
            conn.close()
        
        if not row:
            return None
        
        return {
            'model_name': row[0],
            'mse_loss': row[1],
            'alphas': json.loads(row[2])
        }
    
    def train_models(self, alpha_formulas):
        data = collect_data([self.stock_code], end_date=self.prediction_date)
        if data[self.stock_code].empty:
            return None, None, None, None
        
        data[self.stock_code] = data[self.stock_code].sort_values(by='trade_date')
        
        # result = generate_stock_alphas(data, stock_key=self.stock_code)
        # print(result)
        # alpha_formulas = [alpha.strip() for alpha in result]
        df_with_alphas, best_alphas = select_best_alphas(data[self.stock_code], self.stock_code, alpha_formulas)
        
        if df_with_alphas is None:
            return None, None, None, None
        
        df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
        df_with_alphas = df_with_alphas.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0)
        
        dataset = StockDataset(df_with_alphas, window_size=5)
        
        if len(dataset) < 50:
            return None, None, None, None
            
        train_size = int(len(dataset) * 0.8)
        train_dataset, val_dataset = torch.utils.data.random_split(
            dataset, [train_size, len(dataset) - train_size]
        )
        
        train_loader = DataLoader(train_dataset, batch_size=128, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=128, shuffle=False)
        
        transformer_model = StockTransformer(
            num_encoder_features=5,
            num_decoder_features=1,
            d_model=512,
            nhead=8,
            num_layers=3,
            dropout=0.1
        ).to(self.device)
        lstm_model = StockLSTM(
            num_encoder_features=5,
            num_decoder_features=1,
            hidden_size=512,
            num_layers=3,
            dropout=0.1
        ).to(self.device)
        
        results = {}
        
        def train_transformer():
            if self.enable_wandb:
                wandb.watch(transformer_model, log="all", log_freq=10)
            results['transformer'] = self._train_single_model(
                transformer_model, "Transformer", train_loader, val_loader, best_alphas
            )
        
        def train_lstm():
            if self.enable_wandb:
                wandb.watch(lstm_model, log="all", log_freq=10)
            results['lstm'] = self._train_single_model(
                lstm_model, "LSTM", train_loader, val_loader, best_alphas
            )
        
        t1 = threading.Thread(target=train_transformer)
        t2 = threading.Thread(target=train_lstm)
        t1.start()
        t2.start()
        t1.join()
        t2.join()
        
        trans_checkpoint, trans_loss = results['transformer']
        lstm_checkpoint, lstm_loss = results['lstm']
        
        if trans_loss < lstm_loss:
            return trans_checkpoint, trans_loss, best_alphas, "Transformer"
        else:
            return lstm_checkpoint, lstm_loss, best_alphas, "LSTM"
    
    def _train_single_model(self, model, model_type, train_loader, val_loader, alphas):
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
        best_val_loss = float("inf")
        best_checkpoint = None
        
        if self.enable_wandb:
            wandb.watch(model, log="all", log_freq=10)
        
        for epoch in range(30):
            model.train()
            train_loss = 0.0
            for X_enc, X_dec, y_batch, d, w, m in train_loader:
                X_enc, X_dec, y_batch = X_enc.to(self.device), X_dec.to(self.device), y_batch.to(self.device)
                d, w, m = d.to(self.device), w.to(self.device), m.to(self.device)
                
                optimizer.zero_grad()
                y_pred = model(X_enc, X_dec, d, w, m).squeeze()
                loss = criterion(y_pred, y_batch)
                
                if torch.isnan(loss) or torch.isinf(loss):
                    continue
                    
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                train_loss += loss.item()
            
            model.eval()
            val_loss = 0.0
            with torch.no_grad():
                for X_enc, X_dec, y_batch, d, w, m in val_loader:
                    X_enc, X_dec, y_batch = X_enc.to(self.device), X_dec.to(self.device), y_batch.to(self.device)
                    d, w, m = d.to(self.device), w.to(self.device), m.to(self.device)
                    y_pred = model(X_enc, X_dec, d, w, m).squeeze()
                    val_loss += criterion(y_pred, y_batch).item()
            
            avg_train_loss = train_loss / len(train_loader)
            avg_val_loss = val_loss / len(val_loader)
            
            if self.enable_wandb:
                wandb.log({
                    f"{model_type}_epoch": epoch + 1,
                    f"{model_type}_train_loss": avg_train_loss,
                    f"{model_type}_val_loss": avg_val_loss,
                })
            
            if avg_val_loss < best_val_loss:
                best_val_loss = avg_val_loss
                dataset_obj = train_loader.dataset.dataset if hasattr(train_loader.dataset, 'dataset') else train_loader.dataset
                best_checkpoint = {
                    'epoch': epoch + 1,
                    'model_state_dict': model.state_dict(),
                    'optimizer_state_dict': optimizer.state_dict(),
                    'train_loss': avg_train_loss,
                    'val_loss': avg_val_loss,
                    'timestamp': self.timestamp,
                    'stock_code': self.stock_code,
                    'model_type': model_type,
                    'scaler_close': dataset_obj.scaler_close,
                    'scaler_encoder': dataset_obj.scaler_encoder,
                    'window_size': dataset_obj.window_size,
                    'encoder_features': dataset_obj.encoder_features,
                    'decoder_features': dataset_obj.decoder_features,
                    'alphas': alphas
                }
                if self.enable_wandb:
                    wandb.run.summary[f"{model_type}_best_val_loss"] = best_val_loss
                    wandb.run.summary[f"{model_type}_best_epoch"] = epoch + 1
        
        return best_checkpoint, best_val_loss
    
    def load_model_from_checkpoint(self, checkpoint):
        model_type = checkpoint['model_type']
        
        if model_type == 'Transformer':
            model = StockTransformer(5, 1, 512, 8, 3, 0.1).to(self.device)
        else:
            model = StockLSTM(5, 1, 512, 3, 0.1).to(self.device)
        
        model.load_state_dict(checkpoint['model_state_dict'])
        model.eval()
        return model
    
    def prepare_predict_input(self, checkpoint):
        data = collect_data([self.stock_code], end_date=self.prediction_date)
        if data[self.stock_code].empty:
            return None
        
        df = data[self.stock_code].sort_values(by='trade_date')
        alphas = checkpoint.get('alphas', checkpoint.get('alpha_formulas', []))
        df_with_alphas, _ = apply_generated_alphas(df, self.stock_code, alphas)
        
        if df_with_alphas is None:
            return None
        
        df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
        df_with_alphas = df_with_alphas.replace([np.inf, -np.inf], np.nan).ffill().bfill().fillna(0)
        
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
        
        enc_tensor = torch.tensor(enc_data, dtype=torch.float32).unsqueeze(0).to(self.device)
        dec_tensor = torch.tensor(close_data, dtype=torch.float32).unsqueeze(0).to(self.device)
        day_tensor = torch.tensor(day, dtype=torch.long).unsqueeze(0).to(self.device)
        week_tensor = torch.tensor(week, dtype=torch.long).unsqueeze(0).to(self.device)
        month_tensor = torch.tensor(month, dtype=torch.long).unsqueeze(0).to(self.device)
        
        return enc_tensor, dec_tensor, day_tensor, week_tensor, month_tensor
    
    def predict(self, model, checkpoint, inputs):
        enc, dec, day, week, month = inputs
        
        with torch.no_grad():
            prediction_scaled = model(enc, dec, day, week, month)
        
        prediction = checkpoint['scaler_close'].inverse_transform(
            prediction_scaled.cpu().numpy().reshape(-1, 1)
        )[0][0]
        
        return float(prediction)
    
    def save_prediction_to_warehouse(self, predicted_price, model_name, confidence):
        try:
            from sqlalchemy import text
            
            sql = text("""
                INSERT INTO fact_predictions 
                (stock_code, prediction_date, predicted_price, model_version, confidence_score)
                VALUES (:stock_code, :prediction_date, :predicted_price, :model_version, :confidence_score)
                ON CONFLICT (stock_code, prediction_date) 
                DO UPDATE SET 
                    predicted_price = EXCLUDED.predicted_price,
                    model_version = EXCLUDED.model_version,
                    confidence_score = EXCLUDED.confidence_score
            """)
            
            with self.warehouse_engine.begin() as conn:
                conn.execute(sql, {
                    'stock_code': self.stock_code,
                    'prediction_date': self.prediction_date,
                    'predicted_price': predicted_price,
                    'model_version': model_name,
                    'confidence_score': confidence
                })
            return True
        except Exception as e:
            print(f"Lỗi lưu warehouse cho {self.stock_code}: {e}")
            return False
    
    def run(self, alpha_formulas):
        yesterday_model = self.get_yesterday_best_model()
        
        new_checkpoint, new_loss, alphas, model_type = self.train_models(alpha_formulas)
        if new_checkpoint is None:
            return None
        
        use_new_model = True
        if yesterday_model and yesterday_model['mse_loss'] < new_loss:
            try:
                model_name = yesterday_model['model_name']
                filename = f"{model_name}_best.pt"
                checkpoint = pull_checkpoint_from_ggdrive(filename)
                confidence = 1 / (1 + yesterday_model['mse_loss'])
                use_new_model = False
            except Exception:
                use_new_model = True
        
        if use_new_model:
            model_name = f"StockModel_{self.stock_code}_{self.timestamp}_{model_type}"
            filename = f"{model_name}_best.pt"
            tmp_path = create_temp_file(filename)
            save_checkpoint_to_temp(new_checkpoint, tmp_path)
            push_checkpoint_to_ggdrive(tmp_path)
            
            with db_lock:  # Đồng bộ khi ghi database
                self.db.save_training_info(model_name, new_loss, alphas)
            
            checkpoint = new_checkpoint
            confidence = 1 / (1 + new_loss)
        
        model = self.load_model_from_checkpoint(checkpoint)
        inputs = self.prepare_predict_input(checkpoint)
        if inputs is None:
            return None
        
        max_retries = 5
        predicted_price = None
        for attempt in range(max_retries):
            predicted_price = self.predict(model, checkpoint, inputs)
            try:
                price_float = float(predicted_price)
                if not np.isnan(price_float) and np.isfinite(price_float):
                    break
            except: pass
        try:
            price_float = float(predicted_price)
            is_valid = not np.isnan(price_float) and np.isfinite(price_float)
        except: is_valid = False
        if is_valid: saved = self.save_prediction_to_warehouse(predicted_price, model_name, confidence)
        else: saved = False
        
        if self.enable_wandb:
            wandb.run.summary.update({
                'best_model_type': model_type,
                'best_val_loss': new_loss,
                'final_predicted_price': predicted_price,
                'final_confidence': confidence,
                'model_used': model_name,
                'new_model_used': use_new_model,
                'saved_to_warehouse': saved
            })
            wandb.finish()
        
        return {
            'stock_code': self.stock_code,
            'predicted_price': predicted_price,
            'model_name': model_name,
            'confidence': confidence,
            'new_model_used': use_new_model,
            'saved': saved
        }


def train_batch(stock_codes, alpha_formulas_dict, output_file, enable_wandb=False, prediction_date=None):
    results = []
    for stock_code in stock_codes:
        try:
            pipeline = AutoPipeline(stock_code, enable_wandb=enable_wandb, prediction_date=prediction_date)
            result = pipeline.run(alpha_formulas_dict.get(stock_code, []))
            if result:
                results.append(result)
            else:
                results.append({'stock_code': stock_code, 'error': 'No result'})
        except Exception as e:
            results.append({'stock_code': stock_code, 'error': str(e)})
    
    with open(output_file, 'w') as f:
        json.dump(results, f, indent=2)
    return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        batch_file = sys.argv[1]
        output_file = sys.argv[2]
        enable_wandb = sys.argv[3].lower() == 'true' if len(sys.argv) > 3 else False
        with open(batch_file, 'r') as f:
            data = json.load(f)
        prediction_date = data.get('prediction_date')
        train_batch(data['stocks'], data['alphas'], output_file, enable_wandb, prediction_date)
    else:
        stock_codes = ["AAA","AAM","ABS"]
        with open('/home/bbsw/obito/model/alphas/alpha_formulas_gen_20251115.json', 'r') as f:
            alphas = json.load(f)
        train_batch(stock_codes, alphas, 'test_output.json', enable_wandb=True, prediction_date='2025-11-16')