# Cloudflare / 봇차단 전수 감사 (2026-06)

## 목적
stealth 브라우저(CloakBrowser) fallback이 실제로 필요한지 판단 — 크롤링 소스 중 plain httpx를 **실제로 차단(403/cf-mitigated)** 하는 곳이 있는지 전수 프로빙.

## 핵심 구분
- **CF 투명 CDN**: cf-ray 헤더는 있으나 200 정상 응답(`__cf_bm` 쿠키만). 콘텐츠 완전 공개.
- **CF 봇 차단**: 403/503 + `cf-mitigated: challenge` + `challenge-platform` 인터스티셜. 이것만 stealth 트리거.

## 결과 (실측, 피드 + 샘플 기사 양쪽)

| 소스 | CF 뒤? | 실제 차단? | 비고 |
|------|:---:|:---:|------|
| Zenn (ai/llm) | ✅ cf-ray | ❌ | HIT/BYPASS, 챌린지 0 |
| Qiita | ❌ (nginx) | ❌ | CF 아님 |
| GeekNews | ❌ (nginx) | ❌ | |
| AItimes.com | ❌ (nginx/Varnish) | ❌ | |
| OpenAI | ✅ cf-ray | ❌ | 피드·기사 8/8 전부 200 |
| Anthropic 원본 | ✅ cf-ray | ❌ | **피드 404(죽음)** — 차단 아님 |
| HuggingFace | ❌ (CloudFront) | ❌ | |
| SimonWillison / Raschka / MarkTechPost / Publickey | ✅ cf-ray | ❌ | 전부 200(투명) |
| DeepMind / GoogleResearch | ❌ (Google Frontend) | ❌ | |
| ITmedia / 요즘IT / KakaoTech / aitimes.kr / NaverD2 | ❌ | ❌ | |

## 결론
- **일관 차단 소스 0건.** OpenAI 기사에서 1회 관측된 403+cf-mitigated는 재현 불가(간헐 — IP 평판/bot-fight 토글성).
- **stealth 브라우저는 현재 죽은 코드** → 제거 가능. 간헐 차단 시 그 회차만 스킵(멱등 재시도)으로 흡수.
- 주의: はてブ(인기 IT)는 외부링크 집계라 기사 도메인이 매번 달라짐 → 그 중 CF차단 사이트가 가변적으로 섞일 수 있음(해당 기사만 스킵).

## 방법
크롤러와 동일한 httpx UA로 피드 GET → `cf-ray`/`server: cloudflare`/`cf-mitigated`/403 판정 → 첫 엔트리 기사 링크도 동일 검사. 스크립트: scratchpad `cf_audit.py`.
