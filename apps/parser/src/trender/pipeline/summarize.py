from __future__ import annotations

import json
import re

from trender.db.models import Article, KeywordExtracted
from trender.db.repositories import (
    fetch_articles_missing_summary,
    insert_keywords,
    update_article_summary,
)
from trender.llm.base import KOREAN_OUTPUT_SYSTEM_PROMPT, LLMClient
from trender.llm.chain import build_default_chain
from trender.logging import get_logger

log = get_logger(__name__)

_USER_PROMPT_TEMPLATE = """다음 기사를 한국어로 요약해줘. 출력은 반드시 아래 JSON 스키마를 그대로 따른다.

스키마:
{{
  "title_ko": "한국어 제목 (50자 이내)",
  "summary_ko": "한국어 요약 (3~5문장)",
  "keywords": [
    {{"keyword_ko": "한국어 키워드", "keyword_original": "원어 키워드 또는 null"}}
  ]
}}

- 키워드는 3~6개로 추출. 한국어가 자연스럽지 않은 고유명사는 원어와 한국어 음차를 함께 둔다.
- 출력은 JSON만. 코드 블록 없이.

기사 언어: {lang}
기사 제목: {title}
기사 URL: {url}
기사 본문:
{body}
"""

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _coerce_json(text: str) -> dict:
    match = _JSON_BLOCK.search(text)
    if not match:
        raise ValueError(f"no JSON found in LLM output: {text[:200]}")
    return json.loads(match.group(0))


async def _summarize_one(client: LLMClient, article: Article) -> None:
    body = (article.content_original or "").strip()[:4000] or article.title_original
    prompt = _USER_PROMPT_TEMPLATE.format(
        lang=article.lang,
        title=article.title_original,
        url=article.url,
        body=body,
    )
    raw = await client.complete_json(system=KOREAN_OUTPUT_SYSTEM_PROMPT, user=prompt, temperature=0.1)
    try:
        data = _coerce_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        log.warning("summarize.parse_failed", article_id=article.id, error=str(e))
        return

    title_ko = (data.get("title_ko") or "").strip() or article.title_original
    summary_ko = (data.get("summary_ko") or "").strip()
    if not summary_ko:
        log.warning("summarize.empty_summary", article_id=article.id)
        return

    if article.id is None:
        return
    update_article_summary(article.id, title_ko=title_ko[:500], summary_ko=summary_ko)

    keywords = []
    for kw in (data.get("keywords") or [])[:6]:
        ko = (kw.get("keyword_ko") or "").strip()
        if not ko:
            continue
        original = (kw.get("keyword_original") or None) or None
        keywords.append(
            KeywordExtracted(
                article_id=article.id,
                keyword_ko=ko[:120],
                keyword_original=(original or "").strip()[:120] or None,
            )
        )
    insert_keywords(article.id, keywords)
    log.info("summarize.done", article_id=article.id, keywords=len(keywords))


async def summarize_pending(limit: int = 30) -> int:
    chain = build_default_chain()
    articles = fetch_articles_missing_summary(limit=limit)
    log.info("summarize.start", count=len(articles))
    done = 0
    try:
        for article in articles:
            try:
                await _summarize_one(chain, article)
                done += 1
            except Exception as e:
                log.warning("summarize.article_failed", article_id=article.id, error=str(e))
    finally:
        await chain.aclose()
    log.info("summarize.finished", done=done, total=len(articles))
    return done
