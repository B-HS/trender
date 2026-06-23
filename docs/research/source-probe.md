# 소스 실측 + API 채택 검토 (2026-06)

## 1. 현재 크롤링 소스
- `collect_all`은 `kind="web"` RSS 9개만 수집. 키워드 소스 10개는 미사용(DB 저장만).
- RSS 본문 < 800자면 기사 원문 페이지를 추가 fetch(`fetch_article_body`).

## 2. Anthropic 교체 (원본 피드 404)
| 후보 | 결과 | 채택 |
|------|------|:---:|
| `raw.githubusercontent.com/tim-hilde/anthropic-rss/main/docs/rss.xml` | 200, 20건, **전문 4976자**, 최신 | ✅ |
| `taobojlen/anthropic-rss-feed` | 200, 13건, snippet 92자, stale | ❌ |
→ tim-hilde 채택(전문 → 기사 페치 불필요). 비공식 GitHub raw라 죽으면 알림.

## 3. 추가 소스 실측 (httpx+feedparser)
| 소스 | lang | 본문 | 판정 |
|------|----|------|------|
| Simon Willison `simonwillison.net/atom/everything/` | en | 전문 2233 | ✅ 강추(페치불필요) |
| Raschka `magazine.sebastianraschka.com/feed` | en | 전문 8027 | ✅ 강추 |
| MarkTechPost `www.marktechpost.com/feed/` | en | 전문 6613 | ✅ 강추 |
| DeepMind `deepmind.google/blog/rss.xml` | en | snippet, 100건 | ✅ |
| Google Research `research.google/blog/rss/` | en | snippet | ✅ |
| ITmedia AI+ `rss.itmedia.co.jp/rss/2.0/aiplus.xml` | ja | snippet | ✅ |
| aitimes.kr `www.aitimes.kr/rss/allArticle.xml` | ko | snippet, 50건 | ✅ (aitimes.com과 별개) |
| 요즘IT `yozm.wishket.com/magazine/feed/` | ko | snippet, 날짜파싱 실패 | ⚠️ |
| Publickey `www.publickey1.jp/atom.xml` | ja | snippet | ⚠️ 일반 개발뉴스 |
| はてブ 인기 IT `b.hatena.ne.jp/hotentry/it.rss` | ja | snippet, 외부링크 집계 | ⚠️ |
| KakaoTech `tech.kakao.com/feed/` | ko | snippet, **Nuxt SPA(본문 얇음)** | ⚠️ |
| Meta AI `ai.meta.com/blog/rss/` | en | **404** | 공식 RSS 없음 → RSSHub/스크래퍼/sitemap |
| arXiv `export.arxiv.org/rss/cs.CL` | en | **0건(구 URL 폐기)** | 제외(사용자) |

## 4. 기사 추출 (정적 HTML, 브라우저 없음)
trafilatura로 9곳 중 8곳 전문 추출: OpenAI 11726 · GoogleResearch 7601 · YozmIT 6263 · Anthropic(claude.com) 5527 · DeepMind 5051 · aitimes.kr 2696 · Publickey 1433 · ITmedia 1390. **KakaoTech만 244(Nuxt SPA, JSON-LD articleBody 비어있음)** → 얇게 남음(허용).

## 5. API 채택 검토 (원칙: API 가능하면 API, 단 403 먼저 테스트)
| API | 403 테스트 | 본문 | rate | 채택 |
|-----|:---:|------|------|:---:|
| **Qiita API v2** `/api/v2/items?query=tag:ai likes_count:>N` | 200(거부 없음) | `body` 전문 6174 | anon 60/hr · 토큰 1000/hr | ✅ RSS 폐기 |
| **Zenn API** `/api/articles?topicname=ai` → `/api/articles/{slug}` | 200 | `body_html` 6696 | - | ✅(비공식, RSS fallback 유지) |
| **GeekNews** `/topic/{id}.md` / RSS | 200 | 전문+댓글 | - | ✅ |
- Qiita `likes_count:>N` 필터 문법은 구현 시 정확 확인(테스트에서 likes=0 결과 반환됨 — 인코딩/문법 점검 필요).
- dedup은 이미 `insert_article_if_new`(INSERT IGNORE + `UNIQUE(url)`)로 url 기준 처리됨 → Zenn/Qiita ai+llm 중복 자동 collapse.

## 스크립트
scratchpad: `probe_feeds.py`(피드 실측), `extract_check.py`(추출 길이), `api_probe.py`(API 403).
