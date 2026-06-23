# Qiita (ai + llm)

## fetch
- list endpoint(s):
  - `https://qiita.com/api/v2/items?query=tag:ai+stocks:>50&per_page=3` — HTTP 200, `application/json; charset=utf-8`
  - llm: `https://qiita.com/api/v2/items?query=tag:llm+stocks:>50&per_page=3`
  - NOTE: the originally-specified `likes_count:>50` operator is **not honored** (see gotchas) — use `stocks:>50` (or `stocks:>N`) to actually filter by popularity, then post-filter on `likes_count` if a likes threshold is required.
- item/body endpoint: **none needed** — the list response already includes full body. (Single item also available at `https://qiita.com/api/v2/items/{id}` if desired.)
- auth/headers needed: none for public read. Unauthenticated rate limit = 60 req/h per IP. Optional `Authorization: Bearer <token>` raises it to 1000 req/h.
- rate limit: observed response headers — `Rate-Limit: 60`, `Rate-Remaining: 58` (decrements per call), `Rate-Reset: <epoch>`. Read these to back off.
- JS rendering needed?: no. Pure JSON API.

## list parsing
- format: **json** (top-level array of item objects)
- per-item fields → mapping:
  - title = `title`
  - url = `url`
  - published_at = `created_at` (ISO8601 +09:00, e.g. `2026-03-25T13:17:14+09:00`)
  - author = `user.id`
  - summary = none (derive from `body`/`rendered_body` if needed)
  - extra(likes etc) = `likes_count`, `stocks_count`, `reactions_count`, `comments_count`, `page_views_count`, `tags`, `id`, `updated_at`
- exact JSON paths: array root → `items[i].title`, `items[i].url`, `items[i].created_at`, `items[i].likes_count`, `items[i].user.id`, `items[i].tags[].name`, `items[i].id`.

## body parsing
- where full text lives: in the SAME list item — **`rendered_body`** (full HTML) and **`body`** (full Markdown source). No second request needed.
- HTML or markdown: both available. `rendered_body` = HTML (Qiita-rendered, e.g. `<div class="code-frame" data-lang="markdown">…`); `body` = raw Markdown.
- example excerpt (first ~200 chars of real fetched `body`, ai tag top item):
  ` ```markdown\n---\ntitle: 【やってみた】Claude Codeに『自分のQiita記事を分析させて次のバズ記事を提案させる』自動パイプラインを組んだ\ntags:\n  - ClaudeCode\n  - QiitaAPI\n  - AI\n…`

## gotchas
- **`likes_count:>50` is silently ignored** by Qiita search: queries with it returned `likes_count: 0` items (URL-encoded or not). Use **`stocks:>50`** as the effective popularity filter (verified: returns items with 52–100 likes / 54–88 stocks), then optionally post-filter on `likes_count` client-side. Treat the prompt's `likes_count:>50` as the *intent*, `stocks:>N` as the working implementation.
- **dedup ai vs llm**: same article can carry both `ai` and `llm` tags → dedup across the two queries by `id` (or `url`).
- **rate limit 60/h unauthenticated** — watch `Rate-Remaining`/`Rate-Reset` headers; add a token for 1000/h if crawling frequently.
- `created_at` is `+09:00` (JST); normalize to UTC.
- `rendered_body` is pre-rendered HTML — sanitize before injecting into the DOM.
- `+` in the query string is the space/AND separator; encode the operator value carefully (`tag:llm+stocks:>50`). `>` works both raw and percent-encoded.
