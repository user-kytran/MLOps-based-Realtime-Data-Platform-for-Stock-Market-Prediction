from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from news_stock import config
from news_stock.crawler import VietstockCrawler
from news_stock.db import NewsRepository


class NewsCrawler:
    def __init__(self, stock_codes: Optional[List[str]] = None, max_workers: int = config.CRAWLER_MAX_WORKERS):
        self.crawler = VietstockCrawler(stock_codes=stock_codes, max_workers=max_workers)
        self.repo = NewsRepository()

    @property
    def codes(self) -> List[str]: return self.crawler.codes
    @property
    def db(self): return self.repo.db
    @property
    def cluster(self): return self.repo.cluster

    def connect_to_db(self): return self.repo.connect()
    def close_db(self): return self.repo.close()
    def get_date_range(self): return self.repo.get_latest_news_date(self.codes)
    def crawl_articles(self, from_date: datetime, to_date: datetime) -> List[Dict[str, Any]]: return self.crawler.crawl_all(from_date, to_date)
    def save_to_db(self, articles: List[Dict[str, Any]]): return self.repo.save_articles_batch(articles)


if __name__ == "__main__":
    crawler = NewsCrawler()
    print(f"[INFO] Tổng số bài crawl được: {len(crawler.crawl_articles(datetime.now() - timedelta(days=1), datetime.now()))}")
