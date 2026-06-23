# Zenn (ai + llm)

## fetch
- list endpoint(s):
  - RSS `https://zenn.dev/topics/ai/feed` — HTTP 200, `text/xml; charset=utf-8` (llm: `https://zenn.dev/topics/llm/feed`)
  - JSON `https://zenn.dev/api/articles?topicname=ai&order=latest` — HTTP 200, `application/json; charset=utf-8` (llm: `topicname=llm`)
- item/body endpoint: `https://zenn.dev/api/articles/{slug}` — HTTP 200, `application/json`. (`slug` = list item's `slug`; equivalently the last path segment of `path`)
- auth/headers needed: none (public). A normal UA is enough; no token.
- rate limit: none observed / not documented (no rate headers returned). Crawl politely.
- JS rendering needed?: no. RSS and both JSON APIs are server-rendered/static; full body comes from the single-article JSON API.

## list parsing
- format: **json** (recommended) or rss xml. Use JSON — RSS `<description>` is a truncated plain-text preview only (no `content:encoded`).
- per-item fields → mapping (JSON `articles[]`):
  - title = `title`
  - url = `"https://zenn.dev" + path` (or `https://zenn.dev/{user.username}/articles/{slug}`)
  - published_at = `published_at` (ISO8601 +09:00, e.g. `2026-06-23T13:52:46.072+09:00`)
  - author = `user.username` (display: `user.name`)
  - summary = none in list JSON (use RSS `description` if a preview is needed)
  - extra = `liked_count`, `bookmarked_count`, `comments_count`, `body_letters_count`, `emoji`, `article_type`, `slug`, `id`
- exact JSON paths: root `{ articles: [...], next_page, total_count }`. Per item: `articles[i].title`, `articles[i].path`, `articles[i].slug`, `articles[i].published_at`, `articles[i].user.username`, `articles[i].liked_count`.
- (rss alternative) exact tags: `<item>` with `<title>` (CDATA), `<link>`, `<guid>`, `<pubDate>` (RFC822 GMT), `<description>` (CDATA, truncated). No `<content:encoded>`.

## body parsing
- where full text lives: single-article JSON API field **`article.body_html`** (the list JSON has NO body field). RSS does not carry full body.
- HTML or markdown: **HTML** (`body_html`). Other useful fields on the single article: `og_image_url`, `topics`, `toc`, `body_letters_count`.
- example excerpt (first ~200 chars of real fetched `article.body_html`, slug `llm-agent-eval-trajectory`):
  `<p data-line="0" class="code-line">AIエージェント（ツールを使い、複数ステップで動くLLM）の評価を、<strong>最終的にタスクができたか（成否）だけ</strong>で<br>見ていませんか。それは必要ですが<strong>不十分</strong>です。…`

## gotchas
- **2-step fetch required**: list JSON/RSS has no body → must call `/api/articles/{slug}` per item for `body_html`.
- **dedup ai vs llm**: the two topic lists overlap heavily (observed 11/48 identical articles between `topicname=ai` and `topicname=llm`). Dedup by `path` (or full url / `id`) across both feeds before storing.
- RSS `description` is a lossy plain-text preview — do not treat as full body.
- `published_at` is `+09:00` (JST) with milliseconds; normalize to UTC.
- `body_html` is pre-rendered HTML (Zenn classes like `code-line`, `<br>`); sanitize before any `dangerouslySetInnerHTML` use.
- No likes filter on the API; filter client-side via `liked_count` if a popularity threshold is wanted.
