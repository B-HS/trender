from __future__ import annotations

from datetime import date, datetime, time, timedelta

from trender.db.models import Article, Lang, Report, ReportItem, ReportKind
from trender.db.repositories import (
    fetch_articles_in_range,
    increment_source_stat,
    insert_report,
    replace_report_items,
    report_exists,
)
from trender.llm.base import build_report_system_prompt
from trender.llm.chain import build_default_chain
from trender.logging import get_logger

log = get_logger(__name__)


def _period_bounds(kind: ReportKind, ref: date) -> tuple[date, date]:
    """ref(보통 cron 발행일) 기준으로 직전 마감된 기간을 돌려준다."""
    if kind == "daily":
        d = ref - timedelta(days=1)
        return (d, d)
    # weekly: 월요일 새벽에 발행되면 ref.weekday()==0, 지난주 월~일 구간을 리턴
    end = ref - timedelta(days=ref.weekday() + 1)  # 지난주 일요일
    start = end - timedelta(days=6)
    return (start, end)


_KIND_LABEL = {
    "ko": {"daily": "일간", "weekly": "주간"},
    "ja": {"daily": "日次", "weekly": "週次"},
    "en": {"daily": "daily", "weekly": "weekly"},
}

_USER_PROMPT_BY_LANG: dict[Lang, str] = {
    "ko": (
        "아래는 {start} ~ {end} 기간({kind_label})에 수집된 AI/테크 관련 한국어 기사 원문 목록이다.\n"
        "기사들의 원문을 빠짐없이 읽고, 이 기간의 흐름을 정리하는 한국어 마크다운 리포트를 작성해라.\n"
        "분량 제한 없이 매우 상세하게 써도 좋다. 정보 손실을 최소화하는 데 우선순위를 둔다.\n\n"
        "리포트 구조 (반드시 지킬 것):\n"
        "1. `# 제목` — 이번 기간을 관통하는 한 줄 제목\n"
        "2. 2~3문단 도입 — 이번 기간의 가장 큰 흐름·맥락\n"
        "3. `## 핵심 트렌드` — 굵직한 흐름 5개 이상. 각 항목은 한 문단 이상으로 근거 기사 번호를 `[#N]` 형태로 인용\n"
        "4. `## 주요 발표·릴리스` — 신제품/모델/연구 발표 정리. 회사·제품·수치·날짜·인용을 모두 보존\n"
        "5. `## 산업·정책·투자` — 인수합병, 투자, 규제, 정책 동향\n"
        "6. `## 주목할 기사` — 가장 인상적인 기사들을 별도로 풀어서 정리 (**제목** — 한 단락 코멘트 + 원문 링크)\n"
        "7. `## 향후 관전 포인트` — 다음 기간에 지켜볼 사안 3~5개\n\n"
        "엄수 사항:\n"
        "- 원문에 나온 수치·고유명사·인용·일정·가격은 누락하지 않는다.\n"
        "- 추측·창작 금지. 기사에 없는 사실은 쓰지 않는다.\n"
        "- 인용 시 `[#N]` 표기로 아래 기사 번호를 참조한다.\n\n"
        "기사 원문 목록:\n"
        "{articles}\n"
    ),
    "ja": (
        "以下は {start} 〜 {end} の期間（{kind_label}）に収集された AI／テック関連の日本語記事の本文一覧である。\n"
        "全記事の本文を漏れなく読み、この期間の流れを総括する日本語マークダウンレポートを作成せよ。\n"
        "分量制限はなく、非常に詳細に書いてよい。情報欠落を最小化することを最優先する。\n\n"
        "レポート構成（必ず守ること）：\n"
        "1. `# タイトル` — 期間全体を貫く一行タイトル\n"
        "2. 2〜3 段落の導入 — 期間中の最も大きな流れ・文脈\n"
        "3. `## 主要トレンド` — 大きな流れを 5 つ以上。各項目は段落以上で、根拠記事を `[#N]` 形式で引用\n"
        "4. `## 主要な発表・リリース` — 新製品／モデル／研究発表をまとめる。会社・製品・数値・日付・発言をすべて保存\n"
        "5. `## 産業・政策・投資` — 買収、投資、規制、政策動向\n"
        "6. `## 注目記事` — 特に重要な記事を取り上げて整理（**タイトル** — 1 段落のコメント + 原文リンク）\n"
        "7. `## 今後の注目ポイント` — 次の期間に注視すべき論点 3〜5 件\n\n"
        "厳守事項:\n"
        "- 本文に出てきた数値・固有名詞・引用・日程・価格は欠落させない。\n"
        "- 推測・創作は禁止。記事にない事実は書かない。\n"
        "- 引用時は `[#N]` 表記で下記の記事番号を参照する。\n\n"
        "記事本文一覧:\n"
        "{articles}\n"
    ),
    "en": (
        "Below are the full-text English articles on AI/tech collected for the period {start} – {end} ({kind_label}).\n"
        "Read every article in full and write a comprehensive English markdown report that captures the period's storyline.\n"
        "There is no length limit; favor depth and detail to minimize information loss.\n\n"
        "Required structure:\n"
        "1. `# Title` — a single-line title that captures the period\n"
        "2. 2–3 paragraph intro — the dominant narrative and context of the period\n"
        "3. `## Major Trends` — at least 5 substantive trends. Each item is a paragraph or more, citing source article numbers as `[#N]`\n"
        "4. `## Notable Launches & Releases` — products, models, research releases. Preserve all company, product, numeric, date, and quote details\n"
        "5. `## Industry, Policy & Funding` — M&A, investments, regulation, policy moves\n"
        "6. `## Spotlight Articles` — the standout pieces, each as **Title** — one-paragraph commentary + source link\n"
        "7. `## What to Watch Next` — 3–5 storylines to track in the next period\n\n"
        "Strict rules:\n"
        "- Do not drop numbers, proper nouns, quotes, schedules, or prices that appear in the source text.\n"
        "- No speculation or invention; do not state facts that are not in the source articles.\n"
        "- When citing, use `[#N]` to refer to the article numbers below.\n\n"
        "Source articles:\n"
        "{articles}\n"
    ),
}


_BODY_CHAR_LIMIT = 12000


def _format_articles_block(articles: list[Article]) -> str:
    parts: list[str] = []
    for i, a in enumerate(articles, 1):
        body = (a.content_original or "").strip()
        if len(body) > _BODY_CHAR_LIMIT:
            body = body[:_BODY_CHAR_LIMIT] + "\n[... 본문 일부 생략 ...]"
        parts.append(
            f"--- [#{i}] ---\n"
            f"Title: {a.title_original}\n"
            f"URL: {a.url}\n"
            f"Published: {a.published_at or a.fetched_at}\n"
            f"Body:\n{body}\n"
        )
    return "\n\n".join(parts)


def _format_user_prompt(kind: ReportKind, lang: Lang, start: date, end: date, articles: list[Article]) -> str:
    template = _USER_PROMPT_BY_LANG[lang]
    return template.format(
        start=start,
        end=end,
        kind_label=_KIND_LABEL[lang][kind],
        articles=_format_articles_block(articles),
    )


def _extract_title(markdown: str, fallback: str) -> str:
    for line in markdown.splitlines():
        line = line.strip()
        if line.startswith("# "):
            return line.lstrip("# ").strip()
    return fallback


def _fallback_title(kind: ReportKind, lang: Lang, start: date, end: date) -> str:
    label = _KIND_LABEL[lang][kind]
    if lang == "ja":
        return f"{label}レポート {start} 〜 {end}"
    if lang == "en":
        return f"{label.capitalize()} report {start} – {end}"
    return f"{label} 리포트 {start} ~ {end}"


async def generate_report(
    kind: ReportKind,
    lang: Lang,
    ref: date | None = None,
    *,
    skip_if_exists: bool = False,
) -> int | None:
    today = ref or date.today()
    start, end = _period_bounds(kind, today)
    if skip_if_exists and report_exists(kind, lang, start, end):
        log.info("report.skip_exists", kind=kind, lang=lang, period_start=str(start), period_end=str(end))
        return None
    range_start = datetime.combine(start, time.min)
    range_end = datetime.combine(end, time.max)
    articles = fetch_articles_in_range(range_start, range_end, lang=lang)
    if not articles:
        log.warning("report.empty", kind=kind, lang=lang, period_start=str(start), period_end=str(end))
        return None

    user_prompt = _format_user_prompt(kind, lang, start, end, articles)
    system_prompt = build_report_system_prompt(lang)
    chain = build_default_chain()
    try:
        markdown = await chain.complete(system=system_prompt, user=user_prompt, temperature=0.3)
    finally:
        await chain.aclose()

    title = _extract_title(markdown, fallback=_fallback_title(kind, lang, start, end))
    report = Report(
        kind=kind,
        lang=lang,
        period_start=start,
        period_end=end,
        title=title[:500],
        markdown=markdown,
    )
    report_id = insert_report(report)
    items = [ReportItem(report_id=report_id, article_id=a.id, rank=i) for i, a in enumerate(articles, 1) if a.id]
    replace_report_items(report_id, items)
    for a in articles:
        if a.source_id:
            increment_source_stat(a.source_id, today, adoption=1)
    log.info("report.done", report_id=report_id, kind=kind, lang=lang, items=len(items))
    return report_id


async def generate_all_languages(
    kind: ReportKind,
    ref: date | None = None,
    *,
    skip_if_exists: bool = False,
) -> dict[Lang, int | None]:
    results: dict[Lang, int | None] = {}
    for lang in ("ko", "ja", "en"):
        try:
            results[lang] = await generate_report(kind, lang, ref=ref, skip_if_exists=skip_if_exists)
        except Exception as e:
            log.warning("report.lang_failed", kind=kind, lang=lang, error=str(e))
            results[lang] = None
    return results


def _ref_for_daily_period(period_date: date) -> date:
    return period_date + timedelta(days=1)


def _ref_for_weekly_period(monday: date) -> date:
    return monday + timedelta(days=7)


async def backfill_reports(
    kind: ReportKind,
    days: int,
    *,
    ref: date | None = None,
) -> dict[str, int]:
    """과거 N일(또는 N주) 구간에서 누락된 (kind, lang) 리포트를 채워 넣는다.

    daily 는 어제부터 N일 전까지, weekly 는 직전 마감 주부터 N주 전까지를 본다.
    이미 (kind, lang, period_start, period_end) 가 있으면 LLM 호출 없이 스킵한다.
    """
    today = ref or date.today()
    generated = 0
    skipped = 0
    empty = 0
    failed = 0

    if kind == "daily":
        target_refs = [today - timedelta(days=offset) for offset in range(1, days + 1)]
    else:
        last_sunday = today - timedelta(days=today.weekday() + 1)
        last_monday = last_sunday - timedelta(days=6)
        target_refs = [_ref_for_weekly_period(last_monday - timedelta(weeks=offset)) for offset in range(days)]

    for r in target_refs:
        period_start, period_end = _period_bounds(kind, r)
        for lang in ("ko", "ja", "en"):
            if report_exists(kind, lang, period_start, period_end):
                skipped += 1
                continue
            try:
                report_id = await generate_report(kind, lang, ref=r)
            except Exception as e:
                failed += 1
                log.warning(
                    "backfill.failed",
                    kind=kind,
                    lang=lang,
                    period_start=str(period_start),
                    period_end=str(period_end),
                    error=str(e),
                )
                continue
            if report_id is None:
                empty += 1
            else:
                generated += 1

    summary = {"generated": generated, "skipped": skipped, "empty": empty, "failed": failed}
    log.info("backfill.done", kind=kind, **summary)
    return summary
