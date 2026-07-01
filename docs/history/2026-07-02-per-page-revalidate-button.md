# 페이지별 수동 캐시 revalidate 버튼 (2026-07-02)

발단: 7월 1일 crawl/리포트 데이터가 DB엔 정상인데 사이트에 안 보인다는 의심 → DB 전수 확인 후 "노출 지연 = Next.js 캐시"로 결론. 각 페이지에서 fetch(데이터)/page 캐시를 즉시 purge하는 버튼을 추가했다.

---

## 1. DB 확인 (7월 1일, 서버시간 KST — `now()=07-02 06:33`, `utc_timestamp()=07-01 21:33`)

- **기사**: `fetched_at` 기준 **280건**(00:00~23:00), `published_at` 기준 **202건**. 정상 존재.
- **리포트**: `created_at` 07-01 08:02~08:08 사이 **7건**(id 751~757, 일반/openai/anthropic/google/naver + ja/en, 전부 `kind=daily`, period 06-29→06-30). 정상 존재.
- 결론: 데이터는 DB에 정상. 안 보였다면 **Next.js 캐시**가 원인.

## 2. 캐시 구조 (페이지별로 다름)

| 페이지 | 데이터 소스 | 캐시 계층 | 버튼 인자 |
|---|---|---|---|
| `/` (home) | `getLatestDailyReports`/`getDailyVendorReports` **직접 repo** | page ISR `revalidate=1800` | `path:'/'` |
| `/article` | `loadArticles` = `unstable_cache(tags:['articles'])` | data cache tag | `path:'/article'`, `tags:['articles']` |
| `/article/[id]` | `getArticle` 직접 | page ISR `revalidate=600` | `path:'/article/{id}'` |
| `/report` | `listReportsCached` = `unstable_cache(tags:['reports'])` | data cache tag | `path:'/report'`, `tags:['reports']` |
| `/report/[id]` | `getReport` 직접 | page ISR `revalidate=600` | `path:'/report/{id}'` |
| `/vendor/[vendor]` | `loadArticles` = `unstable_cache(tags:['articles'])` | data cache tag | `path:'/vendor/{vendor}'`, `tags:['articles']` |
| `/vendor/report/[kind]` | `listVendorReports` 직접 | page ISR `revalidate=1800` | `path:'/vendor/report/{kind}'` |
| `/bookmarks` | per-user | `force-dynamic`(캐시 없음) | **제외** |
| `/vendor` | redirect | — | **제외** |

리스트(`/article`·`/vendor/[vendor]`·`/report`)는 서버컴포넌트가 prefetch → HydrationBoundary → 클라이언트 react-query(`useInfiniteQuery`)의 `queryFn`이 **서버액션 `loadArticles`를 그대로 호출**한다. 즉 데이터 신선도는 `unstable_cache` 태그가 좌우 → **태그 purge가 핵심**. 홈/벤더리포트/상세는 태그 없이 직접 repo + page ISR이라 **경로 purge**가 핵심.

## 3. Next 16.2.9 캐시 API (중요 — 시그니처가 바뀜)

`revalidate.d.ts`/`revalidate.js` 직접 통독:
- **`revalidateTag(tag, profile)`** — 이제 2번째 인자(`profile: string | CacheLifeConfig`) 요구. 없이 호출하면 **런타임은 동작하나 deprecation 경고**("add second argument of 'max' or use updateTag") + **타입에러**(tsc 실패).
- **`updateTag(tag)`** — 단일 인자, **Server Action 전용**(route handler/비-action에서 throw), **즉시 만료 + `pathWasRevalidated` 설정 = read-your-own-writes**. 경고 없음. → 버튼(서버액션)에서 태그 purge에 가장 적합.
- **`revalidatePath(path, type?)`** — 시그니처 유지, type 선택. 단 **`[param]` 문법이 든 dynamic 경로**를 type 없이 넘기면 경고(무효). 우리는 **해석된 구체 경로**(`/article/123`)를 넘기니 무해.
- `unstable_cache({tags:['articles']})` 레거시 태그도 `updateTag`/`revalidateTag`가 부르는 `revalidate([encodeCacheTag(tag)])`와 **동일 encoding**이라 함께 purge됨(런타임 확인).

## 4. 구현 (커밋 `5010c21`, `vercel` 푸시)

- **`lib/revalidate.action.ts`** (`'use server'`): `revalidatePageCache({path, tags=[]})` → `tags.forEach(updateTag)` + `revalidatePath(path)`. ('use server' 파일은 async export만 허용 — 준수.)
- **`features/common/revalidate-button.tsx`** (`'use client'`, `FC<Props>`): 클릭 → 액션 await → `router.refresh()`(RSC 재실행 + 리스트 재하이드레이션) → sonner toast. pending 시 `RotateCw` `animate-spin`. `size='icon'` ghost, `size-7`(BookmarkButton과 동일 룩).
- **`features/common/page-header.tsx`**: 리뷰 지적(4개 리스트 페이지 헤더 마크업 중복 → 2회이상 공통화)을 반영해 `title`+revalidate props 파라미터화한 공통 헤더. 홈은 title이 없어(Section 소제목만) `flex justify-end` 단독 유지 — 정당한 차이.
- 7개 페이지에 배치(위 표). 상세/홈은 `RevalidateButton` 직접, 4개 리스트는 `PageHeader` 경유.

## 5. 검증

- `tsc --noEmit` 0. `next build` 통과(정적 `/` 프리렌더에 버튼 포함 = 서버렌더 에러 없음).
- 프로덕션 서버(`next start`) 스모크: `/`·`/article`·`/report`·`/vendor/openai`·`/vendor/report/daily`·`/report/757`·`/article/118016` 전부 **HTTP 200 + 버튼 정확히 1개**.
- 적대적 리뷰 워크플로(정확성·컨벤션 2렌즈 + finding별 REFUTE 검증): **correctness/blocker 0**, nit 1건(헤더 중복)만 CONFIRMED → 공통화로 반영.

## 6. 함정 — guard-commit.sh 오탐

`~/.claude/hooks/llm-rules/guard-commit.sh`는 **Bash 명령 문자열 전체**를 `co-authored-by|generated with|claude <|...`로 스캔한다. `git commit`과 검증용 `grep "...generated with..."`를 **한 Bash 호출에 합치면** 그 리터럴이 명령 문자열에 있어 **오탐 차단**된다. → **커밋은 단독 명령**으로, 트레일러 검증(`git log|grep`)은 별도 호출로(그건 `git commit`이 아니라 훅 대상 아님).

## 7. 리포트 크론 시각 변경 + 오늘 리포트 수동 생성 (같은 세션 후속)

### 크론 시각 (KST 기준으로 앞당김) — `vercel.json`
- **Vercel 크론은 UTC**. 기존 daily `0 23 * * *`(=KST 08:00), weekly `0 22 * * 0`(=KST 월 07:00).
- 변경: daily **KST 05:00 → `0 20 * * *`**(20:00 UTC 전날), weekly **KST 월 01:00 → `0 16 * * 0`**(일 16:00 UTC).
- 크롤은 `0 * * * *`(매시) 유지.

### 오늘 daily 리포트 수동 생성 (DB 데이터, 미커밋)
- 07-01 08시 배치(id 751~757, period 06-29→06-30) 이후 다음 배치(period 06-30→07-01)가 아직 생성 전이라(원래 07-02 08시 예정) 즉시 수동 생성.
- `reportWorkflow('daily')`와 동일한 8조합을 `generateReport('daily', vendor, lang)`로 실행(임시 스크립트, `new Date()` 기준 → period 06-30→07-01, title 07-01). `generateReport`가 `skipIfExists`+scoped delete-then-insert(승인된 멱등 경로)라 안전.
- 결과: **6건 생성**(758 general/ko, 759 ja, 760 en, 761 openai, 762 anthropic, 763 google), **naver/kakao 스킵**(정상 — `getArticlesForPeriod`는 `fetched_at(KST) >= since` 필터인데 naver 최신 fetch 06-30 12:01·kakao 06-24 → 윈도우 내 기사 0건). created_at 07-02 07:04~07:08 KST.
- **함정**: `getArticlesForPeriod`는 UTC 유도된 `since`를 **KST `fetched_at`과 비교**(9h 어긋난 윈도우) — 프로덕션 워크플로 동작 그대로라 수동도 동일 기준으로 재현. 검증 쿼리를 UTC 기준(`coalesce(published,fetched-9h)`)으로 짜면 함수 결과와 안 맞으니, 스킵 판정은 **함수와 같은 `fetched_at>=since`(KST)** 로 확인해야 함.
- 새 리포트는 site에서 캐시(`/report`=`reports` 태그, 홈/벤더리포트=page ISR) 만료 전엔 안 보임 → **이번에 추가한 revalidate 버튼**으로 즉시 반영 가능.

## 커밋
- `5010c21 feat(cache): add per-page manual revalidate button`
- (`vercel.json` 크론 시각 변경 + docs 기록은 세션 말미 커밋. 리포트 6건은 DB 데이터라 미커밋.)
