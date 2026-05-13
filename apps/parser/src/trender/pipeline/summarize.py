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
  "title_ko": "한국어 제목 (50자 이내, 핵심 메시지가 드러나게)",
  "summary_ko": "한국어 요약 (자세한 가이드는 아래 규칙 참고)",
  "keywords": [
    {{"keyword_ko": "한국어 키워드", "keyword_original": "원어 키워드 또는 null"}}
  ]
}}

### summary_ko 작성 규칙 (반드시 지킬 것)
이것은 단순 요약이 아니라 **본문에 있는 정보를 한국어로 빠짐없이 재구성한 상세 정리본**이다.
한국 독자는 영어/일본어 원문을 읽지 않기 때문에, 원문의 디테일(수치, 인용, 사례, 기술 명세, 인물 발언, 일정, 가격, 비교 데이터 등)을 모두 한국어로 옮겨 담아야 한다.

- **분량은 원문 길이의 40~60%를 목표**로 한다. 짧은 헤드라인 요약은 금지.
  - 원문 800자 미만: 한국어 정리 500~800자
  - 원문 800~3,000자: 한국어 정리 1,000~2,000자
  - 원문 3,000~8,000자: 한국어 정리 2,000~4,000자
  - 원문 8,000자 이상: 한국어 정리 3,500~5,500자
- 다음을 빠뜨리지 말 것:
  - 모든 **수치·통계·금액·날짜·버전**
  - **고유명사**(제품명, 회사명, 인물명, 기술명) — 원어 병기
  - **인물 발언/인용** — 핵심 인용은 간접화법으로 보존
  - **기술 아키텍처/구조/방법론**의 핵심 요소
  - **사례·비교·예시**
  - **향후 일정·로드맵·전망**
- 단순 압축·생략이 아닌 **구조화된 한국어 재구성**. 가능한 정보 손실 0.
- 출력은 **마크다운**으로 작성:
  - 첫 단락은 한두 문장 리드(핵심 메시지)
  - 이후 `## 소제목` 또는 `### 소제목`으로 섹션 구분 (예: `## 핵심 발표`, `## 기술 구조`, `## 사례·인용`, `## 영향과 향후 일정`)
  - 항목 나열은 `- ` 불릿 또는 `1.` 번호
  - 강조는 `**굵게**`, 코드/식별자는 ``inline code``
- 마무리 멘트("이상입니다", "정리하면", "결론적으로" 등)나 자기 언급("이 글에서는", "요약하자면")은 쓰지 않는다.
- 영어 본문이면 모든 표현을 자연스러운 한국어로 옮기되, 제품명·코드명은 원어 유지.

### keywords 규칙
- 3~6개. 가장 검색·트렌드 가치가 높은 고유명사·기술명·제품명 위주.
- 한국어가 자연스럽지 않은 고유명사는 `keyword_ko`에 한국어 음차, `keyword_original`에 원어를 둔다.
- 일반 단어("기술", "발표")는 키워드에 넣지 않는다.

### 출력
- JSON만. 코드 블록(```)으로 감싸지 말 것.

---
기사 언어: {lang}
기사 제목: {title}
기사 URL: {url}
원문 길이: 약 {body_len}자

기사 본문:
{body}
"""

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _coerce_json(text: str) -> dict:
    match = _JSON_BLOCK.search(text)
    if not match:
        raise ValueError(f"no JSON found in LLM output: {text[:200]}")
    return json.loads(match.group(0))


_BODY_CHAR_LIMIT = 12000


def _min_summary_for(body_len: int) -> int:
    if body_len < 800:
        return 350
    if body_len < 3000:
        return 700
    if body_len < 8000:
        return 1500
    return 2500


async def _summarize_one(client: LLMClient, article: Article) -> None:
    raw_body = (article.content_original or "").strip()
    body = raw_body[:_BODY_CHAR_LIMIT] or article.title_original
    prompt = _USER_PROMPT_TEMPLATE.format(
        lang=article.lang,
        title=article.title_original,
        url=article.url,
        body_len=len(raw_body),
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

    if len(summary_ko) < _min_summary_for(len(raw_body)):
        log.info(
            "summarize.retry_too_short",
            article_id=article.id,
            summary_len=len(summary_ko),
            body_len=len(raw_body),
        )
        retry_prompt = (
            prompt
            + "\n\n[재요청] 직전 요약이 너무 짧았다. 위의 'summary_ko 작성 규칙'을 다시 한 번 엄격히 지켜 더 상세한 요약을 작성해줘. "
            "특히 분량 기준(원문 길이 비례)과 정보 항목(사실/수치/배경/영향)을 모두 충족해야 한다. JSON 스키마는 동일하게 유지."
        )
        raw_retry = await client.complete_json(
            system=KOREAN_OUTPUT_SYSTEM_PROMPT, user=retry_prompt, temperature=0.2
        )
        try:
            data_retry = _coerce_json(raw_retry)
            retry_summary = (data_retry.get("summary_ko") or "").strip()
            if len(retry_summary) > len(summary_ko):
                summary_ko = retry_summary
                title_ko = (data_retry.get("title_ko") or "").strip() or title_ko
                retry_keywords = data_retry.get("keywords") or []
                if retry_keywords:
                    data["keywords"] = retry_keywords
        except (ValueError, json.JSONDecodeError) as e:
            log.warning("summarize.retry_parse_failed", article_id=article.id, error=str(e))

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


async def summarize_pending(limit: int = 60) -> int:
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
