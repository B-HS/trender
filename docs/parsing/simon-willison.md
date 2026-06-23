# Simon Willison

## fetch
- list feed: https://simonwillison.net/atom/everything/ — HTTP 200, Atom 1.0 (XML, 132,758 bytes)
- body source: feed `<summary type="html">` (this feed has NO `<content>` tag — the full HTML body lives in `<summary>`)
- JS rendering needed?: no

## list parsing
- per-item fields → mapping:
  - title → `<entry><title>` (plain text)
  - url → `<entry><link href="...">` (the `href` attribute, e.g. ends with `#atom-everything`; strip the fragment for canonical URL)
  - published_at → `<entry><published>` (ISO 8601, e.g. `2026-06-22T23:59:53+00:00`); `<updated>` also present
  - author → no per-entry author; use feed-level `<feed><author><name>` = `Simon Willison`
  - summary → derive from `<summary>` HTML (strip tags / take first N chars)
- exact tag names: `entry`, `title`, `link[@href]`, `published`, `updated`, `id`, `summary`, `category`

## body parsing
- full text in feed?: yes
- field name: `<summary type="html">` (full article HTML, CDATA-free, HTML-entity-encoded)
- measured body length: 30 entries; min 484 / median ~2,000 / max 21,430 chars. First entry summary = 3,479 chars.
- example excerpt (~200 chars real):
  ```
  Prompt Injection as Role Confusion
  First, I absolutely love this:
  This is a blog-style writeup of the p...
  ```

## gotchas
- Atom format: full body is in `<summary>`, NOT `<content>` — do not look for `content:encoded` (RSS) or `<content>` (Atom), both absent here.
- `<link>` value lives in the `href` attribute, not element text. It carries an `#atom-everything` fragment.
- No per-entry author element → fall back to the single feed-level `<author>`.
- HTML inside `<summary>` is entity-encoded (e.g. `&lt;p&gt;`), needs unescaping before rendering/stripping.
- Short link-blog entries (~500 chars) are legitimately short, not truncated.
