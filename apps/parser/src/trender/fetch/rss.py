from __future__ import annotations

from datetime import datetime, timezone
from time import mktime
from urllib.parse import urljoin

import feedparser
import httpx
from bs4 import BeautifulSoup
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from trender.config import get_settings
from trender.db.models import FetchedItem, Lang, Source
from trender.fetch.browser import fetch_html as fetch_html_browser
from trender.logging import get_logger

log = get_logger(__name__)

_USER_AGENT = "Mozilla/5.0 trender/0.1 (+https://github.com/) feedparser"


def _clean_html(html: str | None, base_url: str | None = None) -> str | None:
    """RSS 본문 HTML 의 노이즈 태그 제거 + 상대→절대 URL 보강. 본문 구조는 유지."""
    if not html:
        return None
    soup = BeautifulSoup(html, "lxml")

    for tag in soup(["script", "style", "noscript", "iframe", "form", "object", "embed"]):
        tag.decompose()

    if base_url:
        for img in soup.find_all("img"):
            src = (img.get("src") or "").strip()
            if src and not src.startswith(("http://", "https://", "data:", "//")):
                img["src"] = urljoin(base_url, src)
            elif src.startswith("//"):
                img["src"] = "https:" + src
        for a in soup.find_all("a"):
            href = (a.get("href") or "").strip()
            if href and not href.startswith(("http://", "https://", "mailto:", "tel:", "#")):
                a["href"] = urljoin(base_url, href)

    body = soup.body
    if body is not None:
        out = "".join(str(c) for c in body.contents).strip()
    else:
        out = str(soup).strip()
    return out or None


def _parse_published(entry: dict) -> datetime | None:
    for key in ("published_parsed", "updated_parsed", "created_parsed"):
        value = entry.get(key)
        if value:
            return datetime.fromtimestamp(mktime(value), tz=timezone.utc).replace(tzinfo=None)
    return None


@retry(
    reraise=True,
    stop=stop_after_attempt(2),
    wait=wait_exponential(multiplier=1, min=1, max=4),
    retry=retry_if_exception_type(httpx.TransportError),
)
async def _http_get(url: str, timeout: float) -> tuple[bytes | None, bool]:
    async with httpx.AsyncClient(headers={"User-Agent": _USER_AGENT}, timeout=timeout, follow_redirects=True) as client:
        resp = await client.get(url)
        if resp.status_code in (403, 401, 429) or "cf-mitigated" in resp.headers:
            return None, True
        resp.raise_for_status()
        return resp.content, False


async def _fetch_feed_bytes(url: str, timeout: float) -> bytes | None:
    try:
        payload, need_browser = await _http_get(url, timeout)
    except Exception as e:
        log.info("rss.httpx_failed", url=url, error=str(e))
        payload, need_browser = None, True
    if payload is not None:
        return payload
    if not need_browser:
        return None
    log.info("rss.fallback_to_browser", url=url)
    html = await fetch_html_browser(url, timeout_ms=int(timeout * 1000))
    return html.encode("utf-8") if html else None


async def fetch_rss(source: Source) -> list[FetchedItem]:
    if source.id is None:
        raise ValueError("source.id must be set")
    settings = get_settings()
    payload = await _fetch_feed_bytes(source.value, settings.fetch_timeout_seconds)
    if not payload:
        log.warning("rss.fetch_failed", url=source.value)
        return []
    feed = feedparser.parse(payload)
    items: list[FetchedItem] = []
    limit = settings.fetch_per_source_limit
    lang: Lang = source.lang or "en"
    for entry in feed.entries[:limit]:
        link = entry.get("link")
        title = entry.get("title")
        if not link or not title:
            continue
        body = _clean_html(entry.get("summary") or entry.get("description"), base_url=link)
        if entry.get("content"):
            try:
                body = _clean_html(entry["content"][0].get("value"), base_url=link) or body
            except (KeyError, IndexError, AttributeError):
                pass
        items.append(
            FetchedItem(
                source_id=source.id,
                url=link,
                lang=lang,
                title_original=title,
                content_original=body,
                published_at=_parse_published(entry),
            )
        )
    log.info("rss.fetched", url=source.value, count=len(items))
    return items
