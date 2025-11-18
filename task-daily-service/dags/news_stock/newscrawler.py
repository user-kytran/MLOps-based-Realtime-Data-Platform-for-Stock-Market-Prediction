import os, time, requests, threading
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from datetime import datetime, timedelta
from cassandra.cluster import Cluster
from cassandra.policies import DCAwareRoundRobinPolicy
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
import os

load_dotenv()

class NewsCrawler:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'Accept': 'text/html, */*;q=0.01',
            'User-Agent': 'Mozilla/5.0'
        })
        self.codes = ["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]
        self.max_workers = 10  

        if os.getenv('AIRFLOW_HOME'):  
            self.hosts = [os.getenv('SCYLLA_NODE1'), os.getenv('SCYLLA_NODE2'), os.getenv('SCYLLA_NODE3')]
        else:  
            self.hosts = ['localhost']


    def connect_to_db(self):
        self.cluster = Cluster(
            self.hosts,
            port=int(os.getenv('SCYLLA_PORT')),
            load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=os.getenv('SCYLLA_DC')),protocol_version=4
        )
        self.db = self.cluster.connect(os.getenv('SCYLLA_KEYSPACE'))
        print(f"[INFO] Connected to DB")

    def close_db(self):
        if self.db:
            self.db.shutdown()
        if self.cluster:
            self.cluster.shutdown()
        self.db = None
        self.cluster = None
        print("Đã đóng kết nối ScyllaDB.")

    # ---- TASK 1: Xác định khoảng ngày crawl ----
    def get_date_range(self):
        try:
            today = datetime.now()
            latest_date = None
            codes = ["AAA","AAM","ABS","ABT","ACB","ACC","ACL","ADG","ADP","ADS","AGG","AGR","ANV","APG","APH","ASM","ASP","AST","BAF","BCE","BCM","BFC","BIC","BID","BKG","BMC","BMI","BMP","BRC","BSI","BTP","BVH","BWE","C32","CCL","CDC","CII","CLC","CLL","CMG","CMX","CNG","CRC","CRE","CSM","CSV","CTD","CTF","CTG","CTI","CTR","CTS","D2D","DAH","DBC","DBD","DBT","DC4","DCL","DCM","DGC","DGW","DHA","DHC","DHM","DIG","DMC","DPG","DPM","DPR","DRC","DRL","DSC","DSE","DSN","DTA","DVP","DXG","DXS","EIB","ELC","EVE","EVF","FCM","FCN","FIR","FIT","FMC","FPT","FRT","FTS","GAS","GDT","GEE","GEX","GIL","GMD","GSP","GVR","HAG","HAH","HAP","HAR","HAX","HCD","HCM","HDB","HDC","HDG","HHP","HHS","HHV","HID","HII","HMC","HPG","HPX","HQC","HSG","HSL","HT1","HTG","HTI","HTN","HUB","HVH","ICT","IDI","IJC","ILB","IMP","ITC","ITD","JVC","KBC","KDC","KDH","KHG","KHP","KMR","KOS","KSB","LAF","LBM","LCG","LHG","LIX","LPB","LSS","MBB","MCM","MCP","MHC","MIG","MSB","MSH","MSN","MWG","NAB","NAF","NBB","NCT","NHA","NHH","NKG","NLG","NNC","NO1","NSC","NT2","NTL","OCB","OGC","ORS","PAC","PAN","PC1","PDR","PET","PGC","PHC","PHR","PIT","PLP","PLX","PNJ","POW","PPC","PTB","PTC","PTL","PVD","PVP","PVT","QCG","RAL","REE","RYG","SAB","SAM","SAV","SBG","SBT","SCR","SCS","SFC","SFG","SGN","SGR","SGT","SHB","SHI","SIP","SJD","SJS","SKG","SMB","SSB","SSI","ST8","STB","STK","SVT","SZC","SZL","TCB","TCH","TCI","TCL","TCM","TCO","TCT","TDC","TDG","TDP","TEG","THG","TIP","TLD","TLG","TLH","TMT","TNH","TNI","TNT","TPB","TRC","TSC","TTA","TTF","TV2","TVS","TYA","UIC","VCA","VCB","VCG","VCI","VDS","VFG","VGC","VHC","VHM","VIB","VIC","VIP","VIX","VJC","VMD","VND","VNL","VNM","VNS","VOS","VPB","VPG","VPH","VPI","VRC","VRE","VSC","VTO","VTP","YBM","YEG"]
            query = "SELECT date FROM stock_news WHERE stock_code = %s AND date <= %s LIMIT 1"
            for code in codes:
                rows = self.db.execute(query, [code, today + timedelta(days=1)], timeout=60)
                if latest_date is None:
                    latest_date = rows[0].date
                else:
                    if latest_date < rows[0].date:
                        latest_date = rows[0].date
            print(f"[DATE RANGE] {latest_date} to {today}")
            return latest_date, today if latest_date else today
        except Exception as e:
            print(f"[DATE RANGE ERROR] {e}")
            return datetime.now() + timedelta(days=1), datetime.now() + timedelta(days=1)

    # ---- TASK 2: Crawl dữ liệu ----
    def crawl_articles(self, from_date, to_date):
        all_results = []
        params = {
            'view': '1',
            'type': '1',
            'fromDate': from_date.strftime('%m/%d/%Y'),
            'toDate': to_date.strftime('%m/%d/%Y'),
            'channelID': '-1',
            'page': '1',
            'pageSize': '20'
        }
        print(f"[INFO] Crawling from {from_date} to {to_date}")

        def crawl_stock(code):
            print(f"[START] {code}")
            p = {**params, 'code': code}
            results = []
            page = 1
            while True:
                try:
                    s = BeautifulSoup(self.session.get(
                        'https://finance.vietstock.vn/View/PagingNewsContent',
                        params=p, timeout=60
                    ).text, 'html.parser')

                    rows = s.select('table.table-striped tr')
                    if not rows:
                        break
                    for r in rows:
                        a = r.find('a')
                        if not a or not a.has_attr('articleid'):
                            continue
                        aid = a['articleid']
                        link = urljoin('https:', a['href'])
                        title = a.get_text(strip=True)
                        date = None
                        content = None
                        pdf_link = None
                        is_pdf = False
                        try:
                            soup = BeautifulSoup(self.session.get(link, timeout=60).text, 'html.parser')
                            date, content_div = soup.find('span', class_=['datenew','date hidden-xs']).get_text(strip=True), soup.find('div', id='vst_detail')
                            if content_div:
                                table = content_div.find('table')
                                if table and 'Tài liệu đính kèm:' in table.get_text(strip=True):
                                    pdf_link = table.find('a')['href']
                                    is_pdf = True
                                else:
                                    content = ' '.join(p.get_text(" ", strip=True) for p in content_div.find_all('p', class_='pBody'))
                        except Exception as e:
                            print(f"[CONTENT ERROR] {e}")
                        results.append({'code': code, 'id': aid, 'title': title, 'link': link, 'date': date, 'is_pdf': is_pdf, 'content': content, 'pdf_link': pdf_link})
                    page += 1
                    p['page'] = str(page)
                    time.sleep(0.2)
                    if page > 20: break
                except Exception as e:
                    print(f"[PAGE ERROR] {code} | {e}")
                    break
            print(f"[DONE] {code}: {len(results)} articles")
            return results

        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = [ex.submit(crawl_stock, code) for code in self.codes]
            for f in as_completed(futures):
                all_results.extend(f.result())

        print(f"[INFO] Tổng số bài crawl được: {len(all_results)}")
        return all_results

    # ---- TASK 3: Lưu vào DB ----
    def save_to_db(self, articles):
        for d in articles:
            try:
                with self.db_lock:
                    self.db.execute("""
                        INSERT INTO stock_news (article_id,stock_code,title,link,date,is_pdf,content,pdf_link,crawled_at)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,toTimestamp(now()))
                    """, (
                        d.get('id'), d.get('code'), d.get('title'), d.get('link'),
                        datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                        False, None, None
                    ))
            except Exception as e:
                print(f"[SAVE ERROR] {e}")
        print(f"[INFO] Lưu xong {len(articles)} bản ghi vào DB")


if __name__ == "__main__":
    crawler = NewsCrawler()
    from_date = datetime.now() - timedelta(days=1)
    to_date = datetime.now()
    articles = crawler.crawl_articles(from_date, to_date)
    print(f"[INFO] Tổng số bài crawl được: {len(articles)}")
