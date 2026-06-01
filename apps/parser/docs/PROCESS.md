# PROCESS — 리포트 미생성 근본 수정

기준 문서: 루트 `~/.claude/CLAUDE.md` + `convention/*`, 본 저장소 `docs/bug/report-not-generated-429.md`

## 작업: daily/weekly 리포트 미생성 근본 수정

- [x] a. 원인 규명 — ollama-cloud 429 + fallback(`LLM_PROVIDERS=ollama_cloud` 단일) 미구성. cron 은 정상(KST). 상세 → `docs/bug/report-not-generated-429.md`
- [x] b. fallback 복구 — `.env.local` 에 `ollama_local` 추가, `OLLAMA_HOST/MODEL/NUM_CTX` 설정. 호스트 Ollama(`qwen3.6:latest`) 사용
- [x] c. 로컬 클라이언트 보강 — `OllamaLocalClient` num_ctx/timeout, `config.py` 설정 필드, `chain.py` 주입, `entrypoint.sh` env dump
- [x] d. 프롬프트 크기 캡 — `report.py _cap_articles`(per-article 2000자, 합계 50000자), `report.articles_capped` 로깅
- [x] e. daily backfill off-by-one 수정 — `range(0, days)` 로 어제치 당일 재시도 포함
- [x] f. 검증 — `py_compile`/`bash -n` 통과. 체인에 `ollama-cloud`,`ollama-local` 둘 다 등록 확인
- [x] g. docker rebuild & up — env 반영 확인(`/etc/trender.env`)
- [x] h. 누락분 수동 backfill — daily(14일) generated=3·failed=0(5-31 ko/ja/en). weekly(8주) generated=6·failed=0(5-25~5-31 ko/ja/en 신규). 교차검증: 5-18~5-31 daily ko/ja 완비, en 은 기사 있는 날만(정상), weekly 최근 2주 3언어 완비

## 후속 (미착수)
- `_cap_articles` 최근순 편중 → 기간 균등 샘플링
- 캡으로 인한 cloud 리포트 입력 기사 수 감소(품질 트레이드오프) 재검토
