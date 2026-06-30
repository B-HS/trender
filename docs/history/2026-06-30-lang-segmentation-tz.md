# 언어별 리포트 분리 + 타임존 + today 필터 (2026-06-30)

## 배경
전날(6/29) 리포트 깊이 개선·전량 재생성(→ `2026-06-29-report-depth.md`) 후속. FE 점검 중 추가 이슈 3건 발견·수정.

## 1. 리포트 언어별 분리 (가장 큰 변경)
### 문제
`getArticlesForPeriod`에 lang 필터가 없어, **ko/ja/en 일반 리포트가 동일한 30개 기사 풀(언어 혼합, 한국어 번역 제목)** 을 쓰고 `lang`은 *출력 언어*만 바꿈 → 같은 내용을 3개 언어로 번역 생성. en/ja도 한국어 제목을 입력으로 받음.

### 수정 (프로덕션, 커밋됨)
- `report.repo.ts` `getArticlesForPeriod`에 `lang?` 추가: lang 주면 `a.lang = lang` 필터 + **원문 제목/본문**(`title_original`/`content_original`), 없으면 기존(coalesce ko 번역).
- `report.ts`: 일반 리포트(vendor=null)에만 lang 전달, 벤더 리포트는 현행 유지(영어 소스→ko 번역).
  - **벤더 리포트는 lang 필터 금지**: openai/anthropic/google 등은 영어 소스라 ko로 필터하면 0건.
- 결과: ko=한국어 기사, ja=일본어 기사, en=영어 기사에서 각각 종합(원문). 같은 기간 ko/ja/en이 완전히 다른 기사셋.

### 기존 DB 재생성 (워크플로 병렬)
- `inline.ts`에 `buildset`(SET_LANGS/SET_VENDOR + MIN_ARTICLES 필터) 추가. getArticles도 일반 리포트는 lang필터+원문.
- ja/en 70잡(기사 3건 이상) + ko 50잡 재생성. **en은 영어 기사 희소일 30잡 제외**.
- **thin-en 16건(영어 기사 0~2개) 삭제**: 재생성하면 빈 리포트라, 옛 혼합/한국어 내용이 lang=en으로 잘못 붙은 것을 제거(언어 순도 유지). 사용자 결정=삭제.
- 최종: ko 50·ja 50·en 34, 언어 불일치 0.

## 2. 타임존 표시 (커밋됨)
### 문제
`normalizeDate`가 **UTC로 저장**(`toISOString()`, Z 없는 naive). FE는 `dayjs(value).format()` — utc/timezone 플러그인 없이 **로컬로 간주 → UTC→KST 변환 안 함**. UTC 15:00~24:00(=KST 00:00~09:00) 기사가 **전날로 하루 밀려** 표시.

### 수정
- `lib/date.ts` `formatKstDate`: dayjs `utc`+`timezone` → `dayjs.utc(value).tz('Asia/Seoul')`. 서버/클라 무관 항상 KST.
- 기사(`article-card`, `article/[id]`): `formatKstDate(publishedAt)`.
- 리포트(`report-card`): `dayjs(createdAt)` → **`periodEnd`**(date 타입, 순수 캘린더 날짜, TZ 무관, 리포트 논리 날짜). 상세는 이미 periodEnd.

### DB 타임존 불일치 (알려둠, 미수정)
- **`published_at`(DATETIME)=UTC 저장, `fetched_at`(TIMESTAMP)=KST 저장** (DB 세션 `@@time_zone=SYSTEM=KST`라 TIMESTAMP는 KST wall로 read). 실제 instant는 정합하나 wall이 9h 다름.
- `coalesce(published,fetched)` 정렬에서 published 없는 기사(39건뿐)가 9h 높게 정렬되는 미세 글리치. 근본 정리는 저장 UTC 통일 마이그레이션 필요(보류).

## 3. today 필터 = KST 달력 오늘 (커밋됨)
- 기존 `coalesce(published,fetched) >= now() - interval 1 day` = 롤링 24h.
- 변경: **KST 달력 오늘**. published(UTC)는 `date(utc_timestamp()+9h) - 9h` 경계, fetched(KST)는 `date(utc_timestamp()+9h)` 경계로 case 분기. KST는 DST 없어 9h 고정 안전.
- 3d/7d는 롤링 유지(스코프 외).

## 함정/교훈
- **워크플로 에이전트 프롬프트의 언어 편향**: ko 재생성용 프롬프트(`"Korean trend site"`, 예시 `"## 종합"`)를 ja/en에 재사용 → 일부 ja 에이전트가 일본어 입력·`日本語` 지시에도 **한국어로 작성**(report_items는 ja 정상, 본문만 한글). → 프롬프트 언어중립화 + "타겟 언어로만, 한국어 기본값 금지" 강제. 재생성 후 언어 무결성 스캔(Hangul/Kana 글자수)으로 검출·교정.
- **worklist.json 덮어쓰기 위험**: 워크플로 에이전트는 `claude -p` 프로세스로 안 보임(내부 에이전트). `pgrep 'claude -p'`=0 으로 완료 판단 금지 → **반드시 워크플로 완료 알림을 받은 뒤** worklist 교체. (덮어쓰면 실행 중 에이전트가 잘못된 idx 저장 → 오염)
- **워크플로 동시성 상한 = `min(16, 코어-2)≈16`**. 청크에 30개 줘도 ~16만 동시 실행, 나머지 큐. DB 풀은 `connectionLimit:2`(에이전트당) 필수 — 기본 10이면 16에이전트×10=과다로 `PROTOCOL_CONNECTION_LOST`.
- **언어 무결성 검출**: 인용으로 인한 오탐 줄이려 Hangul/Kana **글자수 임계**(kana>=15→ja, hangul>=30→ko)로 판정. 단순 존재(test)는 영어 리포트의 한국어 인용을 오탐.

## 커밋 (push 완료, ~`2e7be59`)
- `feat(report): select articles per language for general reports`
- `fix(date): display article dates in KST and report dates by period_end`
- `fix(article): make today filter the KST calendar day`
- `chore(backfill): add per-language worklist build and lang-filtered articles`
- (DB 재생성/삭제는 데이터라 미커밋. 워크플로 스크립트는 세션 런타임.)
