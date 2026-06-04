from __future__ import annotations

import json
import re

from trender.db.models import Article, KeywordExtracted
from trender.db.repositories import (
    fetch_articles_missing_keywords,
    insert_keywords,
    mark_article_keywords_extracted,
)
from trender.llm.base import KEYWORD_EXTRACTION_SYSTEM_PROMPT, LLMClient
from trender.llm.chain import build_chain
from trender.logging import get_logger

log = get_logger(__name__)

_BODY_CHAR_LIMIT = 16000
_MAX_KEYWORDS = 60
_KEYWORD_MAX_LEN = 190

_LANG_NAME = {"ko": "Korean (한국어)", "ja": "Japanese (日本語)", "en": "English"}

_LANG_STRICT_RULE = {
    "ko": "Use Hangul (한글) and Latin script as they appear. NEVER output Japanese kana/kanji.",
    "ja": "Use kana, kanji, and Latin script as they appear. NEVER output Korean Hangul (한글).",
    "en": "OUTPUT ENGLISH (Latin script) ONLY. NEVER output Korean Hangul (한글) or Japanese kana/kanji. If a concept has no English label in the body, simply skip it — do not translate it into another language.",
}

_USER_PROMPT_TEMPLATE = """You will read a single news article and produce an exhaustive, faithful keyword index of its content.

### Article language: {lang_name}
Keywords MUST be returned in **{lang_name}**, exactly as they appear in the body. Do NOT translate, transliterate, or paraphrase. Do NOT generate keywords in any other language.

**{lang_strict_rule}**

### Source article
Title: {title}
URL: {url}
Body length: ~{body_len} characters

Body:
{body}

### What is a "keyword"
A keyword is any substring of the body that a domain reader would want to retrieve this article by. Concretely, extract ALL of the following whenever present:
- Product names, service names, model names (e.g. "GPT-5.1", "Claude Opus 4.7", "Gemini Flash", "iPhone 17 Pro")
- Company / organisation / lab names (e.g. "OpenAI", "Anthropic", "Google DeepMind", "ソフトバンク")
- Person names with role context if available (e.g. "Sam Altman", "孫正義")
- Specific technologies, frameworks, protocols, libraries, file formats, standards (e.g. "MCP", "CUDA 13", "WebGPU", "FlashAttention-3")
- Specific architectures, methods, algorithms (e.g. "Mixture of Experts", "speculative decoding", "RLHF")
- Concrete metrics, benchmarks, datasets (e.g. "MMLU", "SWE-bench Verified", "ImageNet")
- Versioned releases, dated events, prices, funding amounts when they read as named entities (e.g. "Series E", "$6.5B funding", "2026 Q1 release")
- Codenames, internal project names, repository names
- Industry / domain terms that carry signal (e.g. "agentic coding", "on-device inference", "AI 안전성", "生成AI")

### Hard rules
- Output the keyword EXACTLY as it appears in the body (same casing, same script, same spacing). If the body writes "OpenAI", do not output "openai" or "Open AI".
- Multi-word keywords are fine when they are a single phrase ("retrieval augmented generation", "推論モデル", "에이전트 코딩").
- Do NOT invent keywords that are not literally present in the body or title.
- Do NOT include generic stop-phrases ("the company", "this article", "최근", "今回", "발표했다").
- Do NOT include sentence fragments, full sentences, or descriptions.
- Skip pure URLs, dates without name context, and dollar amounts without context.
- Prefer the most specific surface form. If the body says both "GPT-5.1" and "GPT", emit "GPT-5.1".
- Deduplicate. If a keyword appears multiple times, emit it once and use `score` to reflect importance.
- Each keyword must be 1–{kw_max} characters.
- Aim for completeness: it is better to over-extract precise entities than to miss them. Target 15–{kw_max_total} keywords for substantive articles; short articles may have fewer.

### Scoring
Assign integer `score` 1–5 reflecting how central the keyword is to the article:
- 5: headline-level subject of the article
- 4: major recurring entity / technology that drives the story
- 3: clearly relevant supporting entity
- 2: mentioned with substance, but secondary
- 1: peripheral mention

### Output schema
Return ONLY a JSON object of this exact shape, no prose:
{{
  "keywords": [
    {{"keyword": "<verbatim substring>", "score": <1-5>}}
  ]
}}
"""

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _coerce_json(text: str) -> dict:
    match = _JSON_BLOCK.search(text)
    if not match:
        raise ValueError(f"no JSON found in LLM output: {text[:200]}")
    return json.loads(match.group(0))


def _clean_keyword(raw: str) -> str | None:
    s = (raw or "").strip()
    s = s.strip("`\"'“”‘’「」『』《》<>[]()")
    s = re.sub(r"\s+", " ", s)
    if not s:
        return None
    if len(s) > _KEYWORD_MAX_LEN:
        return None
    return s


_HANGUL_RE = re.compile(r"[가-힣]")
_KANA_RE = re.compile(r"[ぁ-んァ-ヶ]")


def _matches_source_lang(keyword: str, lang: str) -> bool:
    """LLM이 원어 강제를 위반해 다른 언어 키워드를 뱉었는지 코드 사이드에서 차단."""
    if lang == "en":
        return not (_HANGUL_RE.search(keyword) or _KANA_RE.search(keyword))
    if lang == "ko":
        return not _KANA_RE.search(keyword)
    if lang == "ja":
        return not _HANGUL_RE.search(keyword)
    return True


async def _extract_one(client: LLMClient, article: Article) -> int:
    raw_body = (article.content_original or "").strip()
    if not raw_body:
        return 0
    body = raw_body[:_BODY_CHAR_LIMIT]
    prompt = _USER_PROMPT_TEMPLATE.format(
        lang_name=_LANG_NAME.get(article.lang, article.lang),
        lang_strict_rule=_LANG_STRICT_RULE.get(article.lang, ""),
        title=article.title_original,
        url=article.url,
        body_len=len(raw_body),
        body=body,
        kw_max=_KEYWORD_MAX_LEN,
        kw_max_total=_MAX_KEYWORDS,
    )
    raw = await client.complete_json(system=KEYWORD_EXTRACTION_SYSTEM_PROMPT, user=prompt, temperature=0.0)
    try:
        data = _coerce_json(raw)
    except (ValueError, json.JSONDecodeError) as e:
        log.warning("keywords.parse_failed", article_id=article.id, error=str(e))
        return 0

    raw_items = data.get("keywords") or []
    seen: set[str] = set()
    kws: list[KeywordExtracted] = []
    dropped_lang = 0
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        keyword = _clean_keyword(str(item.get("keyword") or ""))
        if not keyword:
            continue
        if not _matches_source_lang(keyword, article.lang):
            dropped_lang += 1
            continue
        key = keyword.casefold()
        if key in seen:
            continue
        seen.add(key)
        try:
            score = int(item.get("score") or 1)
        except (TypeError, ValueError):
            score = 1
        score = max(1, min(5, score))
        kws.append(KeywordExtracted(article_id=article.id or 0, keyword=keyword, score=score))
        if len(kws) >= _MAX_KEYWORDS:
            break

    if dropped_lang > 0:
        log.info("keywords.dropped_wrong_lang", article_id=article.id, lang=article.lang, dropped=dropped_lang)

    if article.id is None:
        return 0
    insert_keywords(article.id, kws)
    mark_article_keywords_extracted(article.id)
    log.info("keywords.done", article_id=article.id, lang=article.lang, count=len(kws))
    return len(kws)


async def extract_pending(limit: int = 60) -> int:
    chain = build_chain("light")
    articles = fetch_articles_missing_keywords(limit=limit)
    log.info("keywords.start", count=len(articles))
    done = 0
    try:
        for article in articles:
            try:
                if await _extract_one(chain, article) >= 0:
                    done += 1
            except Exception as e:
                log.warning("keywords.article_failed", article_id=article.id, error=str(e))
    finally:
        await chain.aclose()
    log.info("keywords.finished", done=done, total=len(articles))
    return done
