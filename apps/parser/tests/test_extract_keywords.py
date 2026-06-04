import pytest

from trender.pipeline.extract_keywords import (
    _KEYWORD_MAX_LEN,
    _clean_keyword,
    _coerce_json,
    _matches_source_lang,
)


def test_clean_keyword_strips_quotes_and_brackets():
    assert _clean_keyword('  "OpenAI"  ') == "OpenAI"
    assert _clean_keyword("[GPT-5]") == "GPT-5"
    assert _clean_keyword("「推論モデル」") == "推論モデル"


def test_clean_keyword_collapses_internal_whitespace():
    assert _clean_keyword("multi   word   phrase") == "multi word phrase"


def test_clean_keyword_returns_none_on_empty():
    assert _clean_keyword("") is None
    assert _clean_keyword("    ") is None
    assert _clean_keyword('""') is None


def test_clean_keyword_returns_none_when_too_long():
    assert _clean_keyword("a" * (_KEYWORD_MAX_LEN + 1)) is None
    assert _clean_keyword("a" * _KEYWORD_MAX_LEN) == "a" * _KEYWORD_MAX_LEN


def test_matches_source_lang_en_rejects_non_latin():
    assert _matches_source_lang("OpenAI", "en")
    assert not _matches_source_lang("오픈에이아이", "en")
    assert not _matches_source_lang("オープン", "en")


def test_matches_source_lang_ko_rejects_kana_allows_hangul():
    assert _matches_source_lang("오픈AI", "ko")
    assert not _matches_source_lang("オープン", "ko")


def test_matches_source_lang_ja_rejects_hangul_allows_kana():
    assert _matches_source_lang("オープンAI", "ja")
    assert not _matches_source_lang("오픈", "ja")


def test_matches_source_lang_unknown_lang_allows_everything():
    assert _matches_source_lang("anything 한글 かな", "zz")


def test_coerce_json_extracts_object_from_surrounding_noise():
    assert _coerce_json('prefix {"keywords": []} suffix') == {"keywords": []}


def test_coerce_json_handles_multiline():
    raw = 'noise\n{\n  "keywords": [{"keyword": "AI", "score": 5}]\n}\ntail'
    assert _coerce_json(raw) == {"keywords": [{"keyword": "AI", "score": 5}]}


def test_coerce_json_raises_without_json():
    with pytest.raises(ValueError):
        _coerce_json("no json here at all")
