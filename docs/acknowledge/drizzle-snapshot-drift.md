# drizzle 스냅샷 드리프트 — 0004 마이그레이션 수동 트리밍

## 대상 파일
- packages/db/migrations/0004_puzzling_wolfpack.sql
- packages/db/migrations/meta/*_snapshot.json

## 배경
- `packages/db/migrations/meta` 의 0000~0003 스냅샷이 **실제 프로덕션 스키마와 어긋나** 있었다.
  스냅샷에는 옛 컬럼(`title_ko`, `summary_ko`, `markdown_ko`, `keyword_ko`, `keyword_original`, reports.kind 의 `monthly`)이 남아 있으나,
  실제 적용된 SQL(0002 reset, 0003 drop monthly)과 운영 DB 는 현재 `schema.ts`(lang/title/markdown/keyword/content_original/keywords_extracted_at)와 일치한다.
- 원인: 다른 컴퓨터에서 마이그레이션이 진행되어 스냅샷 메타만 동기화되지 않은 것으로 추정. 사용자가 "현재 DB 가 프로덕션 최신"이라고 확인.

## 결정
- 번역 컬럼 3개(`title_translated_ko`, `content_translated_ko`, `translated_at`)만 추가하면 된다.
- `drizzle-kit generate` 가 낡은 0003 스냅샷과 diff 하여 **이미 존재하는 컬럼을 다시 ADD/DROP** 하는 잘못된 0004 SQL 을 생성했다.
  → 0004 SQL 을 **3개 ADD 문만 남기고 수동 트리밍**했다.
- 단, drizzle 이 새로 만든 **0004 스냅샷은 `schema.ts`(=실제 프로덕션 + 신규 3컬럼)에서 생성된 것이라 정확**하다.
  → 그대로 두면 이후 `generate` 의 기준 스냅샷이 현실과 재정렬되어 드리프트가 해소된다.

## 적용 시 주의
- 운영 DB 에는 `0004` SQL(3개 ALTER ADD)만 적용하면 된다. 0004 이전 마이그레이션은 이미 적용 완료 상태.
- 적용 명령(예): `cd packages/db && bun run drizzle-kit migrate` 또는 직접 SQL 실행. **원격 DB write 이므로 사용자 승인 후 실행.**
