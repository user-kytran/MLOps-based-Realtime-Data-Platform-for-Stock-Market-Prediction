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
import threading
import wandb
import weave
from .db_manager import ModelTrainingDB
from .utils import (collect_data, generate_stock_alphas, apply_generated_alphas,
                   push_checkpoint_to_ggdrive, pull_checkpoint_from_ggdrive,
                   save_checkpoint_to_temp, create_temp_file)
from .dataset import StockDataset
from .gen_alpha import gen_all_alpha_formulas
from .models import StockTransformer, StockLSTM
import dotenv

dotenv.load_dotenv()
WANDB_API_KEY = os.getenv('WANDB_API_KEY')
POSTGRES_URL = os.getenv('POSTGRES_URL')
class AutoPipeline:
    def __init__(self, stock_code, db_path=None):
        self.stock_code = stock_code
        self.db = ModelTrainingDB(db_path)
        self.warehouse_engine = create_engine(
            POSTGRES_URL
        )
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.timestamp = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%Y%m%d_%H%M%S")
        
        os.environ['WANDB_API_KEY'] = WANDB_API_KEY
        wandb.init(
            project='graduation-stock-prediction',
            name=f'{stock_code}_{self.timestamp}',
            config={
                'stock_code': stock_code
            },
            tags=['auto-pipeline', stock_code],
            reinit=True  # Cho phép tạo run mới khi xử lý nhiều stock
        )
        
    def get_yesterday_best_model(self):
        yesterday = (datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")) - timedelta(days=1)).strftime("%d/%m/%Y")
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
        data = collect_data([self.stock_code])
        if data[self.stock_code].empty:
            return None, None, None, None
        
        data[self.stock_code] = data[self.stock_code].sort_values(by='trade_date')
        
        # result = generate_stock_alphas(data, stock_key=self.stock_code)
        # print(result)
        # alpha_formulas = [alpha.strip() for alpha in result]
        df_with_alphas, _ = apply_generated_alphas(data[self.stock_code], self.stock_code, alpha_formulas)
        df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
        
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
            wandb.watch(transformer_model, log="all", log_freq=10)
            results['transformer'] = self._train_single_model(
                transformer_model, "Transformer", train_loader, val_loader, alpha_formulas
            )
        
        def train_lstm():
            wandb.watch(lstm_model, log="all", log_freq=10)
            results['lstm'] = self._train_single_model(
                lstm_model, "LSTM", train_loader, val_loader, alpha_formulas
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
            return trans_checkpoint, trans_loss, alpha_formulas, "Transformer"
        else:
            return lstm_checkpoint, lstm_loss, alpha_formulas, "LSTM"
    
    def _train_single_model(self, model, model_type, train_loader, val_loader, alphas):
        criterion = nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=1e-4)
        best_val_loss = float("inf")
        best_checkpoint = None
        
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
        data = collect_data([self.stock_code])
        if data[self.stock_code].empty:
            return None
        
        df = data[self.stock_code].sort_values(by='trade_date')
        alphas = checkpoint.get('alphas', checkpoint.get('alpha_formulas', []))
        df_with_alphas, _ = apply_generated_alphas(df, self.stock_code, alphas)
        df_with_alphas = df_with_alphas.drop(columns=['stock_code'])
        
        window_size = checkpoint['window_size']
        if len(df_with_alphas) < window_size:
            return None
        
        last_window = df_with_alphas.tail(window_size)
        
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
        df = pd.DataFrame([{
            'stock_code': self.stock_code,
            'prediction_date': (datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")) + timedelta(days=1)).strftime("%Y-%m-%d"),
            'predicted_price': predicted_price,
            'model_version': model_name,
            'confidence_score': confidence
        }])
        
        try:
            df.to_sql('fact_predictions', self.warehouse_engine, if_exists='append', index=False)
            return True
        except:
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
            
            self.db.save_training_info(model_name, new_loss, alphas)
            
            checkpoint = new_checkpoint
            confidence = 1 / (1 + new_loss)
        
        model = self.load_model_from_checkpoint(checkpoint)
        inputs = self.prepare_predict_input(checkpoint)
        if inputs is None:
            return None
        
        predicted_price = self.predict(model, checkpoint, inputs)
        saved = self.save_prediction_to_warehouse(predicted_price, model_name, confidence)
        
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


if __name__ == "__main__":

    stock_codes = ["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]
    # list_alpha_formulas = gen_all_alpha_formulas(stock_codes, max_workers=20, max_retries=3)
    with open('alpha_formulas_gen.json', 'r', encoding='utf-8') as f:
        list_alpha_formulas = json.load(f)
    for stock_code in stock_codes:
        pipeline = None
        try:
            pipeline = AutoPipeline(stock_code)
            result = pipeline.run(list_alpha_formulas[stock_code])
                
            if result:
                status = "NEW" if result['new_model_used'] else "OLD"
                saved = "✓" if result['saved'] else "✗"
                print(f"{saved} {stock_code}: {result['predicted_price']:.2f} [{status}] conf={result['confidence']:.3f}")
        except Exception as e:
            print(f"✗ {stock_code}: Error - {str(e)}")
        finally:
            # Đảm bảo đóng wandb run khi có lỗi hoặc hoàn thành
            if pipeline is not None and wandb.run is not None:
                wandb.finish()