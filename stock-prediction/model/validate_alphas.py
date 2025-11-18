"""
Script to validate and clean generated alpha formulas
"""
import json
import re
from utils import collect_data

def validate_formula(formula: str) -> tuple[bool, str]:
    """
    Validate a formula and return (is_valid, reason)
    """
    # Check for forbidden functions
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
            return False, f"Contains forbidden function: {pattern}"
    
    # Check for empty formula
    if not formula or formula.strip() == "":
        return False, "Empty formula"
    
    return True, "OK"


def validate_alpha_file(filepath: str = 'alpha_formulas_gen.json'):
    """
    Validate all formulas in the generated file
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    issues = {}
    
    for stock_code, formulas in data.items():
        stock_issues = []
        
        if len(formulas) != 5:
            stock_issues.append(f"Wrong number of formulas: {len(formulas)}/5")
        
        for i, formula in enumerate(formulas, 1):
            is_valid, reason = validate_formula(formula)
            if not is_valid:
                stock_issues.append(f"Alpha{i}: {reason} - '{formula}'")
        
        if stock_issues:
            issues[stock_code] = stock_issues
    
    return issues


def test_formulas_on_real_data(stock_code: str, formulas: list):
    """
    Test if formulas can be applied to real data
    """
    try:
        data = collect_data([stock_code])
        if data[stock_code].empty:
            return False, "No data available"
        
        df = data[stock_code].sort_values(by='trade_date')
        
        for i, formula in enumerate(formulas, 1):
            try:
                # Extract expression
                expr = formula.split("=", 1)[-1].strip() if "=" in formula else formula.strip()
                
                # Try to evaluate
                df.eval(expr, inplace=False)
                
            except Exception as e:
                return False, f"Alpha{i} failed: {str(e)}"
        
        return True, "All formulas valid"
        
    except Exception as e:
        return False, f"Error: {str(e)}"


if __name__ == "__main__":
    print("Validating alpha formulas...")
    print("=" * 60)
    
    issues = validate_alpha_file()
    
    if issues:
        print(f"\nFound issues in {len(issues)} stocks:\n")
        for stock_code, stock_issues in issues.items():
            print(f"\n{stock_code}:")
            for issue in stock_issues:
                print(f"  - {issue}")
    else:
        print("\n✓ All formulas passed validation!")
    
    print("\n" + "=" * 60)
    print(f"Total stocks checked: 285")
    print(f"Stocks with issues: {len(issues)}")
    print(f"Success rate: {(285 - len(issues)) / 285 * 100:.2f}%")
    
    # Test a few random stocks on real data
    print("\n" + "=" * 60)
    print("Testing formulas on real data...")
    
    test_stocks = ["STB", "ADP", "HID", "SGN", "VCB", "FPT"]
    
    with open('alpha_formulas_gen.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    for stock in test_stocks:
        if stock in data:
            is_valid, message = test_formulas_on_real_data(stock, data[stock])
            status = "✓" if is_valid else "✗"
            print(f"{status} {stock}: {message}")
