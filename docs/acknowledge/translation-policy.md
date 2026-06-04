# 번역 정책 — 새 기사만 번역, 기존분은 "(번역 없음)"

## 대상
- apps/parser/src/trender/pipeline/translate.py
- apps/web/components/article-body.tsx, apps/web/app/articles/[id]/page.tsx
- articles.translated_at / articles.content_translated_ko

## 결정 (사용자 확정)
- 비한국어(ja/en) 기사를 **수집 시점에 한국어로 번역**해 저장(gemma 경량 모델).
- 기존 백로그(약 2,200건)는 **번역하지 않는다**(2,195건×2콜 ≈ 18시간, 비용 과다).
  → 5건만 검증 번역, 나머지는 **스킵 처리**.
- 화면에서 번역이 없는 비한국어 기사는 본문 위에 **"(번역 없음)"** 만 표시.

## translated_at 의미 (중요)
- `translated_at` = "번역 파이프라인이 이 기사를 **처리 완료**(번역했거나 의도적으로 스킵)"한 마커.
- `content_translated_ko` 의 존재 여부 = 실제 번역본 유무.
- `translate_pending` 는 `lang<>'ko' AND translated_at IS NULL` 인 기사만 처리 → **새로 들어오는 기사만** 번역됨.

## 스킵 처리 (1회성, 적용 완료)
```sql
UPDATE articles SET translated_at = NOW()
WHERE lang <> 'ko' AND translated_at IS NULL AND content_translated_ko IS NULL;
-- 결과: 2,194행 스킵, pending 0
```

## UI 분기 (article-body.tsx)
- `content_translated_ko` 있음 → `[원문]/[번역글]` 토글
- 비한국어 + 번역 없음 → "(번역 없음)" + 원문
- 한국어 → 원문만
