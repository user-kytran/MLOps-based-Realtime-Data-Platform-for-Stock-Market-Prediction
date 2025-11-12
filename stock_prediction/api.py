from fastapi import FastAPI
import sys
import os
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
import threading
from model.auto_pipeline import AutoPipeline
from model.gen_alpha import gen_all_alpha_formulas
import wandb
import dotenv
import time


dotenv.load_dotenv()
symbols = os.getenv('symbols').split(',')
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'model'))
os.makedirs('results', exist_ok=True)

app = FastAPI(title="Stock Prediction API")


@app.post("/stock-prediction")
def stock_prediction():
    results_file = f'results/predictions_{datetime.now().strftime("%Y%m%d")}.json'
    stock_codes = symbols
    list_alpha_formulas = gen_all_alpha_formulas(stock_codes, max_workers=20)
    results = []
    for stock_code in stock_codes:
        pipeline = None
        start_time = time.time()
        try:
            pipeline = AutoPipeline(stock_code)
            result = pipeline.run(list_alpha_formulas[stock_code])
            if result:
                results.append({
                    'stock_code': stock_code,
                    'predicted_price': result['predicted_price'],
                    'confidence': result['confidence'],
                    'model_name': result['model_name'],
                    'new_model': result['new_model_used'],
                    'saved': result['saved'],
                    'total_time': time.time() - start_time
                })
        except Exception as e:
            results.append({'stock_code': stock_code, 'error': str(e), 'total_time': time.time() - start_time})
        finally:
            if pipeline is not None and wandb.run is not None:
                wandb.finish()

        with open(results_file, 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=4)
    
    return {'status': 'success', 'results': results}



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
