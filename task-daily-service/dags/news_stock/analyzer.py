import logging, os, requests
from typing import Optional, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import JsonOutputParser
from news_stock import config

logger = logging.getLogger(__name__)
DEFAULT_MODEL = "qwen3.7-plus"
DEFAULT_TEMPERATURE = 0.3


class SentimentAnalyzer:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None, model_name: Optional[str] = None, temperature: Optional[float] = None):
        self.base_url = base_url or getattr(config, "GEMINI_BASE_URL", "http://localhost:1337/v1")
        self.api_key = api_key or getattr(config, "GOOGLE_API_KEY", None)
        self.model_name = model_name or getattr(config, "GEMINI_MODEL", DEFAULT_MODEL)
        self.temperature = temperature if temperature is not None else getattr(config, "GEMINI_TEMPERATURE", DEFAULT_TEMPERATURE)
        self.model = None
        self.parser = JsonOutputParser()
        self._init_model()

    def _init_model(self):
        if self.api_key:
            try:
                self.model = ChatGoogleGenerativeAI(model=self.model_name, api_key=self.api_key, temperature=self.temperature)
                logger.info("AI model initialized successfully")
            except Exception as e:
                logger.warning("Failed to initialize Google AI model: %s", e)
        elif self.base_url:
            logger.info("SentimentAnalyzer configured with local LLM endpoint")

    @property
    def is_available(self) -> bool:
        return self.model is not None or bool(self.base_url)

    @staticmethod
    def normalize_score(result: Optional[Dict[str, Any]]) -> float:
        try:
            return max(-1.0, min(1.0, float((result or {}).get("sentiment_score", 0))))
        except (TypeError, ValueError):
            return 0.0

    def analyze_text(self, content: str, stock_code: str, max_chars: int = 1000) -> Optional[Dict[str, Any]]:
        if not self.is_available:
            logger.warning("No AI model configured, skipping text analysis")
            return {"sentiment_score": 0}

        content_for_llm = (content or "")[:max(1, max_chars)]
        prompt = f'Phân tích sentiment nội dung sau và trả JSON {{"sentiment_score": số từ -1 đến 1}}.\nNội dung: {content_for_llm}\nCổ phiếu: {stock_code}\nChỉ trả về JSON có sentiment_score.'

        try:
            if self.model is not None:
                return self.parser.parse(self.model.invoke([HumanMessage(content=prompt)]).content)
            elif self.base_url:
                ep = self.base_url.rstrip("/")
                if not ep.endswith("/chat/completions"): ep = f"{ep}/chat/completions"
                resp = requests.post(ep, json={"model": self.model_name, "messages": [{"role": "user", "content": prompt}]}, timeout=30)
                if resp.ok:
                    return self.parser.parse(resp.json()["choices"][0]["message"]["content"])
                logger.warning("LLM API call returned HTTP %d", resp.status_code)
                return {"sentiment_score": 0}
        except Exception as e:
            logger.error("Error analyzing text sentiment for %s: %s", stock_code, e)
            return None
