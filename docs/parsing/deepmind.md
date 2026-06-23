# DeepMind (vendor=google)

## fetch
- list feed: https://deepmind.google/blog/rss.xml — status 200, format RSS 2.0 (`text/xml`, ~77 KB, **100 items**).
- body source: article URL from `<link>`, e.g. https://deepmind.google/blog/unlocking-uk-house-building-with-ai-accelerated-planning/
- JS rendering needed?: **no** — article body is in the static HTML (200, ~145 KB, contains `div.rich-text`). No `__NEXT_DATA__`; 2 JSON-LD blocks.

## list parsing
- per-item fields → mapping:
  - title ← `<title>`
  - url ← `<link>` (also `<guid>`, same)
  - published_at ← `<pubDate>` (RFC-822 +0000, e.g. `Tue, 16 Jun 2026 21:29:50 +0000`)
  - author ← **none** (no `<author>`/`<dc:creator>`) → fixed "Google DeepMind"
  - summary ← `<description>` (1-sentence blurb, e.g. "UK government partners with Google DeepMind to build a new AI-powered prototype...")
- extra: `<media:thumbnail url=...>` and `<media:content medium="image" url=...>` for hero image.
- exact tag names: `title`, `link`, `guid`, `description`, `pubDate`, `media:thumbnail`, `media:content`

## body parsing
- full text location: CSS selector **`div.rich-text`** (rendered in source as `<div class=rich-text>`, unquoted attribute). This is the article body container.
- example excerpt (~200 chars real): "New UK government AI planning prototype built with Gemini aims to halve the time it takes to process homeowner applications. Around the world, Governments are exploring how AI can deliver better public services..."
- measured body length: ~6,621 chars of text extracted from the `rich-text` segment (static curl, no JS).

## gotchas
- `rich-text` attribute is unquoted in raw HTML (`<div class=rich-text>`) — match `class~="rich-text"` loosely, not an exact-quote selector.
- vendor mapping: **vendor=google** (DeepMind grouped under Google company-news tab).
- No author tag — hardcode "Google DeepMind". Static fetch works (not bot-blocked).
