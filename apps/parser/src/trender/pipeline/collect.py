from __future__ import annotations

import asyncio
from datetime import date

from trender.config import get_settings
from trender.db.models import Article, Source
from trender.db.repositories import (
    fetch_articles_missing_summary,
    increment_source_stat,
    insert_article_if_new,
    list_active_sources,
    update_article_content,
)
from trender.fetch.article import fetch_article_body
from trender.fetch.browser import shutdown as shutdown_browser
from trender.fetch.rss import fetch_rss
from trender.logging import get_logger

log = get_logger(__name__)

_SHORT_BODY_THRESHOLD = 800


async def _maybe_enrich_body(url: str, rss_body: str | None) -> str | None:
    """RSS 본문이 너무 짧으면 페이지를 직접 긁어서 더 긴 본문으로 교체."""
    existing = (rss_body or "").strip()
    if len(existing) >= _SHORT_BODY_THRESHOLD:
        return existing or None
    try:
        full = await fetch_article_body(url)
    except Exception as e:
        log.info("collect.enrich_failed", url=url, error=str(e))
        return existing or None
    if full and len(full) > len(existing):
        log.info("collect.enriched_inline", url=url, rss=len(existing), full=len(full))
        return full
    return existing or None


async def _collect_one(source: Source, semaphore: asyncio.Semaphore) -> int:
    async with semaphore:
        try:
            items = await fetch_rss(source)
        except Exception as e:
            log.warning("collect.source_failed", source_id=source.id, value=source.value, error=str(e))
            return 0
    today = date.today()
    if source.id is not None and items:
        increment_source_stat(source.id, today, hit=len(items))
    new_count = 0
    for item in items:
        body = await _maybe_enrich_body(item.url, item.content_original)
        article = Article(
            source_id=item.source_id,
            url=item.url,
            lang=item.lang,
            title_original=item.title_original,
            content_original=body,
            published_at=item.published_at,
        )
        article_id = insert_article_if_new(article)
        if article_id is not None:
            new_count += 1
    log.info("collect.source_done", source_id=source.id, value=source.value, new=new_count)
    return new_count


async def _enrich_short_articles(limit: int) -> int:
    """과거에 짧게 들어간 기사를 따라잡기 위한 안전망. summary 유무 관계없이 본문이 짧으면 재시도."""
    candidates = fetch_articles_missing_summary(limit=limit)
    enriched = 0
    for article in candidates:
        existing = (article.content_original or "").strip()
        if len(existing) >= _SHORT_BODY_THRESHOLD or article.id is None:
            continue
        body = await fetch_article_body(article.url)
        if not body or len(body) <= len(existing):
            continue
        update_article_content(article.id, body)
        enriched += 1
        log.info("collect.enriched", article_id=article.id, length=len(body))
    return enriched


async def collect_all(*, enrich: bool = True, enrich_limit: int = 30) -> int:
    sources = [s for s in list_active_sources(kind="web") if s.id is not None]
    settings = get_settings()
    semaphore = asyncio.Semaphore(settings.fetch_concurrency)
    try:
        results = await asyncio.gather(*(_collect_one(s, semaphore) for s in sources), return_exceptions=False)
        total = sum(results)
        if enrich:
            enriched = await _enrich_short_articles(limit=enrich_limit)
            log.info("collect.enrich_done", enriched=enriched)
    finally:
        await shutdown_browser()
    log.info("collect.done", sources=len(sources), new_articles=total)
    return total
