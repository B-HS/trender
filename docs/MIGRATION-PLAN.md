# MIGRATION PLAN — Trender 단일 Next.js 통합 (Vercel Pro)

> **이 문서는 자립형 플랜이다.** 새 세션은 이 문서 + `docs/research/*` + `docs/sources.md` + `docs/acknowledge/*` 만으로 작업을 100% 이어갈 수 있어야 한다.
> 베이스 룰(전역): `~/.claude/CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*` (새 세션 자동 로드). 작업 브랜치: **`ts-only`**.

---

## 0. 한 줄 요약
Python 파서 + Next.js 웹 + Docker cron 구조를 **단일 Next.js 앱(Vercel Pro)** 으로 통합한다. 파서를 TS로 포팅해 `apps/web`에 흡수하고, Vercel Cron(+필요 시 Vercel WDK)으로 구동하며, Python(`apps/parser`)은 컷오버까지 무중단 가동 후 제거한다. 부수로 소스 개편 + 기업 소식(벤더 페이지/탭) + 기업 종합 리포트를 추가한다.

## 1. 왜 (이 세션에서 확정된 근거)
- **stealth 브라우저(CloakBrowser)가 Python→TS 포팅의 유일한 핵심 블로커**였는데, **CF 전수 감사 결과 일관 차단 소스 0건**(`docs/research/cloudflare-audit.md`) → 제거 가능 → 포팅 가능.
- 기사 본문은 **9곳 중 8곳이 정적 HTML에서 trafilatura로 전문 추출**됨(`docs/research/source-probe.md`). 진짜 SPA는 KakaoTech(Nuxt) 하나(허용).
- **DB(`packages/db`, drizzle)는 이미 TS** — 웹이 사용 중 → TS 파이프라인이 그대로 재사용(Python `db/*` 중복 제거).
- **Vercel Pro**: cron 빈도 무제한, 함수 800s(Fluid GA)/1800s(beta). **Vercel WDK(`workflow-sdk.dev`)는 Vercel 1st-party durable workflow** → 서드파티(Inngest 등) 불필요. 파이프라인이 이미 청크형이라 대부분 800s 안에 들어감(`docs/research/vercel-nextjs-feasibility.md`).
- **Codex(ChatGPT) OAuth provider**는 이번 세션에 구현·라이브 검증 완료 → TS 포팅 정본 `docs/research/codex-chatgpt-protocol.md`.

## 2. 확정 결정 (사용자, 전부 락)
1. **단일 Next.js 앱 on Vercel Pro.** Hono·서드파티 워크플로 안 씀. 긴 작업만 **Vercel WDK** 선택 적용.
2. 기존 **dev/Python 컨테이너 무중단 유지**, 새 작업은 브랜치 **`ts-only`**.
3. **네비 3메뉴: 리포트 / 기사 / 기업 소식.**
   - **기업 소식** = 탭: **[종합 리포트]**(전 벤더 결합 한국어 일간/주간) + **벤더별 6탭**(각 벤더의 글 목록).
4. **벤더 6: OpenAI · Anthropic · Google(DeepMind+Research) · Meta · Naver · Kakao.** → `sources.vendor` 컬럼.
5. **기업 종합 리포트**: 전 벤더 기사(원문 언어 무관) 결합 → **한국어 일간+주간**. `reports.vendor`(''=전역, 'all'=종합, 벤더키=per-vendor 옵션). reportKind는 daily/weekly 유지.
6. **소스 개편**(상세 `docs/sources.md`): Anthropic 죽은 피드→`tim-hilde` 스크래퍼 피드, 추가군 −arXiv. **Qiita→공식 API v2**(403 테스트 통과). **Meta 공식 RSS 없음→RSSHub/스크래퍼/sitemap 확정 필요.**
7. **API 우선 원칙**: 가져올 수 있으면 API가 베스트, **단 채택 전 403/거부 테스트 필수**(Qiita/Zenn/GeekNews 통과 확인됨).
8. **stealth 브라우저 제거** + 추출 폴백(trafilatura→JSON-LD→readability).
9. 규약: arrow fn, 주석 금지(JSDoc만), any/unknown 금지, named export, FSD 의존 방향, React Compiler(useMemo/useCallback 금지), 커밋 author 단독·co-author 트레일러 금지, **요청 전 commit/push 금지**, 시크릿은 env/KV로만.

## 3. 목표 아키텍처 (단일 Next.js 앱)
- `packages/db`(drizzle) · `packages/ui` — **재사용**.
- `apps/web`(Next.js) — **유지·확장**. 웹 페이지(홈/리포트/기사/책갈피/인증)는 현행 그대로 + 파이프라인 흡수:
  - `lib/pipeline/*` — collect·keywords·evolve·report·translate·catchup (Python 포팅, drizzle 직접).
  - `lib/fetch/*` — 소스별 디스패치: RSS=`rss-parser`/`fast-xml-parser`, **Qiita=API v2**, 기사 추출=`@mozilla/readability`+`jsdom`+`turndown`(브라우저 없음, JSON-LD 폴백).
  - `lib/llm/*` — Codex ChatGPT backend 클라 + Ollama Cloud 클라(fetch+SSE). **로컬 Ollama는 Vercel에 없음 → Cloud+Codex 2-provider.**
  - `app/api/cron/<task>/route.ts` + `vercel.json` crons (시크릿 가드). 긴/다단계만 Vercel WDK(`"use workflow"`/`"use step"`).
- **Codex 토큰**: `~/.codex/auth.json`(FS) 대신 **DB 테이블(drizzle)** + refresh 회전 race(single-flight).
- Python `apps/parser` — 컷오버까지 dev 가동 후 제거.

### 착수 시 기본값(권장, 변경 가능)
- 브랜치: `ts-only`(생성됨). · WDK: 최소 적용(긴 작업만). · Codex 토큰 저장소: **DB row**. · 추출: readability+JSON-LD(Phase 1 스파이크로 trafilatura 대비 검증).

## 4. 스키마 변경 (drizzle, 신규 마이그레이션; prod 적용은 사용자 승인 후)
- **sources**: `vendor varchar(50)` nullable + `INDEX(vendor)`. 값: `'openai'|'anthropic'|'google'|'meta'|'naver'|'kakao'`(비벤더=NULL).
- **reports**: `vendor varchar(50) NOT NULL DEFAULT ''` + `INDEX(vendor)`. **UNIQUE 키를 `(kind,period_start,period_end,lang)` → `(kind,period_start,period_end,lang,vendor)`로 교체.**
  - ⚠️ NULL 대신 `DEFAULT ''`: MySQL UNIQUE는 NULL을 distinct 취급 → 전역 리포트('') idempotency 보존.
- `reportKind`는 `['daily','weekly']` 유지(벤더는 직교 차원).
- Python `db/models.py`도 동기화(`Source.vendor`, `Report.vendor`) — 단, 컷오버 전까지 Python이 write 정본이면 Python 측도 vendor 인지 필요(또는 Next가 vendor write 담당하고 Python은 무관 컬럼 무시).

## 5. 단계별 체크리스트
### Phase 0 — 셋업 ✅ (이 세션 완료)
- [x] `ts-only` 브랜치 신설(dev 무중단).
- [x] 리서치 docs/ 정리(`docs/research/*` 5종) + `docs/sources.md` + PROCESS + 이 플랜 + acknowledge.
- (미커밋 — 사용자 요청 시 커밋.)

### Phase 1 — 스택 검증 슬라이스
- [ ] **추출 품질 스파이크**(최우선 리스크): 실제 소스 기사로 `@mozilla/readability`(+JSON-LD) vs Python trafilatura 추출 길이 비교 → readability 채택 가부 정량 결정.
- [ ] `apps/web` Vercel Pro/Fluid 설정 + `vercel.json` cron 1개 스텁(시크릿 가드).
- [ ] 가장 단순한 파이프라인 1개(collect 또는 keywords)를 `lib/pipeline`+`app/api/cron`으로 TS 포팅 → drizzle write 로컬+Vercel 프리뷰 검증.
- [ ] WDK 필요성 실측(리포트 단일 콜이 800s 내인지).

### Phase 2 — 워커 파이프라인 TS 포팅
- [ ] LLM 클라 TS(Codex backend[정본 doc] + Ollama Cloud). **Codex 토큰 저장소 DB화** + 회전 race.
- [ ] fetch/추출 TS(브라우저 없음 + JSON-LD 폴백). 소스별 디스패치(RSS / Qiita API).
- [ ] 단계 포팅: collect → keywords(60/run) → evolve → report(kind/lang) → translate(60/run) → catchup(하트비트 **DB**). 각 `app/api/cron/<task>` + `vercel.json` 스케줄.
- [ ] 긴 작업만 WDK: translate 백로그 드레인(self-loop/sleep), report 다국어·벤더 팬아웃.

### Phase 3 — 소스 개편 + 기업 소식
- [ ] 소스 시드 TS화(`docs/sources.md` 표 그대로). Anthropic→tim, 추가군 −arXiv.
- [ ] **Qiita → API v2**(403 테스트 후, `body` 전문 + `likes_count:>N` 노이즈 필터, 토큰 옵션). RSS·기사페치 제거.
- [ ] **Meta 피드 확정**(공식 RSS 없음 → RSSHub 라우트/스크래퍼/sitemap; Anthropic-tim 방식 참고).
- [ ] `sources.vendor` 분류(6벤더). Naver=`d2.naver.com/d2.atom` 신규 추가.
- [ ] **기업 소식 페이지**(`/companies` 또는 `/vendors`): 탭 = [종합 리포트] + 벤더 6탭.
  - 종합 리포트 탭: `reports where vendor='all'` 최신 일간/주간(ko) — `ReportBody` 재사용.
  - 벤더 탭: `source.vendor=...` 기사 — `useInfiniteQuery`+cursor+`article-card` 재사용.
  - `site-nav`에 "기업 소식" 링크(리포트/기사 다음).
- [ ] **기업 종합 리포트 생성**: 전 벤더 기사 결합 → 한국어 일간+주간(`reports.vendor='all'`), cron 추가.

### 컷오버
- [ ] dev(Python)와 Next 앱 수집·리포트 결과 대조 → `apps/parser`·`docker/compose` 제거.

## 6. 리스크 / 주의
- **추출 품질 회귀**(trafilatura→readability): Phase 1 스파이크로 선검증. 안 좋으면 소스별 API 우선/유지.
- **Codex 토큰 on Vercel**: 영속 FS 없음 → DB/KV + 회전 race. ToS상 자동요청 빈도 관리.
- **로컬 Ollama 부재**(Vercel): Cloud+Codex 2-provider, 둘 다 죽으면 그 회차 실패(다음 cron 재시도).
- **WDK public beta**: 1st-party지만 beta — 핵심 경로는 평범한 cron 우선.
- **prod DB 공유**: 마이그레이션 수동 리뷰 + 사용자 승인. 신규 컬럼 additive.
- **무중단 원칙**: dev/Python 깨지 않음. 컷오버 전 Next 앱 write는 비활성/분리 검증(이중 write 충돌 방지).
- **API-403 원칙**: 새 API 붙이기 전 항상 403/거부 실측.

## 7. 검증
- Phase별 `tsc --noEmit` + Vercel 프리뷰 + DB read/write 스모크 + 추출 길이 비교 + cron route 실행.
- 컷오버 전 dev(Python) vs Next 앱 결과 대조.

## 8. 현재 상태 / 이어받기
- 브랜치 `ts-only`, HEAD `565eef6`(Codex provider — `origin dev`엔 12:54 KST launchd가 push 예정). docs는 미커밋.
- 다음 액션: **Phase 1 추출 스파이크** 또는 사용자 지시. (`docs/PROCESS.md` 체크리스트 참조.)
