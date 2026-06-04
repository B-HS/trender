# PROCESS — 로그인(username 세션) + 개인 책갈피(즐겨찾기)

> 베이스 룰: 루트 `CLAUDE.md` + `~/.claude/convention/*` + `~/personal-llm/*`.
> 참고 구현: `/Users/gkn/Deals` (username-only 세션 패턴).

## 결정 (사용자 확정)
- 인증: **Deals식 username-only 세션** (비번/OAuth 없음, 첫 입력 시 자동가입, 쿠키 기반)
- 즐겨찾기: **기사 + 리포트 둘 다** (개인 책갈피)
- **웹 푸시: 제외** (이번엔 안 함)
- 추가 의존성 0 — 네이티브 `<dialog>` + 평범한 input, drizzle, react-query 만 사용
- **자동 git push 안 함** (사용자가 검토 후 직접 push)

## 핵심 제약
- trender 웹: API routes/hooks/clientFetch 없음(서버액션만) → API 계층 신규 구축
- 스키마는 `packages/db`(drizzle) 단일 출처, 운영 DB 공유 → 신규 테이블은 additive(안전), 검토용으로 적용
- 디자인: 직각 + ring 톤 유지

## 체크리스트
- [x] a. `packages/db/src/schema.ts`: `users`, `sessions`, `favorites` 테이블 + 타입
- [~] b. drizzle 마이그레이션 0006 생성 완료. **DB 적용은 보류**(사용자 검토 후) — 분류기가 prod write 차단
- [x] c. `apps/web/lib/api.client.ts`(clientFetch), `lib/query-keys.ts`(QUERY_KEY)
- [x] d. `apps/web/lib/auth/session.ts`: createSession/validateSession/deleteSession/getSessionUser
- [x] e. API: `app/api/auth/{login,me,logout}`, `app/api/favorites` (GET 멤버십, POST 추가, DELETE 제거)
- [x] f. hooks: `use-auth`(useMe/useLogin/useLogout), `use-favorites`(useFavorites/useToggleFavorite)
- [x] g. components: `auth/auth-provider`(context+LoginDialog), `auth/login-dialog`(native dialog), `auth/auth-nav`(로그인/유저), `favorite-button`
- [x] h. 와이어링: layout에 AuthProvider, site-nav에 AuthNav + 즐겨찾기 링크, 기사·리포트 카드/상세에 FavoriteButton
- [x] i. `app/favorites/page.tsx`: 저장한 기사/리포트 목록(서버 컴포넌트, getSessionUser + join)
- [x] j. typecheck 통과(web/db/ui). **commit·push 안 함**(사용자가 직접)

## 캐싱 — Cache Components(PPR) 도입 후 되돌림 (SSR 복귀)
- 경위: `cacheComponents: true` + `'use cache'` + `<Suspense>`로 전환했으나, PPR은 동적 구멍(`params` 읽는 상세/목록)을 매 요청 정적 셸(fallback="불러오는 중…") 먼저 → 내용 스트리밍하는 구조라 새로고침마다 fallback이 보임. "한번 렌더 → 통째 캐시 → fallback 없이 바로"는 PPR이 아닌 클래식 ISR/SSR의 동작이라, 사용자 결정으로 **캐싱(PPR)만 제거하고 SSR로 복귀**.
- 제거 내역(로그인/즐겨찾기/Analytics는 그대로 유지):
  - `next.config.ts`: `cacheComponents`/`cacheLife` 제거(파일은 .ts 유지).
  - `reports/[id]`·`articles/[id]`: `'use cache'`/`cacheLife`/`cacheTag` 및 `ReportView`/`ArticleView`+`<Suspense>` 래퍼 제거 → 데이터 함수는 plain async, 본문은 async `Page`로 병합.
  - 홈(`/`)·기사목록(`/articles`)·책갈피(`/favorites`): `<Suspense>` 분리 해제 → async `Page`로 병합.
  - `app/api/revalidate/route.ts` 삭제(캐시 없으니 무용), `.env.example`의 `REVALIDATE_SECRET` 제거.
- 빌드 검증: `bun run build` → 모든 콘텐츠 라우트 `ƒ (Dynamic)` 요청 시 SSR, 타입체크 0 에러.

## 401 silent
- `/api/auth/me`: 미로그인 시 `fail(401)` → **`ok(null)`(200)**. 새로고침마다 콘솔/네트워크에 뜨던 401 제거. `useMe`는 `clientFetch<Me | null>`로 그대로 null 수신.
- 즐겨찾기 GET 401은 `useFavorites(Boolean(me))` 게이팅으로 미로그인 시 호출 안 됨 → 추가 대응 불필요.

## 멈춤 포인트
- 백업: `ssr` 브랜치(cfe8c1c) = 캐싱·로그인·즐겨찾기·Analytics 이전의 순수 SSR. 현재 `dev`는 SSR + 로그인/즐겨찾기/Analytics(캐싱만 제거).
- DB 마이그레이션 0006(users/sessions/favorites)은 적용 완료.
- 커밋 author는 사용자 단독, co-author 트레일러 금지(과거 로그 스타일).
