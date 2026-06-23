# 소스 목록 (Crawling Targets)

> `kind=web`(일반 기사) / `kind=vendor`(기업 소식 탭). vendor 가 채워진 행은 기업 탭에서 별도 집계.

## 웹 소스 (kind=web)

| 소스 | feed/endpoint | lang | vendor | fetch | 비고 |
|------|---------------|------|--------|-------|------|
| Zenn (ai) | `https://zenn.dev/topics/ai/feed` | ja | | rss(+api 옵션) | API: `/api/articles?topicname=ai`→`/api/articles/{slug}` body_html (403 없음). |
| Zenn (llm) | `https://zenn.dev/topics/llm/feed` | ja | | rss(+api 옵션) | ai/llm 중복은 url dedup. |
| Qiita (ai) | API v2 `https://qiita.com/api/v2/items?query=tag:ai stocks:>N` | ja | | api | ⚠️ `likes_count:>N` 무효 → **`stocks:>N`** 사용. `rendered_body`/`body` 전문 inline. anon 60/hr·토큰 1000/hr. RSS 폐기. |
| Qiita (llm) | API v2 `query=tag:llm stocks:>N` | ja | | api | 〃 |
| GeekNews(긱뉴스) | `https://news.hada.io/rss/news` | ko | | rss(+`.md`) | 본문은 `/topic/{id}.md`(전문+댓글). 외부링크라 기사 도메인 다양. |
| AI타임스 | `https://www.aitimes.com/rss/allArticle.xml` | ko | | rss+article | CF 아님. |
| OpenAI | `https://openai.com/news/rss.xml` | en | openai | rss+article | ⚠️ 본문 기사 **CF 403**(로컬 검증 환경). 피드 정상. Vercel egress 통과 여부 확인 필요 → 실패 시 description fallback. |
| Anthropic | `https://raw.githubusercontent.com/tim-hilde/anthropic-rss/main/docs/rss.xml` | en | anthropic | full | 원본 `/news/rss.xml` 404 → tim-hilde 스크래퍼(claude.com/blog, 전문). 죽으면 알림. |
| HuggingFace | `https://huggingface.co/blog/feed.xml` | en | | rss+article | CloudFront. |
| DeepMind | `https://deepmind.google/blog/rss.xml` | en | google | rss+article | Google Frontend. |
| Google Research | `https://research.google/blog/rss/` | en | google | rss+article | google 벤더 = DeepMind+Research 두 소스 묶음. |
| Meta AI | ⚠️ 미확정 (보류) | en | meta | TBD | 공식 RSS 없음. provider stub 만 두고 피드 확정 후 추가. |
| Simon Willison | `https://simonwillison.net/atom/everything/` | en | | full | 전문 2233, 최신. |
| Raschka (Ahead of AI) | `https://magazine.sebastianraschka.com/feed` | en | | full | 전문 8027(Substack). |
| MarkTechPost | `https://www.marktechpost.com/feed/` | en | | full | 전문 6613. |
| ITmedia AI+ | `https://rss.itmedia.co.jp/rss/2.0/aiplus.xml` | ja | | rss+article | |
| Publickey | `https://www.publickey1.jp/atom.xml` | ja | | rss+article | 일반 개발뉴스(약간 노이즈). |
| はてブ 인기 IT | `https://b.hatena.ne.jp/hotentry/it.rss` | ja | | rss+article | 외부링크 집계 → 기사 임의 도메인(간헐 CF차단 시 스킵). AI비전용 노이즈. |
| 요즘IT | `https://yozm.wishket.com/magazine/feed/` | ko | | rss+article | 날짜 파싱 실패 시 published_at→fetched_at fallback. |
| KakaoTech | `https://tech.kakao.com/feed/` | ko | kakao | rss+article | Nuxt SPA — 본문 얇음(244자). JSON-LD articleBody 비어있음. 추후 카카오 내부 API 보강 옵션. |
| Naver D2 | `https://d2.naver.com/d2.atom` | ko | naver | rss+article | 신규. 일반 테크블로그. |

## 벤더 → 소스 매핑 (기업 소식 탭)

| vendor | 소스 |
|--------|------|
| openai | OpenAI News |
| anthropic | Anthropic(tim-hilde) |
| google | DeepMind + Google Research |
| meta | Meta AI (피드 확정 후) |
| naver | Naver D2 |
| kakao | KakaoTech |

## fetch 전략 약어

- `rss`: 피드만으로 충분 (목록 + 요약/본문)
- `api`: 전용 JSON API (Zenn/Qiita)
- `full`: 피드에 전문(content:encoded) 포함 → 본문 추가 fetch 불필요
- `rss+article`: 피드는 목록/요약, 본문은 기사 URL 재fetch 후 추출
- `+.md`: GeekNews `/topic/{id}.md`
