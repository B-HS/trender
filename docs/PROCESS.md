# PROCESS — Trender 단일 Next.js 통합 (Vercel Pro)

> 베이스 룰: 루트 `CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*`.
> **새 세션 진입점: `docs/README.md`.** 자립형 플랜: `docs/MIGRATION-PLAN.md` · 소스 정본: `docs/sources.md` · 결정 트레일: `docs/acknowledge/session-2026-06-nextjs-migration.md` · 근거: `docs/research/*`.
> 브랜치: **`ts-only`** (dev/Python 컨테이너는 컷오버까지 무중단 유지).

## 결정 (사용자 확정)
- **Python 삭제 → 전부 단일 Next.js 앱으로 통합, Vercel Pro 배포.** Hono 불필요(웹 재작성/RSC 손실 회피).
- 긴 작업만 **Vercel WDK**(`workflow-sdk.dev`, 1st-party durable). 핵심 경로는 평범한 Vercel Cron(Pro: 빈도 무제한, 800s).
- **stealth 브라우저(CloakBrowser) 제거** — CF 전수 감사 결과 일관 차단 0건(`docs/research/cloudflare-audit.md`). 추출은 trafilatura→JSON-LD 폴백(TS는 readability).
- **네비 3메뉴: 리포트 / 기사 / 기업 소식.** 기업 소식 = [종합 리포트] 탭 + 벤더 6탭(각 벤더 글).
- **벤더 6: OpenAI·Anthropic·Google(DeepMind+Research)·Meta·Naver·Kakao.** `sources.vendor` 컬럼.
- **기업 종합 리포트**: 전 벤더 결합, 일간+주간, **한국어만**(원문 무관 입력→ko). `reports.vendor`(''=전역, 'all'=종합).
- **소스 개편**: Anthropic→tim-hilde 피드, 추가군 −arXiv. **Qiita→공식 API v2**(403 테스트 통과, body 전문+likes_count 필터). Meta 공식 RSS 없음→RSSHub/스크래퍼/sitemap.
- **API 우선 원칙**: 가져올 수 있으면 API가 베스트, 단 **채택 전 403/거부 테스트 필수**(Qiita/Zenn/GeekNews 통과).

## 핵심 제약
- prod DB 공유(`packages/db` drizzle 단일 출처) → 마이그레이션 수동 리뷰 + 사용자 승인 후. 신규 컬럼 additive.
- Vercel: mysql2=Node 런타임 강제, 로컬 Ollama 없음(Cloud+Codex 2-provider), Codex 토큰은 DB/KV(영속 FS 부재).
- 요청 전 commit/push 금지, 커밋 author 단독·co-author 금지.

## 체크리스트
- [~] **Phase 0** — `ts-only` 브랜치 신설(완료). 리서치 docs/ 정리(완료: cloudflare-audit·source-probe·browser-removal-and-extraction·codex-chatgpt-protocol·vercel-nextjs-feasibility). PROCESS 갱신(이 파일).
- [ ] **Phase 1** — Vercel Pro/Fluid + vercel.json cron 스텁. 파이프라인 1개 TS 슬라이스(drizzle write 검증). **추출 품질 스파이크**(readability vs trafilatura). WDK 필요성 실측.
- [ ] **Phase 2** — LLM 클라(Codex+Ollama Cloud) TS + 토큰 DB화. fetch/추출 TS. collect/keywords/evolve/report/translate/catchup → cron route. 긴 작업 WDK.
- [ ] **Phase 3** — 소스 시드 TS(Qiita API·Meta 확정·추가군). vendor 분류. 기업 소식 페이지(종합 탭+벤더 탭). reports.vendor + 종합 리포트 일간/주간 생성.
- [ ] **컷오버** — dev(Python)와 결과 대조 후 `apps/parser`·compose 제거.

## 직전 완료 작업 (커밋 `565eef6`, ts-only/dev)
- **Codex(ChatGPT) OAuth provider** — `openai_oauth.py`를 ChatGPT 백엔드 Responses(SSE)로 재작성, 라이브 검증(gpt-5.4/5.4-mini/5.5 + 키워드 JSON). 정본: `docs/research/codex-chatgpt-protocol.md`. **TS 포팅 시 재사용.**
- 12:54 KST launchd 1회 트리거가 `origin dev` push 예정(머신 레벨, 세션 무관). 커밋 timestamp도 12:54로 맞춤.

## 이력 (완료, 압축)
- 로그인(username 세션) + 책갈피(기사/리포트) — `users/sessions/favorites` 스키마(마이그레이션 0006 적용), `app/api/auth/*`·`app/api/favorites`, `use-auth`/`use-favorites`, auth-provider/login-dialog/favorite-button. typecheck 통과.
- 캐싱: Cache Components(PPR) 도입 후 fallback 깜빡임으로 **순수 SSR 복귀**(캐싱만 제거). 재제안 금지.
- `/api/auth/me` 익명 401 → `ok(null)`(200) silent 처리.
