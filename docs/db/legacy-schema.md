# Legacy DB 구조 (drizzle pull, MySQL)

> 2026-06-23 `drizzle-kit pull` introspection 결과. 원본: `drizzle/schema.ts`, `drizzle/relations.ts`, `drizzle/0000_*.sql`.
> 9 tables / 57 columns / 7 FK. **기존 데이터를 완전 지원**하고, 신규 요구사항에 필요한 컬럼만 추가한다.

## 테이블 요약

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|-----------|
| `sources` | 크롤 대상 소스 | id, kind(`keyword`/`web`), value(URL/tag), stage(`candidate`/`active`/`demoted`), lang, promoted_at, last_used_at |
| `articles` | 수집 기사 | id, source_id→sources, url(uniq), lang(ko/ja/en), title_original, content_original(mediumtext), published_at, fetched_at, **keywords_extracted_at**, **title_translated_ko**, **content_translated_ko**, translated_at |
| `keywords_extracted` | 기사 키워드 | id, article_id→articles(cascade), keyword(191), score(int) |
| `reports` | 일일/주간 리포트 | id, kind(`daily`/`weekly`), lang, period_start(date), period_end(date), title, markdown(mediumtext), title_translated_ko, markdown_translated_ko / uniq(kind,period,lang) |
| `report_items` | 리포트↔기사 | id, report_id→reports(cascade), article_id→articles, rank(int) |
| `users` | 유저 | id(varchar36), username(uniq 64) |
| `sessions` | 세션 | id(varchar64), user_id→users(cascade), expires_at |
| `favorites` | 북마크 | id, user_id→users(cascade), target_type(`article`/`report`), target_id / uniq(user,type,target) |
| `source_stats` | 소스 성과 | id, source_id→sources(cascade), date, hit_count, adoption_count / uniq(source,date) |

## 이미 지원되는 요구사항 (변경 불필요)

- **번역 파이프라인**: `articles.title_translated_ko`/`content_translated_ko`/`translated_at`, `reports.*_translated_ko`. (gpt-5.5 번역 결과 저장처)
- **키워드 추출**: `keywords_extracted` + `articles.keywords_extracted_at`(처리 여부 플래그). (gpt-5.4-mini 결과)
- **리포트(일일/주간)**: `reports`(daily/weekly) + `report_items`(rank). FE 리포트 탭.
- **북마크 로그인**: `users`(username only) + `sessions` + `favorites`(article/report). FE 북마크.
- **소스 자동 승격**: `sources.stage`(candidate→active→demoted) + `source_stats`(hit/adoption). 운영 메커니즘 그대로 사용.
- **dedup**: `articles.uniq_url`. (Zenn ai/llm 중복 등)
- **증분 처리 인덱스**: idx_keywords_extracted, idx_lang_published 등.

## ⚠️ 신규 요구사항에 필요한 추가 (마이그레이션 예정)

1. **`sources.vendor`** — nullable enum `('openai','anthropic','google','meta','naver','kakao')`.
   - FE "기업" 탭 = vendor 소스의 기사. vendor 가 null 이면 일반 "기사" 탭.
   - `google` = DeepMind + Google Research 2소스. `meta` = 보류(피드 확정 후 활성).
   - 인덱스 `idx_vendor` 추가.
   - **기존 sources.kind(`keyword`/`web`)은 fetch 방식 구분이라 유지.** vendor 와 직교.

2. **`reports.vendor`** — nullable enum `('openai','anthropic','google','meta','naver','kakao')`.
   - **vendor 전용 리포트**(기업 탭 사이드바 일일/주간) vs **일반 리포트**(리포트 탭)를 분리.
   - `vendor IS NULL` = 리포트 탭(일반). `vendor = X` = 기업 탭 X 의 일일/주간 리포트.
   - 인덱스 `idx_vendor_kind`(vendor, kind) 추가.

> fetch 전략(feed-full/api/feed+article 등)·셀렉터는 **DB 가 아니라 코드 provider 레지스트리**에 둔다 (소스별 로직). `sources.value` 는 feed URL/tag 만 보관.

## 탭 ↔ 쿼리 매핑 (확정 2026-06-23)

| FE 탭 | 데이터 | 필터 |
|-------|--------|------|
| 리포트 | `reports` | `vendor IS NULL` (일반) |
| 기사 | `articles` JOIN `sources` | `sources.vendor IS NULL` (vendor 기사 제외) |
| 기업 / 벤더 X | `articles` JOIN `sources` | `sources.vendor = X` |
| 기업 / 일일·주간 리포트 | `reports` | `vendor = X` (기업 탭 진입 vendor) |

- 일반 탭(기사/리포트)과 기업 탭은 **데이터가 완전히 분리**(vendor null 여부로). 중복 없음.
- 기존 운영 데이터 보존 → 컬럼 추가는 `ALTER TABLE ... ADD COLUMN`(nullable, default NULL) 무중단 마이그레이션. 기존 행은 vendor=NULL.
