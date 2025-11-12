#!/usr/bin/env python3
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'model'))

from auto_pipeline import AutoPipeline

def main():
    stock_codes = sys.argv[1:] if len(sys.argv) > 1 else ['AAA']
    
    for stock_code in stock_codes:
        try:
            pipeline = AutoPipeline(stock_code)
            result = pipeline.run()
            
            if result:
                status = "NEW" if result['new_model_used'] else "OLD"
                saved = "✓" if result['saved'] else "✗"
                print(f"{saved} {stock_code}: {result['predicted_price']:.2f} [{status}] conf={result['confidence']:.3f}")
            else:
                print(f"✗ {stock_code}: Failed to process")
        except Exception as e:
            print(f"✗ {stock_code}: Error - {str(e)}")

if __name__ == "__main__":
    main()
