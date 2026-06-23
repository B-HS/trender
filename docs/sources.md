# SOURCES — 최종 소스 + 벤더 매핑 (구현 정본)

> Phase 3에서 이 표 그대로 시드. 근거 실측: `docs/research/source-probe.md`, `docs/research/cloudflare-audit.md`.
> `vendor` 컬럼: 비벤더=비움. fetch: `rss`(rss-parser) / `api`(공식 API) / `full`(RSS에 전문, 기사페치 불필요) / `rss+article`(snippet → 기사 원문 추출).
> dedup은 `insert_article_if_new`(INSERT IGNORE + `UNIQUE(url)`)가 url 기준 자동 처리.

## 웹 소스 (kind=web)

| 소스 | feed/endpoint | lang | vendor | fetch | 비고 |
|------|---------------|------|--------|-------|------|
| Zenn (ai) | `https://zenn.dev/topics/ai/feed` | ja | | rss(+api 옵션) | API: `/api/articles?topicname=ai`→`/api/articles/{slug}` body_html (403 없음). |
| Zenn (llm) | `https://zenn.dev/topics/llm/feed` | ja | | rss(+api 옵션) | ai/llm 중복은 url dedup. |
| **Qiita (ai)** | **API v2** `https://qiita.com/api/v2/items?query=tag:ai likes_count:>N` | ja | | **api** | `body` 전문 + `likes_count` 필터(노이즈). anon 60/hr·토큰 1000/hr. RSS 폐기. |
| **Qiita (llm)** | **API v2** `query=tag:llm likes_count:>N` | ja | | **api** | 〃 |
| GeekNews(긱뉴스) | `https://news.hada.io/rss/news` | ko | | rss(+`.md`) | 본문은 `/topic/{id}.md`(전문+댓글). 외부링크라 기사 도메인 다양. |
| AI타임스 | `https://www.aitimes.com/rss/allArticle.xml` | ko | | rss+article | CF 아님. |
| **OpenAI** | `https://openai.com/news/rss.xml` | en | **openai** | rss+article | 기사 정적 추출 11.7k(브라우저 불필요). |
| **Anthropic** | `https://raw.githubusercontent.com/tim-hilde/anthropic-rss/main/docs/rss.xml` | en | **anthropic** | full | 원본 `/news/rss.xml` 404 → tim-hilde 스크래퍼(claude.com/blog, 전문). 죽으면 알림. |
| HuggingFace | `https://huggingface.co/blog/feed.xml` | en | | rss+article | CloudFront. |
| **DeepMind** | `https://deepmind.google/blog/rss.xml` | en | **google** | rss+article | Google Frontend. |
| **Google Research** | `https://research.google/blog/rss/` | en | **google** | rss+article | google 벤더 = DeepMind+Research 두 소스 묶음. |
| **Meta AI** | ⚠️ **미확정** | en | **meta** | TBD | 공식 RSS 없음(`ai.meta.com/blog/rss/` 404). RSSHub 라우트/스크래퍼/sitemap 중 확정 필요. |
| Simon Willison | `https://simonwillison.net/atom/everything/` | en | | full | 전문 2233, 최신. |
| Raschka (Ahead of AI) | `https://magazine.sebastianraschka.com/feed` | en | | full | 전문 8027(Substack). |
| MarkTechPost | `https://www.marktechpost.com/feed/` | en | | full | 전문 6613. |
| ITmedia AI+ | `https://rss.itmedia.co.jp/rss/2.0/aiplus.xml` | ja | | rss+article | |
| Publickey | `https://www.publickey1.jp/atom.xml` | ja | | rss+article | 일반 개발뉴스(약간 노이즈). |
| はてブ 인기 IT | `https://b.hatena.ne.jp/hotentry/it.rss` | ja | | rss+article | 외부링크 집계 → 기사 임의 도메인(간헐 CF차단 시 스킵). AI비전용 노이즈. |
| 요즘IT | `https://yozm.wishket.com/magazine/feed/` | ko | | rss+article | 날짜 파싱 실패 시 published_at→fetched_at fallback. |
| **KakaoTech** | `https://tech.kakao.com/feed/` | ko | **kakao** | rss+article | **Nuxt SPA — 본문 얇음(244자)**. JSON-LD articleBody 비어있음. 추후 카카오 내부 API 보강 옵션. |
| **Naver D2** | `https://d2.naver.com/d2.atom` | ko | **naver** | rss+article | 신규(naver 벤더 소스). 일반 테크블로그. |

## 제외
- **arXiv** cs.CL — 사용자 제외(구 URL `export.arxiv.org/rss/cs.CL` 0건; 쓰려면 `https://rss.arxiv.org/rss/cs.CL` + 키워드필터 전제).

## 벤더 → 소스 매핑 (기업 소식 탭)
| vendor | 소스 |
|--------|------|
| openai | OpenAI News |
| anthropic | Anthropic(tim-hilde) |
| google | DeepMind + Google Research |
| meta | Meta AI (피드 확정 후) |
| naver | Naver D2 |
| kakao | KakaoTech |

## 키워드 소스 (kind=keyword) — 현재 미사용
`Claude, ChatGPT, GPT, LLM, RAG, 에이전트, agent, エージェント, MCP, Ollama` — DB 저장만, `collect_all`이 web만 수집. (향후 검색 확장용.)

## API 채택 원칙
가져올 수 있으면 API > RSS 스크랩(전문 확보 + 기사페치 제거). **단 붙이기 전 403/거부 실측**(현재 Qiita v2·Zenn·GeekNews 통과). Zenn/GeekNews도 API/`.md` 전환은 후속 옵션.
