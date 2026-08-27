import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple, Dict, Any
from cassandra.cluster import Cluster
from cassandra.policies import DCAwareRoundRobinPolicy
from news_stock import config

logger = logging.getLogger(__name__)


class NewsRepository:
    def __init__(self, hosts: Optional[List[str]] = None, port: Optional[int] = None, keyspace: Optional[str] = None, datacenter: Optional[str] = None):
        self.hosts = hosts or config.SCYLLA_HOSTS
        self.port = port or config.SCYLLA_PORT
        self.keyspace = keyspace or config.SCYLLA_KEYSPACE
        self.datacenter = datacenter or config.SCYLLA_DC
        self.cluster: Optional[Cluster] = None
        self.db = None

    def connect(self):
        if self.db is None:
            self.cluster = Cluster(self.hosts, port=self.port, load_balancing_policy=DCAwareRoundRobinPolicy(local_dc=self.datacenter), protocol_version=4)
            self.db = self.cluster.connect(self.keyspace)
            logger.info("Connected to ScyllaDB at %s:%s (%s)", self.hosts, self.port, self.keyspace)
        return self

    def close(self):
        if self.db:
            try: self.db.shutdown()
            except Exception as e: logger.warning("DB session shutdown error: %s", e)
            self.db = None
        if self.cluster:
            try: self.cluster.shutdown()
            except Exception as e: logger.warning("Cluster shutdown error: %s", e)
            self.cluster = None

    def __enter__(self): return self.connect()
    def __exit__(self, exc_type, exc_val, exc_tb): self.close()

    def get_latest_news_date(self, stock_codes: Optional[List[str]] = None) -> Tuple[datetime, datetime]:
        today = datetime.now()
        latest = None
        for code in (stock_codes or config.DEFAULT_STOCK_CODES):
            try:
                rows = self.db.execute("SELECT date FROM stock_news WHERE stock_code = %s AND date <= %s LIMIT 1", [code, today + timedelta(days=1)], timeout=60)
                if rows and (latest is None or (rows[0].date and latest < rows[0].date)): latest = rows[0].date
            except Exception as e: logger.debug("Date query error for %s: %s", code, e)
        return latest or today, today

    def check_articles_exist(self, article_ids: List[str]) -> List[str]:
        if not article_ids: return []
        try:
            placeholders = ",".join(["%s"] * len(article_ids))
            return [r.article_id for r in self.db.execute(f"SELECT article_id FROM stock_news WHERE article_id IN ({placeholders}) ALLOW FILTERING", article_ids, timeout=60)]
        except Exception as e:
            logger.error("Error checking existing articles: %s", e)
            return []

    def save_articles_batch(self, articles: List[Dict[str, Any]]) -> Tuple[int, int]:
        if not articles: return 0, 0
        query = self.db.prepare("INSERT INTO stock_news (article_id, stock_code, title, link, date, is_pdf, content, sentiment_score, pdf_link, crawled_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, toTimestamp(now()))")
        futures = []
        for a in articles:
            try:
                futures.append(self.db.execute_async(query, (a["article_id"], a["stock_code"], a["title"], a["link"], a["date"], a["is_pdf"], a["content"], a["sentiment_score"], a["pdf_link"]), timeout=60))
            except Exception as e: logger.error("[SAVE PREPARE ERROR] %s: %s", a.get("article_id", "UNKNOWN"), e)

        saved = failed = 0
        for f in futures:
            try:
                f.result()
                saved += 1
            except Exception as e:
                logger.error("[SAVE EXECUTE ERROR] %s", e)
                failed += 1
        logger.info("[SAVE STATUS] Saved %d/%d (Failed: %d)", saved, len(articles), failed)
        if failed > 0: raise RuntimeError(f"Database save failed for {failed}/{len(articles)} records")
        return saved, failed
