# Anthropic (vendor=anthropic)

## fetch
- list feed: https://raw.githubusercontent.com/tim-hilde/anthropic-rss/main/docs/rss.xml — status 200, format RSS 2.0 served as `text/plain` from raw.githubusercontent.com (~217 KB, **20 items**). 3rd-party scraper mirror of claude.com/blog.
- body source: **FULL content is inside the feed** — no separate article fetch needed (see below).
- JS rendering needed?: **no** — body is embedded in each item's `<description>` as escaped HTML.

## list parsing
- per-item fields → mapping:
  - title ← `<title>` (plain, NOT CDATA)
  - url ← `<link>` → points to canonical https://claude.com/blog/<slug>
  - published_at ← `<pubDate>` (RFC-822 with +0000, e.g. `Thu, 18 Jun 2026 00:00:00 +0000`; time is always 00:00:00 — date only)
  - author ← **none** (no `<author>`/`<dc:creator>`) → fixed "Anthropic"
  - summary ← derive by stripping HTML from `<description>` (no separate short summary field)
- exact tag names: `title`, `link`, `description`, `pubDate`. Channel has `<lastBuildDate>`.
- NOTE: feed uses `<description>` for full content, NOT `content:encoded` (no `content:encoded` tag present).

## body parsing
- full text location: `<description>` — contains the **entire post body** as HTML-entity-escaped markup (`&lt;div class="u-rich-text-blog..."&gt;...`). Unescape entities, then parse/strip to text. The wrapper is `<div class="u-rich-text-blog u-margin-trim w-richtext">` (Webflow rich text from claude.com).
- example excerpt (~200 chars real): "Starting today, Claude Code can capture work progress as an artifact, which turn Claude Code's work into live, shareable visual pages— including PR walkthroughs, system explainers, dashboards, and release checklists—that update themselves as your session works."
- measured body length: full HTML in `<description>` is multi-KB per item (the artifacts post's description alone is >2 KB of HTML before the truncation point inspected). Full content present — no truncation observed.

## gotchas
- **MIRROR FRESHNESS — FRESH.** Newest item: "Claude Code now supports artifacts", pubDate **Thu, 18 Jun 2026** (5 days before today 2026-06-23). Channel `<lastBuildDate>`: **Mon, 22 Jun 2026 11:43:27 +0000** (yesterday) — the scraper ran recently. Mirror is alive and actively updating. Only 20 items retained (rolling window) — crawl frequently or you'll miss posts that roll off.
- This is a **3rd-party mirror** (tim-hilde/anthropic-rss): single point of failure. Add a staleness alert — if `lastBuildDate` falls more than ~5–7 days behind `now`, alert (mirror may have died). claude.com/blog has no official RSS, hence the dependency.
- vendor mapping: vendor=anthropic (company-news tab).
- No author field — hardcode "Anthropic". Body HTML is Webflow markup (figures/iframes for YouTube embeds) — sanitize on render.
