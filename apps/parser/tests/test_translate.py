from trender.pipeline.translate import _strip_fence


def test_plain_text_is_unchanged():
    assert _strip_fence("<p>안녕하세요</p>") == "<p>안녕하세요</p>"


def test_removes_html_language_fence():
    assert _strip_fence("```html\n<p>x</p>\n```") == "<p>x</p>"


def test_removes_bare_fence():
    assert _strip_fence("```\n<p>x</p>\n```") == "<p>x</p>"


def test_trims_surrounding_whitespace():
    assert _strip_fence("   <p>x</p>   ") == "<p>x</p>"


def test_removes_only_opening_fence():
    assert _strip_fence("```html\n<p>x</p>") == "<p>x</p>"


def test_removes_only_closing_fence():
    assert _strip_fence("<p>x</p>\n```") == "<p>x</p>"


def test_preserves_inner_fence_not_at_edges():
    s = "<p>코드: ```py``` 예시</p>"
    assert _strip_fence(s) == s


def test_empty_and_whitespace_only():
    assert _strip_fence("") == ""
    assert _strip_fence("   ") == ""
