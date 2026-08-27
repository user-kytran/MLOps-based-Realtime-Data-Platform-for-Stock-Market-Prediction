import logging, time, requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from news_stock import config

logger = logging.getLogger(__name__)


class VietstockCrawler:
    BASE_PAGING_URL = "https://finance.vietstock.vn/View/PagingNewsContent"

    def __init__(self, stock_codes: Optional[List[str]] = None, max_workers: int = config.CRAWLER_MAX_WORKERS):
        self.codes = stock_codes or config.DEFAULT_STOCK_CODES
        self.max_workers = max_workers

    def _create_session(self) -> requests.Session:
        s = requests.Session()
        s.headers.update({"Accept": "text/html, */*;q=0.01", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"})
        return s

    def _extract_article_details(self, session: requests.Session, link: str) -> Dict[str, Any]:
        date = content = pdf_link = None
        is_pdf = False
        try:
            soup = BeautifulSoup(session.get(link, timeout=30).text, "html.parser")
            d_span = soup.select_one("span.datenew, span.date.hidden-xs, span.date")
            date = d_span.get_text(strip=True) if d_span else (soup.find("meta", {"itemprop": "datePublished"}) or soup.find("meta", {"property": "article:published_time"}) or {}).get("content")
            
            c_div = soup.find("div", id="vst_detail") or soup.find("div", class_="longform-content") or soup.find("div", id=lambda x: x and str(x).startswith("article-"))
            if c_div:
                table = c_div.find("table")
                if table and "Tài liệu đính kèm:" in table.get_text(strip=True):
                    a_tag = table.find("a")
                    if a_tag and a_tag.has_attr("href"):
                        pdf_link, is_pdf = a_tag["href"], True
                if not is_pdf:
                    p_list = c_div.find_all("p", class_=["pHead", "pBody"]) or c_div.find_all("p")
                    content = " ".join(p.get_text(" ", strip=True) for p in p_list if p.get_text(strip=True))
        except Exception as e:
            logger.warning("[CONTENT ERROR] %s: %s", link, e)
        return {"date": date, "content": content, "pdf_link": pdf_link, "is_pdf": is_pdf}

    def crawl_stock(self, stock_code: str, from_date: datetime, to_date: datetime, max_pages: int = 20) -> List[Dict[str, Any]]:
        session = self._create_session()
        params = {"view": "1", "type": "1", "fromDate": from_date.strftime("%m/%d/%Y"), "toDate": to_date.strftime("%m/%d/%Y"), "channelID": "-1", "page": "1", "pageSize": "20", "code": stock_code}
        results = []
        for page in range(1, max_pages + 1):
            params["page"] = str(page)
            try:
                soup = BeautifulSoup(session.get(self.BASE_PAGING_URL, params=params, timeout=30).text, "html.parser")
                rows = soup.select("table.table-striped tr")
                if not rows: break
                for r in rows:
                    a = r.find("a")
                    if a and a.has_attr("articleid"):
                        aid, link, title = a["articleid"], urljoin("https:", a["href"]), a.get_text(strip=True)
                        results.append({"code": stock_code, "id": aid, "title": title, "link": link, **self._extract_article_details(session, link)})
                time.sleep(0.2)
            except Exception as e:
                logger.warning("[PAGE ERROR] %s page %d: %s", stock_code, page, e)
                break
        logger.info("[DONE] %s: %d articles", stock_code, len(results))
        return results

    def crawl_all(self, from_date: datetime, to_date: datetime, stock_codes: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        codes = stock_codes or self.codes
        all_results = []
        logger.info("[INFO] Crawling %d stock codes from %s to %s", len(codes), from_date, to_date)
        with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
            futures = [ex.submit(self.crawl_stock, c, from_date, to_date) for c in codes]
            for f in as_completed(futures):
                try: all_results.extend(f.result())
                except Exception as e: logger.error("Crawl error: %s", e)
        logger.info("[INFO] Total articles crawled: %d", len(all_results))
        return all_results
