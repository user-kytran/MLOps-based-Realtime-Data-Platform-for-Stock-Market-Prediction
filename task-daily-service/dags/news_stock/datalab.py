import logging, threading, time, requests
from contextlib import contextmanager
from typing import Optional, Set, Tuple
from urllib.parse import urlparse
from news_stock import config

logger = logging.getLogger(__name__)


class DataLabConversionError(RuntimeError): pass
class DataLabTryNextKey(RuntimeError): pass


class DataLabKeyPool:
    def __init__(self, keys: list[str], max_concurrent_per_key: int = config.DATALAB_MAX_CONCURRENT_PER_KEY, wait_timeout: float = config.DATALAB_KEY_WAIT_TIMEOUT_SECONDS):
        self._keys = list(keys)
        self._max_concurrent = max(1, max_concurrent_per_key)
        self._wait_timeout = wait_timeout
        self._states = [{"disabled": False, "cooldown": 0.0, "inflight": 0} for _ in keys]
        self._cursor = 0
        self._lock = threading.Lock()

    @property
    def size(self) -> int: return len(self._keys)

    @contextmanager
    def acquire(self, excluded: Optional[Set[int]] = None):
        excluded, deadline, selected = excluded or set(), time.monotonic() + self._wait_timeout, None
        while selected is None:
            with self._lock:
                now = time.monotonic()
                for offset in range(len(self._keys)):
                    idx = (self._cursor + offset) % len(self._keys)
                    st = self._states[idx]
                    if idx not in excluded and not st["disabled"] and st["cooldown"] <= now and st["inflight"] < self._max_concurrent:
                        selected = idx
                        st["inflight"] += 1
                        self._cursor = (idx + 1) % len(self._keys)
                        break
                if selected is None and not any(i not in excluded and not s["disabled"] for i, s in enumerate(self._states)):
                    raise DataLabConversionError("No DataLab API key is available")
            if selected is None:
                if time.monotonic() >= deadline: raise DataLabConversionError("Timed out waiting for DataLab key")
                time.sleep(0.25)
        try:
            yield selected, self._keys[selected]
        finally:
            with self._lock: self._states[selected]["inflight"] -= 1

    def mark(self, index: int, *, disabled: bool = False, cooldown: float = 0):
        with self._lock:
            self._states[index]["disabled"] |= disabled
            self._states[index]["cooldown"] = max(self._states[index]["cooldown"], time.monotonic() + cooldown)


class DataLabConverter:
    def __init__(self, key_pool: Optional[DataLabKeyPool] = None, convert_url: str = config.DATALAB_CONVERT_URL, mode: str = config.DATALAB_MODE, poll_interval: float = config.DATALAB_POLL_INTERVAL_SECONDS, poll_timeout: float = config.DATALAB_POLL_TIMEOUT_SECONDS):
        self.key_pool = key_pool or DataLabKeyPool(config.load_datalab_api_keys())
        self.convert_url, self.mode, self.poll_interval, self.poll_timeout = convert_url, mode, poll_interval, poll_timeout

    @staticmethod
    def _detail(resp: requests.Response) -> str:
        try: return str(resp.json().get("detail") or resp.json().get("error") or resp.json())[:300]
        except Exception: return resp.text[:300]

    @staticmethod
    def _key_action(resp: requests.Response, delay: float = 10.0) -> Optional[Tuple[str, float]]:
        if resp.status_code in (401, 402, 403): return "disable", 0.0
        if resp.status_code == 429:
            try: return "cooldown", max(1.0, float(resp.headers.get("Retry-After", 60.0)))
            except (TypeError, ValueError): return "cooldown", 60.0
        if resp.status_code in (500, 529): return "cooldown", delay
        return None

    def _submit_pdf(self, pdf_data: bytes, filename: str, key_idx: int, api_key: str) -> str:
        try:
            resp = requests.post(self.convert_url, headers={"X-API-Key": api_key}, files={"file": (filename, pdf_data, "application/pdf")}, data={"output_format": "markdown", "mode": self.mode, "disable_image_extraction": "true", "disable_image_captions": "true", "token_efficient_markdown": "true"}, timeout=(15, 90))
        except requests.RequestException as exc:
            self.key_pool.mark(key_idx, cooldown=10)
            logger.warning("DataLab submit error slot %d: %s", key_idx, exc)
            raise DataLabTryNextKey from exc

        action = self._key_action(resp)
        if action:
            kind, delay = action
            self.key_pool.mark(key_idx, disabled=(kind == "disable"), cooldown=delay)
            logger.warning("DataLab submit HTTP %d on slot %d; switching key", resp.status_code, key_idx)
            raise DataLabTryNextKey
        if not resp.ok: raise DataLabConversionError(f"DataLab rejected {filename} (HTTP {resp.status_code}): {self._detail(resp)}")

        try: sub = resp.json()
        except ValueError as exc: raise DataLabConversionError("DataLab submission returned invalid JSON") from exc

        if not sub.get("success", False):
            err = str(sub.get("error", "unknown error"))
            if any(w in err.lower() for w in ("spend", "credit", "cap", "rate limit")):
                exhausted = any(w in err.lower() for w in ("spend", "credit", "cap"))
                self.key_pool.mark(key_idx, disabled=exhausted, cooldown=0 if exhausted else 60)
                raise DataLabTryNextKey
            raise DataLabConversionError(f"DataLab submission failed: {err[:300]}")
        check_url = sub.get("request_check_url")
        if not check_url: raise DataLabConversionError("DataLab submission returned no request_check_url")
        return check_url

    def _poll_markdown(self, check_url: str, key_idx: int, api_key: str) -> str:
        host = urlparse(check_url).hostname or ""
        if not (check_url.startswith("https://") and (host == "datalab.to" or host.endswith(".datalab.to"))):
            raise DataLabConversionError("DataLab returned an invalid request_check_url")

        deadline, attempt = time.monotonic() + self.poll_timeout, 0
        while time.monotonic() < deadline:
            try: resp = requests.get(check_url, headers={"X-API-Key": api_key}, timeout=(10, 30))
            except requests.RequestException as exc:
                attempt += 1
                delay = min(30.0, 2 ** min(attempt, 5))
                logger.warning("DataLab poll error slot %d: %s; retrying in %.0fs", key_idx, exc, delay)
                time.sleep(delay)
                continue

            attempt += resp.status_code in (500, 529)
            action = self._key_action(resp, delay=min(30.0, 2 ** min(attempt, 5)))
            if action:
                kind, delay = action
                self.key_pool.mark(key_idx, disabled=(kind == "disable"), cooldown=delay)
                if kind == "disable": raise DataLabConversionError(f"DataLab key slot {key_idx} disabled: HTTP {resp.status_code}")
                time.sleep(delay)
                continue

            if not resp.ok: raise DataLabConversionError(f"DataLab poll failed (HTTP {resp.status_code}): {self._detail(resp)}")
            try: res = resp.json()
            except ValueError as exc: raise DataLabConversionError("DataLab poll returned invalid JSON") from exc

            status = str(res.get("status", "")).lower()
            if status == "complete":
                if not res.get("success", False) or not (res.get("markdown") or "").strip():
                    raise DataLabConversionError(f"DataLab failed: {str(res.get('error', 'empty markdown'))[:300]}")
                return res["markdown"].strip()
            if status == "failed": raise DataLabConversionError(f"DataLab conversion failed: {str(res.get('error', 'failed'))[:300]}")
            time.sleep(self.poll_interval)
        raise DataLabConversionError("Timed out waiting for DataLab PDF conversion")

    def convert(self, pdf_data: bytes, filename: str = "document.pdf") -> Optional[str]:
        if not pdf_data or self.key_pool.size == 0 or len(pdf_data) > config.DATALAB_MAX_FILE_BYTES: return None
        attempted: Set[int] = set()
        while len(attempted) < self.key_pool.size:
            try:
                with self.key_pool.acquire(attempted) as (key_idx, api_key):
                    attempted.add(key_idx)
                    return self._poll_markdown(self._submit_pdf(pdf_data, filename, key_idx, api_key), key_idx, api_key)
            except DataLabTryNextKey: continue
            except DataLabConversionError as exc:
                logger.error("DataLab conversion error for %s: %s", filename, exc)
                break
        logger.error("All DataLab API key slots unavailable for %s", filename)
        return None
