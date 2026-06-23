# Google Research (vendor=google)

## fetch
- list feed: https://research.google/blog/rss/ — status 200, format RSS 2.0 (`application/rss+xml`, ~76 KB, **100 items**).
- body source: article URL from `<link>`, e.g. https://research.google/blog/from-pixels-to-planning-earth-ai-for-nature-restoration/
- JS rendering needed?: **no** — article body is in the static HTML (200, ~165 KB, contains `div.rich-text`). No `__NEXT_DATA__`; no JSON-LD.

## list parsing
- per-item fields → mapping:
  - title ← `<title>`
  - url ← `<link>` (also `<guid>`, same)
  - published_at ← `<pubDate>` (RFC-822 +0000, e.g. `Tue, 16 Jun 2026 17:30:00 +0000`)
  - author ← **none** (no `<author>`/`<dc:creator>`) → fixed "Google Research"
  - summary ← `<description>` — NOTE: here `<description>` is just the **primary category label** (e.g. "Climate & Sustainability"), NOT a real blurb. Use the body intro for summary instead.
  - categories ← multiple `<category>` tags (e.g. Climate & Sustainability, Earth AI, Machine Intelligence, Open Source Models & Datasets)
- extra: `<media:thumbnail>`, `<media:content medium="image">` for hero image.
- exact tag names: `title`, `link`, `guid`, `description`, `pubDate`, `category` (repeated), `media:thumbnail`, `media:content`

## body parsing
- full text location: CSS selector **`div.rich-text`** (full: `<div class="rich-text --theme-light --mode-standalone" data-gt-id="rich_text">`). Article body container.
- example excerpt (~200 chars real): "Forests are more than just clusters of trees; they are critical systems that sequester carbon, filter water, and support the biodiversity..."
- measured body length: ~8,623 chars of text extracted from the `rich-text` segment (static curl, no JS).

## gotchas
- `<description>` is a **category label, not a summary** — do not use it as the article summary; derive summary from `div.rich-text` intro.
- vendor mapping: **vendor=google** (Google Research grouped under Google company-news tab, alongside DeepMind).
- No author tag — hardcode "Google Research". Static fetch works (not bot-blocked). Selector `div.rich-text` is shared with DeepMind (same Google site template).
