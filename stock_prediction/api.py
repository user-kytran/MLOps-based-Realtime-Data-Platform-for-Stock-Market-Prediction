import warnings
warnings.filterwarnings('ignore', category=FutureWarning)
warnings.filterwarnings('ignore', message='.*google.api_core.*')

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import json
import subprocess
import time
from datetime import datetime
from model.gen_alpha import gen_all_alpha_formulas
import dotenv

dotenv.load_dotenv()
symbols = os.getenv('symbols').split(',')
os.makedirs('results', exist_ok=True)
os.makedirs('batches', exist_ok=True)

app = FastAPI(title="Stock Prediction API")

class PredictionRequest(BaseModel):
    prediction_date: str

@app.post("/stock-prediction")
def stock_prediction(request: PredictionRequest):
    try:
        datetime.strptime(request.prediction_date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    start_time = time.time()
    timestamp = datetime.now().strftime("%Y%m%d")
    stock_codes = symbols
    
    # alphas_dir = os.path.join(os.path.dirname(__file__), 'alphas')
    # alpha_files = sorted([f for f in os.listdir(alphas_dir) if f.startswith('alpha_formulas_gen_')])
    
    # if not alpha_files:
    #     raise HTTPException(status_code=500, detail="No alpha formulas file found")
    
    latest_alpha_file = gen_all_alpha_formulas(stock_codes, max_workers=40)
    with open(latest_alpha_file, 'r') as f:
        list_alpha_formulas = json.load(f)
    
    batch_size = len(stock_codes) // 5
    batches = [stock_codes[i:i+batch_size] for i in range(0, len(stock_codes), batch_size)]
    
    processes = []
    batch_files = []
    
    for i, batch in enumerate(batches):
        batch_data = {
            'stocks': batch, 
            'alphas': list_alpha_formulas,
            'prediction_date': request.prediction_date
        }
        batch_file = f'batches/batch_{i}_{timestamp}.json'
        output_file = f'results/batch_{i}_{timestamp}.json'
        
        with open(batch_file, 'w') as f:
            json.dump(batch_data, f)
        
        env = os.environ.copy()
        env['CUDA_VISIBLE_DEVICES'] = '0'
        enable_wandb = os.getenv('ENABLE_WANDB', 'false')
        proc = subprocess.Popen(
            ['python3', 'model/auto_pipeline.py', batch_file, output_file, enable_wandb],
            env=env
        )
        processes.append(proc)
        batch_files.append(output_file)
    
    for proc in processes:
        proc.wait()
    
    all_results = []
    for batch_file in batch_files:
        if os.path.exists(batch_file):
            with open(batch_file, 'r') as f:
                all_results.extend(json.load(f))
    
    results_file = f'results/predictions_{timestamp}.json'
    with open(results_file, 'w') as f:
        json.dump(all_results, f, indent=2)
    
    success_count = sum(1 for r in all_results if 'error' not in r)
    
    return {
        'status': 'success',
        'total_stocks': len(stock_codes),
        'success_count': success_count,
        'failed_count': len(stock_codes) - success_count,
        'total_time_seconds': round(time.time() - start_time, 2),
        'results_file': results_file
    }



if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
