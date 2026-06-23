# Sebastian Raschka (Ahead of AI)

## fetch
- list feed: https://magazine.sebastianraschka.com/feed — HTTP 200, RSS 2.0 (Substack, XML, 2,323,508 bytes)
- body source: feed `<content:encoded>` (CDATA full HTML)
- JS rendering needed?: no

## list parsing
- per-item fields → mapping:
  - title → `<item><title>` (CDATA, plain text)
  - url → `<item><link>` (element text, e.g. `https://magazine.sebastianraschka.com/p/...`)
  - published_at → `<item><pubDate>` (RFC 822, e.g. `Sat, 06 Jun 2026 11:16:22 GMT`)
  - author → `<item><dc:creator>` = `Sebastian Raschka, PhD`
  - summary → `<item><description>` (very short, ~84 chars) OR strip-tags of `content:encoded`
- exact tag names: `item`, `title`, `link`, `pubDate`, `dc:creator`, `description`, `content:encoded`, `guid`

## body parsing
- full text in feed?: yes for FREE posts; PARTIAL (truncated) for PAID posts
- field name: `<content:encoded>` (CDATA HTML)
- measured body length: 20 items. Full free posts range ~11k–235k chars (item 5 = 235,374). Truncated paid posts are short: item 8 = 4,669, item 19 = 2,155.
- example excerpt (~200 chars real):
  ```
  LLM Research Papers: The 2026 List (January to May)As some of you know, I have the long-running
  habit of keeping a running list of research papers I want to read, revisit, or cite in future
  articles a...
  ```

## gotchas
- **Substack paywall truncation**: paid posts ship only a teaser in `content:encoded`, ending with a `Read more` link block (literal text `Read more` inside the trailing div). Detect via: small body length (~<6k) AND/OR the phrase `paid subscribers` / `Read more` tail marker. Observed truncated paid items in this fetch: index 8 (`LLM Research Papers: The 2025 List (July to December)`, 4,669) and index 19 (`First Look at Reasoning From Scratch: Chapter 1`, 2,155). Items 7 and 17 mention `paid subscribers` but still carry large bodies (free preview is long). Treat any item whose `content:encoded` tail contains the `Read more` block as truncated — body is NOT fully available and a paid login would be required (skip or flag).
- `<content:encoded>` is CDATA-wrapped; strip `<![CDATA[ ]]>` before parsing.
- `description` is too short to use as summary text; derive summary from stripped `content:encoded` instead.
