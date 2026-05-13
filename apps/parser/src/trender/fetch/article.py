from __future__ import annotations

import httpx
import trafilatura

from trender.config import get_settings
from trender.fetch.browser import fetch_html as fetch_html_browser
from trender.logging import get_logger

log = get_logger(__name__)

_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


async def _try_httpx(url: str, timeout: float) -> tuple[str | None, bool]:
    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": _USER_AGENT, "Accept-Language": "ko,ja;q=0.9,en;q=0.8"},
            timeout=timeout,
            follow_redirects=True,
        ) as client:
            resp = await client.get(url)
            if resp.status_code in (403, 401, 429) or "cf-mitigated" in resp.headers:
                return None, True
            resp.raise_for_status()
            return resp.text, False
    except (httpx.TransportError, httpx.HTTPStatusError) as e:
        log.info("article.httpx_failed", url=url, error=str(e))
        return None, True


def _extract_main_text(html: str, url: str) -> str | None:
    try:
        text = trafilatura.extract(html, url=url, include_links=False, include_images=False, favor_recall=True)
        if text:
            return text.strip()
    except Exception as e:
        log.warning("article.trafilatura_failed", url=url, error=str(e))
    return None


async def fetch_article_body(url: str) -> str | None:
    settings = get_settings()
    html, need_browser = await _try_httpx(url, timeout=settings.fetch_timeout_seconds)
    if need_browser or not html:
        html = await fetch_html_browser(url, timeout_ms=settings.fetch_timeout_seconds * 1000)
        if not html:
            return None
    return _extract_main_text(html, url)
