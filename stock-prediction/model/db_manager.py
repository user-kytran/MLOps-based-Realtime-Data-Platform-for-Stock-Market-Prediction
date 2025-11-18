import sqlite3
import json
from datetime import datetime
import os
import pytz

class ModelTrainingDB:
    def __init__(self, db_path=None):
        if db_path is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            db_path = os.path.join(base_dir, "init", "stock_models.db")
        self.db_path = db_path
    
    def save_training_info(self, model_name, mse_loss, alphas_list):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        date_train = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y")
        alphas_json = json.dumps(alphas_list, ensure_ascii=False)
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO train_stock_model 
                (model_name, date_train, mse_loss, alphas)
                VALUES (?, ?, ?, ?)
            ''', (model_name, date_train, mse_loss, alphas_json))
            conn.commit()
            return True
        except Exception as e:
            return False
        finally:
            conn.close()
    
    def get_training_history(self, model_name=None):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if model_name:
            cursor.execute('''
                SELECT model_name, date_train, mse_loss, alphas
                FROM train_stock_model
                WHERE model_name = ?
                ORDER BY date_train DESC
            ''', (model_name,))
        else:
            cursor.execute('''
                SELECT model_name, date_train, mse_loss, alphas
                FROM train_stock_model
                ORDER BY date_train DESC
            ''')
        
        results = cursor.fetchall()
        conn.close()
        
        parsed_results = []
        for row in results:
            model_name, date_train, mse_loss, alphas_json = row
            alphas = json.loads(alphas_json)
            parsed_results.append((model_name, date_train, mse_loss, alphas))
        
        return parsed_results
    
    def get_best_model_by_symbol(self, symbol: str):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        today = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y")

        cursor.execute("""
            SELECT model_name, date_train, mse_loss, alphas
            FROM train_stock_model
            WHERE date_train = ?
              AND model_name LIKE ?
            ORDER BY mse_loss ASC
            LIMIT 1
        """, (today, f"%_{symbol}"))

        row = cursor.fetchone()
        conn.close()

        if not row:
            print(f"⚠️ Không tìm thấy model cho mã {symbol} vào ngày {today}")
            return None

        model_name, date_train, mse_loss, alphas_json = row
        try:
            alphas = json.loads(alphas_json)
        except Exception:
            alphas = alphas_json  # fallback nếu không phải JSON

        return {
            "symbol": symbol,
            "model_name": model_name,
            "date_train": date_train,
            "mse_loss": mse_loss,
            "alphas": alphas
        }
    
    def delete_training(self, model_name, date_train):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            DELETE FROM train_stock_model
            WHERE model_name = ? AND date_train = ?
        ''', (model_name, date_train))
        conn.commit()
        deleted_count = cursor.rowcount
        conn.close()
        return deleted_count > 0

    def get_alpha_metrics(self, stock_code):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('''
            SELECT stock_code, alpha_formula, rank_ic, pvalue, n_samples FROM stock_alpha_metrics WHERE stock_code = ?
        ''', (stock_code,))
        results = cursor.fetchall()
        conn.close()
        return results

    def delete_alpha_metrics(self, stock_code):
        """Xóa tất cả công thức alpha của một mã cổ phiếu"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        try:
            cursor.execute('''
                DELETE FROM stock_alpha_metrics WHERE stock_code = ?
            ''', (stock_code,))
            conn.commit()
            deleted_count = cursor.rowcount
            return deleted_count
        finally:
            conn.close()
    
    def save_alpha_metrics(self, stock_code, alpha_formula, rank_ic, pvalue, n_samples):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        date_calculated = datetime.now(pytz.timezone("Asia/Ho_Chi_Minh")).strftime("%d/%m/%Y")
        
        try:
            cursor.execute('''
                INSERT OR REPLACE INTO stock_alpha_metrics 
                (stock_code, alpha_formula, rank_ic, pvalue, n_samples, date_calculated)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (stock_code, alpha_formula, rank_ic, pvalue, n_samples, date_calculated))
            conn.commit()
        finally:
            conn.close()
    

if __name__ == "__main__":
    db = ModelTrainingDB()
    # db.save_training_info("LSMT_AAA", 0.1234, ["alpha1", "alpha2"])
    # db.save_training_info("TRANSFORMER_AAA", 0.5678, ["alpha3", "alpha4"])
    # db.save_training_info("GRU_AAA", 0.0345, ["alpha5", "alpha6"])
    # db.save_training_info("SVR_AAA", 0.2345, ["alpha7", "alpha8"])
    # history = db.get_training_history()
    # best_models = db.get_best_models()
    # # print(history)
    # print(best_models)
    print(db.delete_training("StockModel_VTP_20251109_021121_Transformer", "08/11/2025"))