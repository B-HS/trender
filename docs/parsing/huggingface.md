# HuggingFace (vendor=none)

## fetch
- list feed: https://huggingface.co/blog/feed.xml — status 200, format RSS 2.0 (`application/rss+xml`, ~231 KB, **804 items**).
- body source: article URL from `<link>`, e.g. https://huggingface.co/blog/PaddlePaddle/pp-ocrv6 (served via CloudFront).
- JS rendering needed?: **no** — article body is present in the static HTML (200, ~162 KB, contains `div.blog-content`). No `__NEXT_DATA__`; 1 JSON-LD block present.

## list parsing
- per-item fields → mapping:
  - title ← `<title>` (plain)
  - url ← `<link>` (also `<guid isPermaLink="false">`, same value)
  - published_at ← `<pubDate>` (RFC-822 GMT, e.g. `Mon, 22 Jun 2026 13:18:56 GMT`)
  - author ← **not a dedicated field**; derive from the URL path segment (e.g. `/blog/PaddlePaddle/pp-ocrv6` → org/user "PaddlePaddle"). No `<author>`/`<dc:creator>`.
  - summary ← **none in feed** (no `<description>`); take from body or JSON-LD if needed.
- exact tag names per item: `title`, `pubDate`, `link`, `guid`. (Minimal feed — no description/category.)

## body parsing
- full text location: CSS selector **`div.blog-content`** (full class: `blog-content copiable-code-container ... prose mx-auto mb-8 ...`). This is the Tailwind `prose` article container. Strip nav/"Back to Articles".
- example excerpt (~200 chars real): "PP-OCRv6 on Hugging Face: 50-Language OCR from 1.5M to 34.5M Parameters" then the article intro (title + body rendered inside `div.blog-content`).
- measured body length: ~7,676 chars of text extracted from the `blog-content` segment (static curl, no JS).

## gotchas
- CloudFront-fronted but **not bot-blocked** for this UA (unlike OpenAI) — static fetch works.
- vendor mapping: **vendor=none** (community blog, not a single company tab). Author is the posting org/user from the URL path, not HF itself.
- No `<description>` and no author tag in feed — selector `div.blog-content` is the reliable text source; fall back to JSON-LD for summary if required.
