from datetime import date

from trender.db.models import Article
from trender.pipeline.report import (
    _BODY_CHAR_LIMIT,
    _MAX_TOTAL_BODY_CHARS,
    _cap_articles,
    _extract_title,
    _fallback_title,
    _format_articles_block,
    _period_bounds,
)


def _mk(i: int, body: str | None) -> Article:
    return Article(source_id=1, url=f"https://example.com/{i}", lang="ko", title_original=f"T{i}", content_original=body)


def test_cap_articles_keeps_all_when_under_limit():
    arts = [_mk(i, "x" * 1000) for i in range(5)]
    assert len(_cap_articles(arts)) == 5


def test_cap_articles_stops_when_total_exceeds_limit():
    full = "x" * _BODY_CHAR_LIMIT
    per = _BODY_CHAR_LIMIT
    fit = _MAX_TOTAL_BODY_CHARS // per
    arts = [_mk(i, full) for i in range(fit + 10)]
    assert len(_cap_articles(arts)) == fit


def test_cap_articles_always_keeps_first_even_if_huge():
    arts = [_mk(0, "x" * (_MAX_TOTAL_BODY_CHARS * 5))]
    assert len(_cap_articles(arts)) == 1


def test_cap_articles_counts_body_capped_at_body_char_limit():
    big = "x" * (_BODY_CHAR_LIMIT * 100)
    per = _BODY_CHAR_LIMIT
    fit = _MAX_TOTAL_BODY_CHARS // per
    arts = [_mk(i, big) for i in range(fit + 10)]
    assert len(_cap_articles(arts)) == fit


def test_cap_articles_empty_list():
    assert _cap_articles([]) == []


def test_format_articles_block_truncates_long_body():
    out = _format_articles_block([_mk(1, "x" * (_BODY_CHAR_LIMIT + 100))])
    assert "[... 본문 일부 생략 ...]" in out
    assert "[#1]" in out


def test_format_articles_block_keeps_short_body_verbatim():
    out = _format_articles_block([_mk(1, "짧은 본문")])
    assert "생략" not in out
    assert "짧은 본문" in out


def test_period_bounds_daily_is_previous_day():
    assert _period_bounds("daily", date(2026, 6, 4)) == (date(2026, 6, 3), date(2026, 6, 3))


def test_period_bounds_weekly_is_previous_full_week():
    start, end = _period_bounds("weekly", date(2026, 6, 4))
    assert start.weekday() == 0
    assert end.weekday() == 6
    assert (end - start).days == 6
    assert end < date(2026, 6, 4)


def test_extract_title_finds_first_h1():
    assert _extract_title("# 제목입니다\n본문 내용", "fallback") == "제목입니다"


def test_extract_title_uses_fallback_without_h1():
    assert _extract_title("## 소제목\n본문", "fallback") == "fallback"


def test_extract_title_ignores_hash_not_at_line_start():
    assert _extract_title("문장 #해시태그\n# 진짜제목\n", "fallback") == "진짜제목"


def test_fallback_title_ko_contains_labels():
    t = _fallback_title("daily", "ko", date(2026, 6, 3), date(2026, 6, 3))
    assert "일간" in t
    assert "리포트" in t


def test_fallback_title_en_is_english():
    t = _fallback_title("weekly", "en", date(2026, 6, 1), date(2026, 6, 7))
    assert "report" in t.lower()
