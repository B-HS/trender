from __future__ import annotations

import re

from trender.concurrency import run_concurrent
from trender.db.models import Article, Report
from trender.db.repositories import (
    fetch_articles_missing_translation,
    fetch_reports_missing_translation,
    update_article_translation,
    update_report_translation,
)
from trender.llm.base import ARTICLE_TRANSLATION_SYSTEM_PROMPT, REPORT_TRANSLATION_SYSTEM_PROMPT, LLMClient
from trender.llm.chain import build_chain
from trender.logging import get_logger

log = get_logger(__name__)

_BODY_CHAR_LIMIT = 16000
_TITLE_SYSTEM_PROMPT = "Translate the given news headline into natural Korean. Output ONLY the translated title, with no quotes or commentary."

_FENCE_RE = re.compile(r"^\s*```[a-zA-Z]*\n?|\n?```\s*$")


def _strip_fence(text: str) -> str:
    return _FENCE_RE.sub("", text.strip()).strip()


async def _translate_one(client: LLMClient, article: Article) -> bool:
    body = (article.content_original or "").strip()
    if not body or article.id is None:
        return False
    title_ko = _strip_fence(await client.complete(system=_TITLE_SYSTEM_PROMPT, user=article.title_original, temperature=0.2))
    content_ko = _strip_fence(await client.complete(system=ARTICLE_TRANSLATION_SYSTEM_PROMPT, user=body[:_BODY_CHAR_LIMIT], temperature=0.2))
    if not content_ko:
        log.warning("translate.empty", article_id=article.id, lang=article.lang)
        return False
    update_article_translation(article.id, title_ko or article.title_original, content_ko)
    log.info("translate.done", article_id=article.id, lang=article.lang, chars=len(content_ko))
    return True


async def translate_pending(limit: int = 60) -> int:
    chain = build_chain("light")
    articles = fetch_articles_missing_translation(limit=limit)
    log.info("translate.start", count=len(articles))

    async def _worker(article: Article) -> bool:
        try:
            return await _translate_one(chain, article)
        except Exception as e:
            log.warning("translate.article_failed", article_id=article.id, error=str(e))
            return False

    try:
        done = await run_concurrent(articles, _worker)
    finally:
        await chain.aclose()
    log.info("translate.finished", done=done, total=len(articles))
    return done


async def _translate_report_one(client: LLMClient, report: Report) -> bool:
    if report.id is None or not report.markdown.strip():
        return False
    title_ko = _strip_fence(await client.complete(system=_TITLE_SYSTEM_PROMPT, user=report.title, temperature=0.2))
    markdown_ko = _strip_fence(await client.complete(system=REPORT_TRANSLATION_SYSTEM_PROMPT, user=report.markdown, temperature=0.2))
    if not markdown_ko:
        log.warning("translate.report_empty", report_id=report.id, lang=report.lang)
        return False
    update_report_translation(report.id, title_ko or report.title, markdown_ko)
    log.info("translate.report_done", report_id=report.id, lang=report.lang, chars=len(markdown_ko))
    return True


async def translate_reports_pending(limit: int = 60) -> int:
    chain = build_chain("light")
    reports = fetch_reports_missing_translation(limit=limit)
    log.info("translate.reports_start", count=len(reports))

    async def _worker(report: Report) -> bool:
        try:
            return await _translate_report_one(chain, report)
        except Exception as e:
            log.warning("translate.report_failed", report_id=report.id, error=str(e))
            return False

    try:
        done = await run_concurrent(reports, _worker)
    finally:
        await chain.aclose()
    log.info("translate.reports_finished", done=done, total=len(reports))
    return done
