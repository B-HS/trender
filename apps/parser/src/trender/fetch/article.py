from __future__ import annotations

from urllib.parse import urljoin

import httpx
import trafilatura
from bs4 import BeautifulSoup

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


def _normalize_html(html: str, base_url: str) -> str:
    """trafilatura HTML 출력을 표준 HTML로 정리: graphic→img, 상대→절대 URL, body unwrap."""
    soup = BeautifulSoup(html, "lxml")

    for graphic in soup.find_all("graphic"):
        attrs = {k: v for k, v in graphic.attrs.items() if k in ("src", "alt", "title")}
        img = soup.new_tag("img", **attrs)
        graphic.replace_with(img)

    for row in soup.find_all("row"):
        row.name = "tr"
        if "span" in row.attrs:
            del row.attrs["span"]
    for cell in soup.find_all("cell"):
        is_head = cell.get("role") == "head"
        cell.name = "th" if is_head else "td"
        if "role" in cell.attrs:
            del cell.attrs["role"]

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
        inner = "".join(str(c) for c in body.contents)
        return inner.strip()
    return str(soup).strip()


def _extract_main_html(html: str, url: str) -> str | None:
    """본문 영역만 HTML로 추출 (trafilatura). 광고/네비/푸터 제거."""
    try:
        out = trafilatura.extract(
            html,
            url=url,
            output_format="html",
            include_links=True,
            include_images=True,
            include_formatting=True,
            include_tables=True,
            favor_recall=True,
        )
        if out:
            return _normalize_html(out, base_url=url)
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
    return _extract_main_html(html, url)
