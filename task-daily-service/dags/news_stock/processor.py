import logging, os, requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
from urllib.parse import urlparse
from news_stock import config
from news_stock.datalab import DataLabConverter
from news_stock.analyzer import SentimentAnalyzer

logger = logging.getLogger(__name__)


class NewsArticleProcessor:
    def __init__(self, datalab_converter: Optional[DataLabConverter] = None, sentiment_analyzer: Optional[SentimentAnalyzer] = None, max_workers: int = config.MAX_WORKERS):
        self.converter = datalab_converter or DataLabConverter()
        self.analyzer = sentiment_analyzer or SentimentAnalyzer()
        self.max_workers = max_workers

    @property
    def pdf_max_workers(self) -> int:
        pool_size = self.converter.key_pool.size if self.converter and self.converter.key_pool else 0
        return min(self.max_workers, pool_size * config.DATALAB_MAX_CONCURRENT_PER_KEY) if pool_size > 0 else self.max_workers

    @staticmethod
    def fetch_pdf(pdf_link: str) -> Optional[bytes]:
        if not pdf_link: return None
        try:
            resp = requests.get(pdf_link, timeout=15)
            resp.raise_for_status()
            return resp.content
        except Exception as e:
            logger.error("Error fetching PDF from %s: %s", pdf_link, e)
            return None

    def process_pdf_article(self, article: Dict[str, Any], fetch_fn: Optional[Callable] = None, convert_fn: Optional[Callable] = None, analyze_text_fn: Optional[Callable] = None, normalize_fn: Optional[Callable] = None) -> Optional[Dict[str, Any]]:
        fetch, convert = fetch_fn or self.fetch_pdf, convert_fn or self.converter.convert
        analyze_text, normalize = analyze_text_fn or self.analyzer.analyze_text, normalize_fn or self.analyzer.normalize_score
        try:
            pdf_link = article.get("pdf_link") or article.get("link")
            title = article.get("title", "")
            md = None
            
            pdf_data = fetch(pdf_link)
            if pdf_data:
                fn = os.path.basename(urlparse(pdf_link).path) or f"{article.get('code')}-{article.get('id')}.pdf"
                if not fn.lower().endswith(".pdf"): fn = f"{fn}.pdf"
                md = convert(pdf_data, filename=fn)
            
            if not md:
                logger.info("Using title + link fallback for PDF %s", article.get("id"))
                md = f"### {title}\n\n[Tài liệu đính kèm PDF]({pdf_link})"

            score = normalize(analyze_text(md, article.get("code", "")))
            return {
                "article_id": article["id"],
                "stock_code": article["code"],
                "title": title,
                "link": article.get("link", ""),
                "date": datetime.now(),
                "is_pdf": True,
                "content": md,
                "pdf_link": pdf_link,
                "sentiment_score": score,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        except Exception as e:
            logger.error("Error processing PDF article %s: %s", article.get("id"), e)
            title = article.get("title", "")
            return {
                "article_id": article["id"],
                "stock_code": article["code"],
                "title": title,
                "link": article.get("link", ""),
                "date": datetime.now(),
                "is_pdf": True,
                "content": f"### {title}\n\n[Tài liệu đính kèm PDF]({article.get('pdf_link', '')})",
                "pdf_link": article.get("pdf_link"),
                "sentiment_score": 0.0,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }

    def process_text_article(self, article: Dict[str, Any], analyze_text_fn: Optional[Callable] = None, normalize_fn: Optional[Callable] = None) -> Optional[Dict[str, Any]]:
        analyze_text, normalize = analyze_text_fn or self.analyzer.analyze_text, normalize_fn or self.analyzer.normalize_score
        try:
            content = article.get("content") or article.get("title", "")
            score = normalize(analyze_text(content, article.get("code", "")))
            return {
                "article_id": article["id"],
                "stock_code": article["code"],
                "title": article.get("title", ""),
                "link": article.get("link", ""),
                "date": datetime.now(),
                "is_pdf": False,
                "content": content,
                "pdf_link": None,
                "sentiment_score": score,
                "crawled_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        except Exception as e:
            logger.error("Error processing text article %s: %s", article.get("id"), e)
            return None

    def process_batch(self, articles: List[Dict[str, Any]], process_pdf_fn: Optional[Callable] = None, process_text_fn: Optional[Callable] = None) -> List[Dict[str, Any]]:
        if not articles: return []
        
        # 1. Share content across duplicates with same article id
        content_pool = {}
        for a in articles:
            cnt = a.get("content")
            if cnt and len(str(cnt).strip()) > 0:
                content_pool[a.get("id")] = cnt

        for a in articles:
            if a.get("id") in content_pool and (not a.get("content") or len(str(a.get("content")).strip()) == 0):
                a["content"] = content_pool[a.get("id")]

        pdf_proc, text_proc = process_pdf_fn or self.process_pdf_article, process_text_fn or self.process_text_article
        pdf_articles = [a for a in articles if a.get("is_pdf")]
        text_articles = [a for a in articles if not a.get("is_pdf")]
        processed = []

        if pdf_articles:
            with ThreadPoolExecutor(max_workers=self.pdf_max_workers) as ex:
                futures = {ex.submit(pdf_proc, a): a for a in pdf_articles}
                for f in as_completed(futures):
                    try:
                        res = f.result()
                        if res: processed.append(res)
                    except Exception as e: logger.error("PDF batch error %s: %s", futures[f].get("id"), e)

        if text_articles:
            with ThreadPoolExecutor(max_workers=self.max_workers) as ex:
                futures = {ex.submit(text_proc, a): a for a in text_articles}
                for f in as_completed(futures):
                    try:
                        res = f.result()
                        if res: processed.append(res)
                    except Exception as e: logger.error("Text batch error %s: %s", futures[f].get("id"), e)

        logger.info("Completed processing %d articles", len(processed))
        return processed
