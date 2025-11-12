from .utils import collect_data, generate_stock_alphas, apply_generated_alphas
import json
import os
from tqdm import tqdm
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
import warnings
from datetime import datetime
warnings.filterwarnings("ignore")

# Tạo thư mục alphas nếu chưa tồn tại
os.makedirs('alphas', exist_ok=True)

# Lock để đảm bảo thread-safe khi ghi file
file_lock = threading.Lock()

def process_single_stock(stock_code, retry_queue=None):
    """
    Xử lý một mã cổ phiếu duy nhất
    """
    try:
        # Thu thập dữ liệu
        data = collect_data([stock_code])
        if data[stock_code].empty:
            print(f"\n[{stock_code}] Không có dữ liệu")
            return None, stock_code
        
        # Sắp xếp dữ liệu
        data[stock_code] = data[stock_code].sort_values(by='trade_date')
        
        # Generate alpha formulas
        alpha_formulas = generate_stock_alphas(data, stock_key=stock_code)
        alpha_formulas = [alpha.strip() for alpha in alpha_formulas if alpha.strip()]
        
        # Validate we have exactly 5 formulas
        if len(alpha_formulas) != 5:
            print(f"\n[{stock_code}] Số lượng công thức không hợp lệ: {len(alpha_formulas)}/5")
            if retry_queue is not None:
                retry_queue.append(stock_code)
            return None, stock_code
        
        # Apply alphas
        df_with_alphas, alpha_formulas = apply_generated_alphas(
            data[stock_code], stock_code, alpha_formulas
        )
        
        if df_with_alphas is None:
            # Đưa vào queue retry nếu thất bại
            if retry_queue is not None:
                retry_queue.append(stock_code)
            return None, stock_code
        else:
            return alpha_formulas, stock_code
            
    except Exception as e:
        print(f"\n[{stock_code}] Lỗi: {str(e)}")
        if retry_queue is not None:
            retry_queue.append(stock_code)
        return None, stock_code


def gen_all_alpha_formulas(stock_codes: list, max_workers=10, max_retries=3):
    """
    Generate alpha formulas cho tất cả mã cổ phiếu sử dụng đa luồng
    
    Args:
        stock_codes: Danh sách mã cổ phiếu
        max_workers: Số lượng thread tối đa
        max_retries: Số lần retry tối đa cho mỗi mã
    """
    list_alpha_formulas = {}
    retry_queue = []
    
    # Xử lý lần đầu
    print(f"Bắt đầu xử lý {len(stock_codes)} mã cổ phiếu với {max_workers} threads...")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Submit tất cả các tasks
        future_to_stock = {
            executor.submit(process_single_stock, stock_code, retry_queue): stock_code 
            for stock_code in stock_codes
        }
        
        # Theo dõi tiến trình với tqdm
        with tqdm(total=len(stock_codes), desc="Đang xử lý") as pbar:
            for future in as_completed(future_to_stock):
                alpha_formulas, stock_code = future.result()
                
                if alpha_formulas is not None:
                    # Lưu kết quả thành công
                    with file_lock:
                        list_alpha_formulas[stock_code] = alpha_formulas
                        # Ghi file sau mỗi lần thành công
                        with open(f'alphas/alpha_formulas_gen_{datetime.now().strftime("%Y%m%d")}.json', 'w', encoding='utf-8') as f:
                            json.dump(list_alpha_formulas, f, ensure_ascii=False, indent=4)
                
                pbar.update(1)
    
    # Retry các mã bị lỗi
    retry_count = 0
    while len(retry_queue) > 0 and retry_count < max_retries:
        retry_count += 1
        current_retry = retry_queue.copy()
        retry_queue.clear()
        
        print(f"\nRetry lần {retry_count}: {len(current_retry)} mã cổ phiếu...")
        
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_stock = {
                executor.submit(process_single_stock, stock_code, retry_queue): stock_code 
                for stock_code in current_retry
            }
            
            with tqdm(total=len(current_retry), desc=f"Retry {retry_count}") as pbar:
                for future in as_completed(future_to_stock):
                    alpha_formulas, stock_code = future.result()
                    
                    if alpha_formulas is not None:
                        with file_lock:
                            list_alpha_formulas[stock_code] = alpha_formulas
                            with open(f'alphas/alpha_formulas_gen_{datetime.now().strftime("%Y%m%d")}.json', 'w', encoding='utf-8') as f:
                                json.dump(list_alpha_formulas, f, ensure_ascii=False, indent=4)
                    
                    pbar.update(1)
    
    # In kết quả
    print(f"\n{'='*60}")
    print(f"Hoàn thành! Đã xử lý thành công: {len(list_alpha_formulas)}/{len(stock_codes)} mã")
    if len(retry_queue) > 0:
        print(f"Các mã thất bại sau {max_retries} lần retry: {retry_queue}")
    print(f"{'='*60}\n")
    
    return list_alpha_formulas


if __name__ == "__main__":
    stock_codes = ["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]
    
    # Có thể điều chỉnh số lượng workers
    list_alpha_formulas = gen_all_alpha_formulas(stock_codes, max_workers=20)
    
    print("\nTổng số alpha formulas đã generate:")
    for stock, formulas in list_alpha_formulas.items():
        print(f"{stock}: {len(formulas)} formulas")