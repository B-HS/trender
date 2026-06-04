from datetime import datetime

from trender.db.models import Article


def test_article_translation_fields_default_to_none():
    a = Article(source_id=1, url="https://example.com/1", lang="ja", title_original="t")
    assert a.title_translated_ko is None
    assert a.content_translated_ko is None
    assert a.translated_at is None


def test_article_accepts_translation_fields():
    a = Article(
        source_id=1,
        url="https://example.com/1",
        lang="en",
        title_original="t",
        title_translated_ko="제목",
        content_translated_ko="<p>본문</p>",
        translated_at=datetime(2026, 6, 4, 1, 0, 0),
    )
    assert a.title_translated_ko == "제목"
    assert a.content_translated_ko == "<p>본문</p>"
    assert a.translated_at == datetime(2026, 6, 4, 1, 0, 0)
