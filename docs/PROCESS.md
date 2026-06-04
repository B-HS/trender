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

## 캐싱 — Cache Components(use cache) + PPR (전환 완료)
- `next.config.ts`(mjs→ts 전환): `cacheComponents: true` + 커스텀 `cacheLife.permanent`(stale 5분 / revalidate 1년 / expire ~395일).
- 상세 페이지(`reports/[id]`, `articles/[id]`): 데이터 fetch를 `'use cache'` 함수로 — `cacheLife('permanent')` + `cacheTag('report'|'article', '<type>:<id>')`. params 접근은 `<Suspense>`로 감쌈(`ReportView`/`ArticleView`).
- 동적 페이지(홈/기사목록/책갈피): searchParams·cookies 접근부를 `<Suspense>` 자식으로 분리.
- 빌드 검증: `bun run build` → `/`,`/articles`,`/articles/[id]`,`/favorites`,`/reports/[id]` 모두 **◐ Partial Prerender**, API는 ƒ Dynamic, 에러 0.
- 캐싱 결과: 정적 셸 즉시 + 상세 데이터는 1회 로딩 후 캐시(Vercel Data Cache, DB 재접속 최소화). 1년 후 또는 수동 무효화 시 갱신.
- **수동 무효화**: `POST /api/revalidate` (헤더 `x-revalidate-secret: $REVALIDATE_SECRET`).
  - 전체 리포트: `{ "type": "report" }` / 특정: `{ "type": "report", "id": 83 }` (article 동일)
  - 임의 태그/경로: `{ "tag": "report:83" }` 또는 `{ "path": "/reports/83" }`
  - 내부적으로 `revalidateTag(tag,'max')` + `revalidatePath` 동시.
- 주의: 로컬 16.1.6은 `revalidateTag(tag, profile)` 2-인자. `updateTag(tag)`는 서버액션 전용 1-인자.

## 멈춤 포인트
- git push 는 사용자가 직접 (자동 금지) — 단 "마이그레이션 끝나면 commit+push는 내가 직접" 지시 받음(과거 로그 스타일, co-author 금지)
- DB 마이그레이션 0006(users/sessions/favorites) 적용은 사용자 검토/진행
