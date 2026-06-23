# MarkTechPost

## fetch
- list feed: https://www.marktechpost.com/feed/ — HTTP 200, RSS 2.0 (WordPress, XML, 371,024 bytes)
- body source: feed `<content:encoded>` (CDATA full HTML)
- JS rendering needed?: no

## list parsing
- per-item fields → mapping:
  - title → `<item><title>` (plain text)
  - url → `<item><link>` (element text, e.g. `https://www.marktechpost.com/2026/06/22/...`)
  - published_at → `<item><pubDate>` (RFC 822, e.g. `Mon, 22 Jun 2026 20:34:48 +0000`)
  - author → `<item><dc:creator>` = e.g. `Michal Sutter`
  - summary → `<item><description>` (CDATA, real short excerpt ~500–950 chars — usable as summary)
- exact tag names: `item`, `title`, `link`, `pubDate`, `dc:creator`, `description`, `content:encoded`, `category`, `guid`

## body parsing
- full text in feed?: yes (full body in `content:encoded`; `description` holds a separate short excerpt — NOT excerpt-only feed)
- field name: `<content:encoded>` (CDATA HTML)
- measured body length: 10 items, full bodies ~26k–52k chars (item 0 = 41,165; item 5 = 52,389; smallest 26,635). `description` excerpts are 500–950 chars.
- example excerpt (~200 chars real):
  ```
  xAI shipped a new mode called /goal inside Grok Build, its terminal coding agent. The feature
  targets long-running, autonomous task execution. You hand the agent a larger implementation task,
  then ste...
  ```

## gotchas
- **WordPress excerpt-vs-full**: both fields exist — `description` is a short manual excerpt, `content:encoded` is the FULL post. Use `content:encoded` for body; do not mistake `description` for the body.
- No `[…]` / `Continue reading` truncation marker found in `content:encoded` across all 10 items → full text confirmed, no per-article body fetch needed.
- Both fields CDATA-wrapped; strip `<![CDATA[ ]]>`.
- `content:encoded` includes promotional/footer HTML (newsletter CTAs) typical of WordPress — strip boilerplate if needed.
