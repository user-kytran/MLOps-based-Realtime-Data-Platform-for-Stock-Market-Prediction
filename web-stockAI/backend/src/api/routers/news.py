import select
from ...db import get_db
from fastapi import Depends, APIRouter
from datetime import datetime, timedelta
import pandas as pd

new_router = APIRouter()

# -------- Sector mapping (normalize symbol by stripping .VN) --------
def normalize_symbol(symbol: str) -> str:
    try:
        return symbol.replace('.VN', '').upper()
    except Exception:
        return symbol

SECTOR_MAPPING: dict[str, list[str]] = {
    "Consumer_Cyclical": ['AAA','ADS','CSM','CTF','DAH','DPR','DRC','DSN','EVE','FRT','GDT','GIL','GVR','HAX','HTG','HTN','HVH','KMR','MCP','MSH','MWG','PNJ','SAV','SFC','ST8','STK','TCM','TCT','TDP','TMT','TTF'],
    "Consumer_Defensive": ['AAM','ABT','ACL','ANV','BAF','CLC','CMX','DBC','FMC','HSL','IDI','KDC','LAF','LIX','LSS','MCM','NAF','NSC','PAN','PHR','SAB','SBT','SMB','SVT','TSC','VHC','VNM'],
    "Basic_Materials": ['ABS','ACC','ADP','APH','BFC','BKG','BMC','C32','CSV','CTI','DCM','DGC','DHA','DHC','DPM','FCM','HAP','HHP','HII','HPG','HSG','HT1','KSB','LBM','NHH','NKG','NNC','PLP','QCG','RYG','SFG','SHI','TDC','THG','TLH','TNI','TNT','TRC','VCA','VFG','YBM'],
    "Financial_Services": ['ACB','AGR','APG','BIC','BID','BMI','BSI','BVH','CTG','CTS','DSC','DSE','EIB','EVF','FIT','FTS','HCM','HDB','LPB','MBB','MIG','MSB','NAB','OCB','ORS','SHB','SSB','SSI','STB','TCB','TCI','TPB','TVS','VCB','VCI','VDS','VIB','VIX','VND','VPB'],
    "Communication_Services": ['ADG','ICT','YEG'],
    "Real_Estate": ['AGG','ASM','BCM','CCL','CRE','DIG','DTA','DXG','DXS','FIR','HAG','HAR','HDC','HDG','HPX','HQC','ITC','KBC','KDH','KHG','KOS','LHG','NBB','NLG','PDR','SCR','SGR','SIP','SJS','SZC','SZL','TEG','UIC','VHM','VIC','VPH','VPI','VRE'],
    "Utilities": ['ASP','BTP','CNG','DRL','GSP','KHP','NT2','POW','PPC','SJD','TDG','TTA'],
    "Industrials": ['AST','BCE','BMP','BRC','BWE','CDC','CII','CLL','CRC','CTD','CTR','D2D','DC4','DHM','DPG','DVP','FCN','GEE','GEX','GMD','HAH','HCD','HHS','HHV','HID','HMC','HTI','HUB','IJC','ILB','LCG','MHC','MSN','NCT','NHA','NO1','NTL','OGC','PAC','PC1','PHC','PIT','PTB','PTC','PTL','PVP','PVT','RAL','REE','SAM','SBG','SCS','SGN','SKG','TCH','TCL','TCO','TIP','TLD','TLG','TV2','TYA','VCG','VGC','VIP','VJC','VNL','VNS','VOS','VPG','VRC','VSC','VTO','VTP'],
    "Technology": ['CMG','DGW','ELC','FPT','ITD','SGT'],
    "Healthcare": ['DBD','DBT','DCL','DMC','IMP','JVC','TNH','VMD'],
    "Energy": ['GAS','PET','PGC','PLX','PVD']
}

def build_sector_condition(sector: str, conditions: list[str], params: list):
    if sector and sector != "all":
        codes = SECTOR_MAPPING.get(sector)
        if codes:
            placeholders = ",".join(["%s"] * len(codes))
            conditions.append(f"stock_code IN ({placeholders})")
            params.extend(codes)


@new_router.get("/sectors")
def get_sectors(db=Depends(get_db)):
    """Return list of sectors with counts based on current symbols in DB."""
    query = "SELECT DISTINCT stock_code FROM stock_news"
    rows = db.execute(query)
    symbols = {normalize_symbol(getattr(r, 'stock_code', '')) for r in rows}

    sectors: list[dict] = []
    # Count occurrence of mapped codes present in DB
    for sector_name, codes in SECTOR_MAPPING.items():
        count = sum(1 for c in codes if c in symbols)
        if count > 0 or sector_name == 'banking':
            sectors.append({
                "id": sector_name,
                "label": sector_name.replace('_', ' ').title(),
                "count": count
            })

    # Add All item
    sectors.insert(0, {
        "id": "all",
        "label": "All",
        "count": len(symbols)
    })

    return sectors


# @new_router.get("/news_all")
# def read_news_all(db=Depends(get_db)):
#     query = "SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news"
#     rows = db.execute(query)
#     sorted_rows = sorted(rows, key=lambda x: x.date, reverse=True)
#     results = []
#     for row in sorted_rows:
#         results.append({
#             'stock_code': row.stock_code,
#             'article_id': row.article_id,
#             'title': row.title,
#             'date': row.date,
#             'link': row.link,
#             'is_pdf': row.is_pdf,
#             'pdf_link': row.pdf_link,
#             'content': row.content
#         })
#     return results


@new_router.get("/news_new")
def read_news(db=Depends(get_db)):
    now = datetime.now()
    three_days_ago = now - timedelta(days=3)
    query = f"SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news where date >= %s"
    rows = db.execute(query, (three_days_ago,))
    sorted_rows = sorted(rows, key=lambda x: x.date, reverse=True)
    sorted_rows = sorted_rows[:5]
    results = []
    for row in sorted_rows:
        results.append({
            'stock_code': row.stock_code,
            'article_id': row.article_id,
            'title': row.title,
            'date': row.date,
            'link': row.link,
            'is_pdf': row.is_pdf,
            'pdf_link': row.pdf_link,
            'content': row.content
        })
    return results

@new_router.get("/news_by_symbol")
def read_news_by_symbol(symbol: str, db=Depends(get_db)):
    query = "SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news WHERE stock_code = %s"
    rows = db.execute(query, (symbol,))
    results = []
    for row in rows:
        results.append({
            'stock_code': row.stock_code,
            'article_id': row.article_id,
            'title': row.title,
            'date': row.date,
            'link': row.link,
            'is_pdf': row.is_pdf,
            'pdf_link': row.pdf_link,
            'content': row.content
        })
    return results


@new_router.get("/news_time_filtered")
def read_news_time_filtered(
        sector: str = "all",
        time_filter: str = "all",
        search_query: str | None = None,
        from_date: str | None = None,
        to_date: str | None = None,
        db=Depends(get_db)
    ):
    query = "SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news"
    conditions = []
    params: list = []

    # Sector mapping (simple demo mapping)
    if sector != "all":
        build_sector_condition(sector, conditions, params)

    now = datetime.now()
    # Ưu tiên khoảng ngày nếu cung cấp
    if from_date or to_date:
        try:
            if from_date:
                from_dt = datetime.fromisoformat(from_date)
                conditions.append("date >= %s")
                params.append(from_dt)
            if to_date:
                to_dt = datetime.fromisoformat(to_date) + timedelta(days=1)
                conditions.append("date < %s")
                params.append(to_dt)
        except Exception:
            pass
    else:
        if time_filter == "today":
            start_day = datetime(now.year, now.month, now.day, 0, 0, 0)
            end_day = start_day + timedelta(days=1)
            conditions.append("date >= %s AND date < %s")
            params.extend([start_day, end_day])
        elif time_filter == "week":
            start_week = now - timedelta(days=7)
            conditions.append("date >= %s")
            params.append(start_week)
        elif time_filter == "month":
            start_month = datetime(now.year, now.month, 1)
            start_next = datetime(now.year + (1 if now.month == 12 else 0), 1 if now.month == 12 else now.month + 1, 1)
            conditions.append("date >= %s AND date < %s")
            params.extend([start_month, start_next])
        else:
            # Mặc định: không có bộ lọc -> lấy 1 năm gần nhất
            last_year = now - timedelta(days=365)
            conditions.append("date >= %s")
            params.append(last_year)

    if search_query:
        conditions.append("(title LIKE %s OR content LIKE %s)")
        like = f"%{search_query}%"
        params.extend([like, like])

    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ALLOW FILTERING"

    rows = db.execute(query, params)

    def parse_date(date_value):
        if date_value is None:
            return datetime.min
        if isinstance(date_value, datetime):
            return date_value
        try:
            return datetime.strptime(date_value, '%d-%m-%Y %H:%M:%S%z')
        except Exception:
            try:
                return datetime.strptime(date_value, '%d-%m-%Y')
            except Exception:
                return datetime.min

    sorted_rows = sorted(rows, key=lambda x: parse_date(x.date), reverse=True)
    return [
        {
            'stock_code': r.stock_code,
            'article_id': r.article_id,
            'title': r.title,
            'date': r.date,
            'link': r.link,
            'is_pdf': r.is_pdf,
            'pdf_link': r.pdf_link,
            'content': r.content
        } for r in sorted_rows
    ]


# @new_router.get("/news_range_filtered")
# def read_news_range_filtered(
#         sector: str = "all",
#         from_date: str | None = None,
#         to_date: str | None = None,
#         search_query: str | None = None,
#         db=Depends(get_db)
#     ):
#     """Filter by date range [from_date, to_date] and optional sector/search."""
#     query = "SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news"
#     conditions = []
#     params: list = []

#     if sector != "all":
#         sector_mapping = {
#             "banking": ["VCB", "BID", "CTG", "ACB", "TPB", "MBB", "STB", "TCB"],
#             "technology": ["FPT", "CMG", "ELC", "ITD"],
#             "real_estate": ["VHM", "VIC", "VRE", "KDH", "NVL", "DXG", "PDR"],
#             "manufacturing": ["HPG", "HSG", "NKG", "DCM"],
#             "energy": ["GAS", "PLX", "POW", "NT2"],
#         }
#         codes = sector_mapping.get(sector)
#         if codes:
#             placeholders = ",".join(["%s"] * len(codes))
#             conditions.append(f"stock_code IN ({placeholders})")
#             params.extend(codes)

#     if from_date:
#         conditions.append("date >= %s")
#         params.append(from_date)
#     if to_date:
#         conditions.append("date <= %s")
#         params.append(to_date)

#     if search_query:
#         conditions.append("(title LIKE %s OR content LIKE %s)")
#         like = f"%{search_query}%"
#         params.extend([like, like])

#     if conditions:
#         query += " WHERE " + " AND ".join(conditions)
#     query += " ALLOW FILTERING"

#     rows = db.execute(query, params)

#     def parse_date(date_str):
#         if date_str is None:
#             return datetime.min
#         try:
#             return datetime.strptime(date_str, '%d-%m-%Y %H:%M:%S%z')
#         except:
#             try:
#                 return datetime.strptime(date_str, '%d-%m-%Y')
#             except:
#                 return datetime.min

#     sorted_rows = sorted(rows, key=lambda x: parse_date(x.date), reverse=True)
#     return [
#         {
#             'stock_code': r.stock_code,
#             'article_id': r.article_id,
#             'title': r.title,
#             'date': r.date,
#             'link': r.link,
#             'is_pdf': r.is_pdf,
#             'pdf_link': r.pdf_link,
#             'content': r.content
#         } for r in sorted_rows
#     ]


# @new_router.get("/news_filtered")
# def read_news_filtered(
#         sector: str = "all",
#         time_filter: str = "all", 
#         from_date: str = None,
#         to_date: str = None,
#         search_query: str = None,
#         db=Depends(get_db)
#     ):
#     # Base query
#     query = "SELECT stock_code, article_id, title, date, link, is_pdf, pdf_link, content FROM stock_news"
#     conditions = []
#     params = []
    
#     # Sector filter (if not "all")
#     if sector != "all":
#         # Map sector to stock codes or add sector field to database
#         # For now, we'll filter by common sectors
#         sector_mapping = {
#             "banking": ["VCB", "BID", "CTG", "ACB", "TPB"],
#             "technology": ["FPT", "CMG", "ELC", "ITD"],
#             "real_estate": ["VHM", "VIC", "VRE", "KDH"],
#             "manufacturing": ["HPG", "HSG", "NKG", "DCM"],
#             "energy": ["GAS", "PLX", "POW", "NT2"]
#         }
        
#         if sector in sector_mapping:
#             stock_codes = sector_mapping[sector]
#             placeholders = ",".join(["%s"] * len(stock_codes))
#             conditions.append(f"stock_code IN ({placeholders})")
#             params.extend(stock_codes)
    
#     # Time filter
#     now = datetime.now()
#     if time_filter == "today":
#         today = now.strftime("%d-%m-%Y")
#         conditions.append("date LIKE %s")
#         params.append(f"%{today}%")
#     elif time_filter == "week":
#         # Get last 7 days
#         week_ago = now.replace(day=now.day-7)
#         conditions.append("date >= %s")
#         params.append(week_ago.strftime("%d-%m-%Y"))
#     elif time_filter == "month":
#         month_year = now.strftime("%m-%Y")
#         conditions.append("date LIKE %s")
#         params.append(f"%{month_year}%")
    
#     # Date range filter
#     if from_date:
#         conditions.append("date >= %s")
#         params.append(from_date)
#     if to_date:
#         conditions.append("date <= %s")
#         params.append(to_date)
    
#     # Search query filter
#     if search_query:
#         conditions.append("(title LIKE %s OR content LIKE %s)")
#         search_param = f"%{search_query}%"
#         params.extend([search_param, search_param])
    
#     # Build final query
#     if conditions:
#         query += " WHERE " + " AND ".join(conditions)
    
#     query += " ALLOW FILTERING"
#     print(query)
#     print(params)
    
#     rows = db.execute(query, params)
    
#     def parse_date(date_str):
#         if date_str is None:
#             return datetime.min
#         try:
#             return datetime.strptime(date_str, '%d-%m-%Y %H:%M:%S%z')
#         except:
#             try:
#                 return datetime.strptime(date_str, '%d-%m-%Y')
#             except:
#                 return datetime.min
    
#     # Sort by date descending
#     sorted_rows = sorted(rows, key=lambda x: parse_date(x.date), reverse=True)
    
#     results = []
#     for row in sorted_rows:
#         results.append({
#             'stock_code': row.stock_code,
#             'article_id': row.article_id,
#             'title': row.title,
#             'date': row.date,
#             'link': row.link,
#             'is_pdf': row.is_pdf,
#             'pdf_link': row.pdf_link,
#             'content': row.content
#         })
    
#     return results


# @new_router.get("/sectors")
# def get_sectors(db=Depends(get_db)):
#     """Get available sectors with counts"""
#     query = "SELECT DISTINCT stock_code FROM stock_news"
#     rows = db.execute(query)
    
#     # Map stock codes to sectors
#     sector_mapping = {
#         "banking": ["VCB", "BID", "CTG", "ACB", "TPB", "MBB", "STB", "TCB"],
#         "technology": ["FPT", "CMG", "ELC", "ITD", "SAM", "VGI"],
#         "real_estate": ["VHM", "VIC", "VRE", "KDH", "NVL", "DXG", "PDR"],
#         "manufacturing": ["HPG", "HSG", "NKG", "DCM", "VGC", "GEX"],
#         "energy": ["GAS", "PLX", "POW", "NT2", "PC1", "GEG"],
#         "retail": ["MWG", "FRT", "PNJ", "DGW", "VNM"],
#         "healthcare": ["DHG", "IMP", "PME", "DP3", "TNH"]
#     }
    
#     sectors = []
#     stock_codes = [row.stock_code for row in rows]
    
#     # Count stocks in each sector
#     for sector_name, codes in sector_mapping.items():
#         count = len([code for code in codes if code in stock_codes])
#         if count > 0:
#             sectors.append({
#                 "id": sector_name,
#                 "label": sector_name.title(),
#                 "count": count
#             })
    
#     # Add "All" option
#     total_count = len(stock_codes)
#     sectors.insert(0, {
#         "id": "all",
#         "label": "All",
#         "count": total_count
#     })
    
#     return sectors