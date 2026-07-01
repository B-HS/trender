# 본문 가로 오버플로/코드블록 스타일 + 검색 필터 타임존 근본수정 (2026-07-01)

두 건. (1) 기사/리포트 본문(`prose`)이 뷰포트를 넘겨 가로 스크롤이 생기던 버그 + BBlog 코드블록 스타일 이식. (2) 검색 "기간/오늘" 필터가 잘못 정렬·필터되던 타임존 버그의 근본 원인 규명·수정(크롤러+쿼리+백필). (2)는 `2026-06-30-lang-segmentation-tz.md`의 "DB 두 컬럼 tz 불일치(미해결)" 후속이자 정정이다.

---

## 1. 본문 가로 오버플로 + 코드블록 스타일 (커밋 `638450d`)

### 문제
커스텀 `.prose`(BBlog 이식본, `app/globals.css`)에 wide-atomic 콘텐츠 가드가 없었다. 코드블록·테이블·이미지·긴 URL/토큰이 컨테이너를 넘겨도 클리핑/스크롤/줄바꿈이 없어 페이지 폭을 밀어냈고, 전역으로 스크롤바가 숨겨져(`scrollbar-width:none`) **조용히 가로 스크롤**이 생겼다. BBlog는 `.prose` CSS가 아니라 `CodeBlock` 컴포넌트(rehype-react)로 코드블록을 렌더하므로, 문자열-HTML(`dangerouslySetInnerHTML`) 파이프라인인 ts-trender엔 코드블록 스타일이 전혀 없었다.

### 원인 (렌더 파이프라인)
`lib/render/content.ts`는 markdown→`rehype-stringify` **문자열**을 반환. `rehypeHighlight`(옵션 없음=`detect:false`)라 **언어 없는 코드블록**은 `hljs` 클래스가 안 붙어 highlight.js 테마의 `pre code.hljs{overflow-x:auto}`가 안 먹음. 테이블은 bare `<table>`(div 래핑 없음)이라 기존 `div:has(> table)` CSS가 매칭 안 됨(게다가 `overflow-y-auto`로 축도 틀림).

### 수정 (`app/globals.css` `.prose` + 래퍼 2곳, CSS-only — 사용자가 컴포넌트 리팩터 대신 CSS 방식 선택)
- 루트 `break-words`(긴 단어/URL 줄바꿈, `overflow-wrap`은 상속됨).
- `img { max-w-full h-auto }`.
- `pre`: BBlog `CodeBlock` 룩 이식 — `bg-neutral-800 border-neutral-600 text-neutral-100 rounded-lg` + 패딩 + `overflow-hidden`; 내부 `code`는 `block bg-transparent p-0 text-2xs lg:text-sm whitespace-pre-wrap break-all`(모바일 10px/데스크톱 14px, **줄바꿈**으로 가로 스크롤 제거). highlight.js 테마와 겹치는 규칙은 **소스 순서/특이도**로 오버라이드(구문색 span은 유지, 배경만 transparent로).
- 인라인 `:not(pre) > code`: `bg-muted rounded px-1.5 py-0.5 font-mono text-[0.85em] break-words` pill.
- `table`: `block w-max max-w-full overflow-x-auto`(bare GFM 테이블 가로 스크롤). `div:has(> table)`도 `overflow-y-auto`→`overflow-x-auto`.
- `features/common/content-toggle.tsx`·`content-view.tsx`: prose 컨테이너(flex 자식)에 **`min-w-0`**(wide `pre`/table의 min-content가 `max-w-3xl`를 밀어내지 못하게).

### 검증
dev + Chrome(모바일 500px, 라이트/다크): 기사 117576(테이블 11·코드블록·이미지 15·긴 토큰 600+)·리포트 737에서 `docScrollWidth == clientWidth`, 오버플로 요소 0. 코드블록 다크박스·줄바꿈·10px, 인라인 코드 pill, 다크 테이블 정상. `tsc` 0.

### 함정 — Turbopack `.next` stale CSS (중요)
`globals.css`를 고쳐도 dev가 **옛 CSS 청크를 계속 서빙**(같은 청크명 `app_globals_*.css`, 옛 내용)해서 화면에 반영이 안 됐다. HMR·서버 재시작으로도 안 되고 **`.next` 캐시를 비우고서야** 반영됨. `rm -rf`가 환경상 차단되면 `mv .next .next-stale-…`(레포 밖으로 이동, `.gitignore`는 `.next`만 무시하니 반드시 레포 밖/`.next` 안으로) 후 재기동. → globals.css 수정이 안 보이면 이걸 먼저 의심.

### BBlog 스타일 이식 결론
BBlog `globals.css`를 diff한 결과 `.prose` CSS는 (내 추가분 제외) **완전히 동일**. BBlog에만 있던 스타일은 코드블록(컴포넌트 기반)뿐이라 그걸 CSS로 옮긴 게 전부다. BBlog의 나머지 콘텐츠 요소(heading 앵커링크+slug, table-wrapper, next/image 본문이미지)는 **CSS가 아니라 마크다운 파이프라인 로직**이고, ts-trender의 `virtual-scroll`은 스크롤 썸바만 있고 TOC를 안 만들어 `[data-bscroll-toc]` CSS는 **죽은 잔재**다(로직 이식은 별건, 미진행).

---

## 2. 검색 "기간/오늘" 필터 타임존 근본수정

### 증상 (사용자 보고)
- 기간을 누르면 정렬이 DESC가 아니라 ASC처럼 보임.
- "오늘"이 KST 기준 오늘 기사만 나와야 하는데 잘못 나옴.

### 근본 원인 (2단)
1. **`normalizeDate`(`lib/crawl/factories.ts`)가 런타임 tz 의존적.** 기존 `new Date(raw).toISOString()`은 **오프셋 없는** pubDate를 런타임 로컬로 해석. **aitimes**가 ~2026-06-23부터 `<pubDate>`를 오프셋 없는 `"2026-07-01 07:00:00"`(공백구분, RFC822 아님)로 바꿈 → 크롤이 도는 **Vercel(UTC)**에서 KST 벽시계값이 UTC로 라벨링돼 **+9h 부풀려 저장**. (로컬=KST에선 우연히 맞아 안 보였음.) 즉 `published_at`은 소스/시점별로 UTC(오프셋 피드)와 KST-wallclock(오프셋 없는 aitimes/d2.naver)이 **혼재**.
2. **쿼리(`listArticles`)가 tz를 혼용.** `coalesce(published_at, fetched_at)`에서 `published_at`(datetime, UTC 의도)과 `fetched_at`(TIMESTAMP, DB 세션 `@@time_zone=SYSTEM=KST`라 **read 시 KST**)을 섞어 정렬/필터.

효과: 오염된 aitimes 행이 `coalesce(...) DESC`에서 +9h로 **최상단에 뜨며 실제로 더 최신인 다른 소스보다 위**로 감(→ "역순처럼 보임"). today 필터도 +9h 밀려 **어제 저녁 KST 기사가 오늘로** 포함.

### 하드 증거
- aitimes `<pubDate>`=`"2026-07-01 07:00:00"`(오프셋 없음). `new Date` on UTC 런타임→`07:00Z` 저장(실제 22:00Z 전날이어야).
- 소스별 `avg(timestampdiff(h, published, fetched))`: 대부분 ~9~10h(=UTC, fetched가 KST라 9h 차) / **aitimes·d2.naver만 ~1h(=KST-wallclock)**.
- aitimes는 06-23 전후로 UTC(1043행)/KST(234행) **혼재**(피드 포맷 변경 컷오버) → 일괄 −9h는 정상 행을 깨뜨림.

### 수정 (A 크롤러 + C 쿼리 + B 백필)
**A. `lib/crawl/factories.ts` `normalizeDate` 결정론화** (+ qiita/zenn/kakaotech 호출부)
- `dayjs`+`utc`+`timezone`. 오프셋 유무 판정(`/(?:Z|[+-]\d{2}:?\d{2}|GMT|UTC)/i`). **오프셋 있으면** `new Date`(기존과 동일 UTC), **없으면** `dayjs.tz(raw, sourceTz)`로 소스 locale tz 해석 후 `.utc()`. `try/catch`로 파싱 실패는 `undefined`(외부 피드 방어).
- `LANG_TZ = { ko:'Asia/Seoul', ja:'Asia/Tokyo', en:'UTC' }` export. 피드 provider들이 `normalizeDate(raw, LANG_TZ[lang])` 호출. → **런타임 tz 무관하게 UTC 저장**(재발 방지).

**C. `entities/article/article.repo.ts` `listArticles` tz 일관화**
- `sortUtc = coalesce(published_at, fetched_at - interval 9 hour)` 하나로 **정렬·커서·period 전부 UTC 기준** 통일(`fetched_at`은 세션 KST라 −9h로 UTC화; 세션 KST 고정 가정).
- SELECT `sortAt`=`sortUtc`, `orderBy sortUtc desc, id desc`, 커서 `sortUtc` 비교.
- **today = KST 달력 하루 `[하한,상한)`**: 하한 `date(utc_timestamp()+9h)-9h`, 상한 `+15h`(=다음 KST 자정 UTC). 기존 case-분기(2026-06-30) 대체.
- 3d/7d: `now()`→`utc_timestamp()`.

**B. 백필 (DB 데이터, 미커밋 — 사용자 승인 후 실행)**
- `UPDATE articles SET published_at = published_at - INTERVAL 9 HOUR WHERE source_id IN (6,286) AND published_at IS NOT NULL AND TIMESTAMPDIFF(HOUR, published_at, fetched_at) < 6`
- **238행**(aitimes 234 + d2.naver 4). 정상 UTC 1118행 미변경. `gap<6h` 조건이라 교정 후 gap이 9~10h가 돼 **재선택 불가 = 멱등**(두 번 실행 안전).
- 스크립트: `docs/utils/backfill/tz-published-fix.ts`.

### 검증 (백필 후, `utc_now`=`2026-07-01 04:10`)
- 최신 aitimes가 `12:59`(부풀림)→`03:59`(UTC)로 교정 → hada 등 다른 소스와 **실제 시간순으로 interleave**(정렬 정상).
- today(ko) n=32, **KST 달력일 != 오늘인 행 0개**. 경계 정확(`06-30 15:04Z`=`07-01 00:04 KST` ~ `12:59 KST`).
- `tsc` 0.

### 미결/참고
- `app/api/articles/route.ts`는 클라이언트가 안 쓰는 **dead code**(client=서버액션 `loadArticles`). period/source 미반영·tz 미적용 상태로 방치(미사용).
- 표시(`formatKstDate`)는 이미 `dayjs.utc(v).tz(seoul)`이라 데이터가 UTC로 정리되면서 aitimes 표시 날짜도 자동 정상화.

## 커밋
- `638450d fix(prose): prevent horizontal overflow in article/report body`
- (타임존 수정 A+C 커밋은 이 세션 말미. B 백필은 데이터라 미커밋.)
