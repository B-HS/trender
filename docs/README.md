# Trender docs — 인덱스 (새 세션 진입점)

> **새 세션은 여기서 시작한다.** 아래 순서로 읽으면 직전 세션(2026-06, Next.js 통합 전환)을 100% 이어받는다.
> 전역 룰(`~/.claude/CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*`)은 자동 로드된다.

## 읽는 순서
1. **`MIGRATION-PLAN.md`** — 자립형 통합 플랜(왜·결정·아키텍처·스키마·Phase 체크리스트·현재 상태). **가장 먼저.**
2. **`PROCESS.md`** — 현재 진행 상태 + 체크리스트(어디까지 했나).
3. **`sources.md`** — 최종 소스 + 벤더 매핑(구현 정본 표).
4. **`acknowledge/session-2026-06-nextjs-migration.md`** — 결정 트레일 + **재제안 금지 항목**.
5. **`research/`** — 근거(실측):
   - `cloudflare-audit.md` — CF 전수(차단 0건 → 브라우저 제거 근거).
   - `source-probe.md` — 소스 실측 + API 403 테스트 + 추출 길이.
   - `browser-removal-and-extraction.md` — 브라우저 제거 체크리스트 + 추출 폴백.
   - `codex-chatgpt-protocol.md` — **Codex(ChatGPT) backend Responses 프로토콜 — TS 포팅 정본.**
   - `vercel-nextjs-feasibility.md` — Vercel Pro 한도·WDK·청크 적합성.
6. **`acknowledge/`**(기존) — `drizzle-snapshot-drift.md`, `translation-policy.md`.

## 한 줄 현황
- 브랜치 **`ts-only`**(dev/Python은 컷오버까지 무중단). HEAD `565eef6`(Codex provider).
- Phase 0(브랜치+docs) 완료, **다음 = Phase 1 추출 품질 스파이크**.
- docs/ 변경은 **미커밋**(요청 전 커밋 금지).

## 핵심 결정 (요약)
단일 Next.js + Vercel Pro 통합 · 긴 작업만 Vercel WDK · stealth 브라우저 제거 · 소스 개편(Anthropic→tim, Qiita→API v2, Meta 피드 TBD, −arXiv) · 메뉴 3(리포트/기사/기업 소식) · 벤더 6(OpenAI/Anthropic/Google/Meta/Naver/Kakao) · 기업 종합 리포트(일간+주간 한국어) · API 우선(단 403 먼저 테스트).
