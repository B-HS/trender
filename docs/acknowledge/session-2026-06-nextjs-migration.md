# ACKNOWLEDGE — Next.js 통합 전환 결정 트레일 (2026-06)

> 이 세션에서 내린 판단과 **고려 후 기각한 대안 + 이유**. 새 세션은 이를 재논의하지 말 것(재제안 금지 항목 포함).

## 큰 방향
- **목표 = Python 삭제 + 단일 Next.js 앱(Vercel Pro) 통합.** (사용자 확정.)
- **Hono로 웹 재작성 → 기각.** Hono면 RSC/Server Action 상실(`/articles` 무한스크롤 수동 재구축). 기존 Next.js 유지가 낫다. (한때 `hono` 브랜치 의도였으나 Next.js 유지로 선회 → 브랜치명 `ts-only`.)
- **durable workflow = Vercel WDK(`workflow-sdk.dev`, 1st-party) 채택.** Inngest/Trigger.dev/QStash(서드파티)는 기각 — 1st-party가 zero-config·관리 단순. 단 핵심 경로는 평범한 cron 우선, WDK는 긴 작업만.
- **Vercel 통합 가능성 정정**: 초기엔 "stealth 브라우저·긴 콜 때문에 serverless 부적합"이라 봤으나 → ① CF 전수 차단 0건(브라우저 불필요) ② 파이프라인이 청크형이라 Pro 800s 안에 들어감 → **가능으로 정정**.

## 소스
- **Anthropic 공식 피드(`/news/rss.xml`) 404(죽음)** → `tim-hilde/anthropic-rss`(claude.com 스크랩, 전문) 채택. taobojlen(snippet·stale) 기각.
- **추가군 −arXiv**(사용자 제외). Meta는 추가하되 공식 RSS 없어 피드 확정 보류.
- **Qiita → 공식 API v2 전환** + likes_count 노이즈 필터(403 테스트 통과). RSS 스크랩 폐기.
- **API 우선 원칙**: API 가능하면 API, 단 **403/거부 먼저 테스트**(사용자 강조). Qiita/Zenn/GeekNews 통과.
- dedup은 이미 url UNIQUE로 처리됨 → 별도 dedup 코드 불필요(재구현 금지).

## 브라우저 / 추출
- **CloakBrowser 제거 확정.** 현재 403/cf-mitigated일 때만 호출되는데 차단 0건 = 죽은 코드. JS 렌더 이득도 200 페이지엔 애초 발동 안 함.
- "브라우저 없이 JS 렌더"는 불가(엔진 필수)이나 **필요 없음** — 8/9 소스가 정적 추출됨. 폴백 = trafilatura(또는 TS readability)→JSON-LD→semantic. `__NEXT_DATA__` 재귀 grep은 오삽입 위험으로 기각. KakaoTech(SPA)만 얇게 남김(허용).

## 리포트 / UI
- **메뉴 3개: 리포트 / 기사 / 기업 소식**(사용자 지정). 기업 소식 = [종합 리포트] 탭 + 벤더 6탭.
- **기업 리포트 = 종합(전 벤더 결합) 일간+주간, 한국어만**(사용자 확정). per-vendor 개별 리포트는 스키마(`reports.vendor`)로 지원하되 후속 옵션.
- `reports.vendor`는 `NOT NULL DEFAULT ''`(MySQL UNIQUE NULL distinct 함정 회피).

## Codex provider (이번 세션 구현 완료)
- 기존 `openai_oauth.py`가 `api.openai.com/v1/chat/completions`(API키 경로)라 ChatGPT 로그인 토큰으로 동작 안 함 → **ChatGPT 백엔드 Responses(SSE)로 재작성, 라이브 검증.** 정본 `docs/research/codex-chatgpt-protocol.md`. 커밋 `565eef6`(12:54 KST launchd가 `origin dev` push 예정).
- `_CLIENT_ID="app_EMoamEEZ73f0CkXaXp7hrann"`는 공개 OAuth client_id(시크릿 아님).

## 재제안 금지 (이미 결정/기각)
- SSR 유지(PPR/Cache Components 재도입 금지 — 이전 결정).
- Hono로 웹 재작성, 서드파티 durable workflow, arXiv 추가, url dedup 재구현, `__NEXT_DATA__` 재귀 grep 추출.
