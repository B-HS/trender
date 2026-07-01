# 운영 지식 · 함정 (durable)

> ts-trender 운영/백필에서 반복 적용되는 사실·함정. 새 세션 시작 시 먼저 읽는다.
> 출처: 2026-06-24~29 토큰 성능분석 + 번역/리포트 백필 세션. 코드 근거는 `docs/history/2026-06-session.md`.

## DB / 마이그레이션

- **DB는 `db:push` 기반.** `__drizzle_migrations` 추적 테이블이 없다 → `bun db:migrate` 돌리면 0000부터 재적용 시도 → `table already exists`로 중단. **새 마이그레이션은 `bun db:push` 또는 생성된 `drizzle/000N.sql`을 직접 적용**한다. (0003 `app_locks`는 0003 SQL을 직접 실행해 넣었다.)
- DB는 **레거시 공유 DB**(`DATABASE_URL`). `reports` 행 **직접 DELETE는 auto-mode classifier가 차단**한다(사용자가 리포트 유실에 민감). 정리는 스크립트 내부 멱등 upsert(특정 키만 delete-then-insert)로, 직접 인라인 DELETE는 금지.

## 크롤 / 토큰 (이번 세션 핵심)

- **토큰·런타임 폭증의 진짜 원인은 "아카이브 백필 번역"이었다.** OpenAI 피드(1019개, 2015~), HuggingFace(808개, 2020~)가 **전체 아카이브를 노출** → 컷오프 없던 크롤러가 매 런 15건씩 옛날 글을 퍼와 전부 번역. (overlap/중복 URL이 아니라 distinct 옛 기사.)
- 대응 코드(전부 `vercel` 브랜치 푸시, vercel=프로덕션):
  - **크롤 14일 컷오프** (`lib/crawl/pipeline.ts` `MAX_AGE_DAYS=14`): `publishedAt` 14일↑ 옛 글은 insert·fetch 전에 skip. publishedAt 없는 건 유지.
  - **크론 중복 락** (`entities/lock/lock.repo.ts` + `app_locks` 테이블): crawlWorkflow 시작 시 `acquireLock('crawl', 90분 TTL)`, 못 얻으면 skip, finally release. `*/30`→`0 * * * *`(1시간).
  - **enrich 배치화** (`workflows/crawl.ts`): 건당 step(120) → 6건 배치 step(~20). enrichBatch 횟수는 crawlOne(22)과 무관, `남은 미번역/6`.
  - **enrich 2026 필터** (`entities/article/article.repo.ts` `listPendingArticleIds`): `coalesce(published_at, fetched_at) >= '2026-01-01'`만 enrich. 옛 아카이브는 enrich/번역 안 함.

## 번역 (Ollama Cloud 백필)

- 프로덕션은 codex(`CODEX_AUTH`)로 번역하지만, **codex rate limit 시 Ollama Cloud로 백필**한다. → `docs/utils/backfill/`.
- 모델: **번역 = `deepseek-v4-flash:cloud`**, **리포트 = `deepseek-v4-pro:cloud`** (사용자 지정). `https://ollama.com/api/chat`, `think:false`, 번역 `num_ctx:32768`, `AbortSignal.timeout(120000)`.
- **임시키는 폐기되면 401.** 키는 절대 파일/커밋에 안 넣고 env로만.
- 거대 본문(예: 20818자) 1건이 반복 타임아웃으로 미번역 남을 수 있음(허용, 재시도/codex로 처리).
- **번역 대상**: 비-ko + 본문 有 + `coalesce(published_at,fetched_at) >= 2026-01-01`. (ko는 키워드만, 번역 안 함.)

## 리포트

- **리포트 = 기사 요약.** 기사를 **`fetched_at` 윈도우**로 묶는다(발행일 아님). 일일 종료일 E → `[E-1, E)`, 주간 → `[E-7, E)`. 제목 `(E)`.
- **만들 수 있는 리포트는 기사 보유 기간에 묶인다.** 기사 `fetched_at` 하한(현재 **2026-05-16**) 이전은 기사 0 → 빈 리포트 불가. 총량 = 보유기간 × 8조합(일반 ko/ja/en + 벤더 ko 5, meta 제외).
- **`rank`는 MySQL 예약어** → `report_items` insert에 `` `rank` `` 백틱 필수. 안 하면 행만 생기고 items 실패 = orphan.
- **리포트 `created_at` = `period_end`로 보정**(일일 23:00, 주간 22:00). 백필 insert는 `created_at=now()`라 정렬이 다 오늘로 뭉치므로, 리포트 백필 직후 `fix-report-created.ts` 필수. `listReports`는 `createdAt desc` 정렬.
- **프로덕션 리포트가 짧던 원인**: `generateReport`가 `callCodex`를 effort 미지정(=low)로 호출 + 프롬프트가 분량 미강제. → 프롬프트 강화(토픽 3-4·각 2-3문단·기사 전부 커버·구체적) + `effort: 'medium'`로 고침(`lib/ai/report.ts`).
- 메인(`app/page.tsx`): 일반/기업 각 **6개**. `getDailyVendorReports(6)`.

## 정렬 (게시글 공통)

- **모든 게시글 정렬 = 생성일 desc.** 리포트=`created_at`(=period_end) desc. 기사·북마크=**`sortUtc desc, id desc`**(예전 `id desc`는 표시 발행일과 어긋나 날짜 섞임).
  - **`sortUtc = coalesce(published_at, fetched_at - interval 9 hour)`** (2026-07-01, `listArticles`). 예전 `coalesce(published_at, fetched_at)`는 published(UTC)와 fetched(세션 KST)를 섞어 정렬이 어긋났다 → 전부 UTC 기준으로 통일. `fetched_at`은 세션 KST라 −9h로 UTC화(세션 KST 고정 가정). SELECT `sortAt`·`orderBy`·커서 비교 모두 `sortUtc` 사용. → 아래 "타임존 근본수정" 참조.
- 기사 무한스크롤 커서: `id`(number) → **복합 키셋 `"sortAt|id"`(string)**. 영향 파일: `entities/article/article.repo.ts`(listArticles), `article.action.ts`, `article.client.ts`, `app/article/page.tsx`, `app/vendor/[vendor]/page.tsx`, `app/api/articles/route.ts`. `ArticleListItem`에 `sortAt: string` 추가.

## 인프라 / 시크릿

- **Vercel Production Branch = `vercel`**(git 기본 `main` 아님). 크론은 Production에서만 돈다. `vercel` 푸시 → 프로덕션 배포. (`.vercel/project.json`엔 production branch 값 없음 → 셸에서 확인 불가.)
- 도는 Vercel 워크플로는 셸에서 못 멈춤 — 대시보드 Cancel / Cron 일시중지.
- **codex는 6/30까지 rate limit.** 그전까지 번역/리포트는 Ollama Cloud로.
- 커밋: author 단독(`Hyunseok Byun`), **Co-Authored-By/Claude 트레일러 절대 금지**, 요청 전 commit/push 금지, Conventional Commits.

## 리포트 대량 재생성 (2026-06-29, 상세 `docs/history/2026-06-29-report-depth.md`)
- **리포트 깊이 = 입력 본문 + 프롬프트**가 좌우. 제목만 넣으면 얇다. `report.ts`/`report.repo.ts`에 본문 발췌(`coalesce(content_translated_ko,content_original)`, 태그 제거, 16000자) + 강화 프롬프트 적용됨(모델 `gpt-5.4-mini` 유지).
- **병렬 백필 DB 함정**: mysql 풀 기본 `connectionLimit=10` × 병렬 에이전트(~16) = 연결 초과 → `PROTOCOL_CONNECTION_LOST`. 병렬 백필 풀은 **`connectionLimit:2`** + 청크 ≤12. 생성 실패해도 본문 파일(out-*.md)은 남으니 순차 `inline.ts save`로 살림.
- **공식 5h usage %** 는 statusline stdin JSON `rate_limits.five_hour.used_percentage`에만 있음(Pro/Max, 첫 API응답 후). `~/.claude/statusline-command.sh`가 `~/.ts-trender-cron/usage.txt`로 기록 → 자동 게이팅에 사용. ccusage는 토큰/비용만, 공식 % 없음. LLM 자신은 usage 모름.
- 도구: `docs/utils/backfill/inline.ts`(build/prompt/save, worklist 기반, 병렬 안전) + `Workflow`로 idx 청크당 sonnet 에이전트. report-backfill에 `ENGINE=claude`·`MODEL`·`KIND`·`MIN_END`·`EXISTING`·`num_ctx` 추가.

## 언어별 리포트 / 타임존 (2026-06-30, 상세 `docs/history/2026-06-30-lang-segmentation-tz.md`)
- **리포트는 언어별 기사로 분리 종합**: `getArticlesForPeriod`에 `lang` 주면 `a.lang=lang` 필터 + 원문(`title_original`). 일반 리포트(vendor=null)만 적용, **벤더 리포트는 lang 필터 금지**(영어 소스라 ko 필터 시 0건). ko=한국어/ja=일본어/en=영어 기사.
- **타임존**: 표시는 `lib/date.ts` `formatKstDate`(dayjs utc+timezone, `dayjs.utc(v).tz('Asia/Seoul')`) — Z 없는 naive를 dayjs가 로컬 간주해 변환 안 하던 버그 수정. 리포트 카드는 `periodEnd`(순수 date) 표시. **⚠️ 당시 "published_at=UTC 저장, 두 컬럼 tz 불일치 미해결"이라 적었으나, published_at은 소스별로 UTC/KST 혼재였고 2026-07-01에 근본수정됨 → 아래 "타임존 근본수정" 참조.**
- (당시) today 필터 = KST 달력 오늘, published/fetched case-분기. **→ 2026-07-01에 `sortUtc` 단일 기준 `[하한,상한)`으로 대체.**
- **워크플로 에이전트 프롬프트 언어 편향 주의**: "Korean site"/"## 종합" 같은 한국어 힌트가 있으면 ja/en 에이전트가 입력·지시 무시하고 한국어로 작성. 프롬프트는 언어중립 + "타겟 언어로만" 강제. 재생성 후 Hangul/Kana **글자수 임계**(kana≥15→ja, hangul≥30→ko)로 언어 무결성 검출(존재 test는 인용 오탐).
- **worklist.json 덮어쓰기 금지(워크플로 실행 중)**: 워크플로 에이전트는 `claude -p` 프로세스로 안 보임 → `pgrep`로 완료 판단 말고 **완료 알림 받은 뒤** worklist 교체. 안 그러면 잘못된 idx 저장(오염).

## 타임존 근본수정 (2026-07-01, 상세 `docs/history/2026-07-01-prose-overflow-and-tz-filter.md`)

- **`published_at` 저장 tz는 소스/시점별로 혼재**였다(UTC ↔ KST-wallclock). 근본 원인: 기존 `normalizeDate = new Date(raw).toISOString()`이 **오프셋 없는** 피드 날짜를 런타임 로컬로 해석 → **Vercel(UTC)**에서 KST 벽시계값이 +9h 부풀려 저장. **aitimes**가 ~2026-06-23부터 pubDate를 오프셋 없는 `"YYYY-MM-DD HH:MM:SS"`로 바꿔 234행, d2.naver 4행 오염. (로컬=KST에선 우연히 맞아 안 보임 → **크롤 tz 버그는 반드시 프로덕션(Vercel=UTC) 기준으로 판단**.)
- **`normalizeDate(raw, tz)`는 이제 결정론적**(`lib/crawl/factories.ts`): 오프셋 있으면 `new Date`(UTC), 없으면 `dayjs.tz(raw, sourceTz)`. 피드 provider는 `LANG_TZ[lang]`(ko→Seoul, ja→Tokyo, en→UTC) 전달. **새 피드/provider 추가 시 offset 없는 날짜면 반드시 source tz 전달.**
- **소스별 저장 tz 판별법**: `avg(timestampdiff(hour, published_at, fetched_at))` — `fetched_at`이 세션 KST라 published가 UTC면 ~9~10h, KST-wallclock이면 ~0~1h. (gap은 크롤 지연과 섞이니 최근 윈도우로 봐야 함.)
- **쿼리는 전부 UTC 기준**: `sortUtc = coalesce(published_at, fetched_at - interval 9 hour)`(정렬 섹션 참조). today = `[date(utc_timestamp()+9h)-9h, +15h)`. 3d/7d = `utc_timestamp() - interval N day`. 세션 `@@time_zone=SYSTEM=KST`라 `fetched_at`은 −9h로 UTC화(세션 KST 고정 전제 — 바뀌면 이 상수 재검토).
- **백필은 `gap<6h` 조건이라 멱등**(교정 후 gap 9~10h로 재선택 불가). tz 백필 스크립트 `docs/utils/backfill/tz-published-fix.ts`. (레거시 공유 DB, `reports` 직접 DELETE는 classifier 차단 — articles UPDATE는 허용됐음.)

## 콘텐츠 렌더 / prose (2026-07-01)

- **커스텀 `.prose`(`app/globals.css`)는 코드블록/테이블/이미지/긴토큰 가드가 없으면 가로 오버플로** → 전역 `scrollbar-width:none`이라 **조용히 페이지 가로 스크롤**. 필수 가드: 루트 `break-words`, `img{max-w-full h-auto}`, `pre{overflow/줄바꿈+다크박스}`, 인라인 `:not(pre)>code`, `table{block w-max max-w-full overflow-x-auto}`, prose 컨테이너(flex 자식) `min-w-0`.
- **코드블록 스타일은 CSS로 이식**(BBlog는 `CodeBlock` 컴포넌트/rehype-react지만 ts-trender는 문자열-HTML). `pre code`: `text-2xs lg:text-sm whitespace-pre-wrap break-all`(모바일 10px, 줄바꿈). highlight.js 다크테마와 겹치면 **소스 순서/특이도**로 오버라이드(배경 transparent, 구문색 유지). BBlog `.prose` CSS는 이것 말고는 ts-trender와 동일.
- **⚠️ Turbopack `.next` stale CSS**: dev가 `globals.css` 수정 후에도 옛 CSS 청크(같은 이름, 옛 내용)를 계속 서빙 → HMR·재시작으로도 안 되고 **`.next` 비워야** 반영. `rm -rf` 차단 환경이면 `mv .next` 로 레포 밖 이동 후 재기동(`.gitignore`는 `.next`만 무시하니 이동 위치 주의). globals.css 수정이 화면에 안 보이면 이걸 먼저 의심.

## Next 캐시 / 수동 revalidate (2026-07-02, 상세 `docs/history/2026-07-02-per-page-revalidate-button.md`)

- **Next 16.2.9 캐시 API가 바뀜**: `revalidateTag(tag)` 단일인자는 **deprecated 경고 + tsc 타입에러**(2번째 `profile` 인자 요구). **서버액션에선 `updateTag(tag)`**(단일인자, 즉시 만료 + read-your-own-writes, 경고 없음), 그 외(route handler 등)에선 `revalidateTag(tag,'max')`. `updateTag`는 route handler/비-action에서 throw. `unstable_cache({tags})` 레거시 태그도 `encodeCacheTag` 동일 경로라 함께 purge됨.
- **페이지별 캐시 계층이 다름**(버튼/무효화 시 반드시 구분): 리스트 `/article`·`/vendor/[vendor]`(`loadArticles`)·`/report`(`listReportsCached`)는 **`unstable_cache` 태그**(`articles`/`reports`) → 태그 purge가 핵심. 홈·`/vendor/report/[kind]`·상세(`/article/[id]`·`/report/[id]`)는 **직접 repo + page ISR**(`export const revalidate`) → 경로 purge가 핵심. `/bookmarks`는 `force-dynamic`(캐시 없음).
- **수동 revalidate 패턴**: 서버액션 `revalidatePageCache({path,tags})`(`lib/revalidate.action.ts`) + 클라 버튼(`features/common/revalidate-button.tsx`) → 액션 후 **`router.refresh()`**로 RSC 재실행·리스트 재하이드레이션. 리스트는 react-query가 서버액션을 queryFn으로 쓰므로 태그 purge 후 refresh면 신선.
- **`revalidatePath`는 dynamic 문법(`[param]`) 경로를 type 없이 주면 무효+경고** → 해석된 구체 경로(`/article/123`)를 넘긴다.
- **guard-commit.sh 오탐**: PreToolUse 훅이 **Bash 명령 문자열 전체**를 `co-authored-by|generated with|claude <|noreply@anthropic`로 스캔 → `git commit`과 검증용 `grep "...generated with..."`를 **한 호출에 합치면** 그 리터럴 때문에 차단. **커밋은 단독 명령**, 트레일러 검증은 별도 `git log|grep`(훅 대상 아님)로.

## 리포트 크론 / 수동 생성 (2026-07-02, 상세 `docs/history/2026-07-02-per-page-revalidate-button.md`)

- **Vercel 크론은 UTC.** `vercel.json`: daily `0 20 * * *`(=KST 05:00), weekly `0 16 * * 0`(=KST 월 01:00), crawl `0 * * * *`(매시). KST로 환산할 땐 +9h. 크론은 워크플로를 **트리거만** 하고, 리포트 행 `created_at`은 생성 완료 시각(언어/벤더 8조합 순차라 몇 분 편차).
- **daily 리포트 = 트리거 시점 직전 24h.** `generateReport(kind, vendor, lang, now=new Date())`: `since=now-24h`, period `[toDate(since), toDate(now)]`(UTC 날짜), title `(toDate(now))`. `new Date().toISOString()`은 머신 tz 무관 UTC라 로컬 실행도 프로덕션과 같은 period 산출.
- **수동 생성**: 워크플로 런타임 안 띄우고 `generateReport('daily'|'weekly', vendor, lang)`를 8조합(general ko/ja/en + vendor{openai,anthropic,google,naver,kakao} ko) 루프로 직접 호출하면 `reportWorkflow`와 동일. `skipIfExists=true`(기본) + `insertReport`의 **scoped delete-then-insert**(같은 kind/lang/vendor/period만) = 멱등, 승인된 경로(레거시 DB raw DELETE 금지와 무관). codex rate-limit은 `isCodexLimit(error)`(`CODEX_LIMIT` prefix)로 감지해 중단.
- **⚠️ `getArticlesForPeriod` tz 함정**: 필터가 `gte(articles.fetchedAt, since)` — `fetched_at`은 DB 세션 KST인데 `since`는 UTC 유도 문자열 → **9h 어긋난 윈도우**(프로덕션 워크플로도 동일). 벤더 스킵("no articles") 판정·검증은 반드시 **함수와 같은 `fetched_at(KST) >= since`** 로 확인(UTC 기준 `coalesce(published,fetched-9h)`로 짜면 결과 불일치). (리포트 period tz 정합은 별도 미결 과제.)
- 새로 생성/백필한 리포트는 site 캐시(`/report`=`reports` 태그, 홈·벤더리포트=page ISR) 만료 전엔 안 보임 → revalidate 버튼(위 "Next 캐시" 섹션)으로 즉시 반영.
