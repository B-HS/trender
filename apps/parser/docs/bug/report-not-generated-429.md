# 리포트 미생성 — ollama-cloud 429 + fallback 미구성

## 대상 파일
- `docker/.env.local` (`LLM_PROVIDERS`)
- `src/trender/llm/ollama_local.py` (`OllamaLocalClient`)
- `src/trender/llm/chain.py` (`_build_ollama_local`)
- `src/trender/config.py` (`ollama_num_ctx`, `ollama_timeout_seconds`)
- `src/trender/pipeline/report.py` (`_cap_articles`, `backfill_reports`)
- `apps/parser/entrypoint.sh` (cron env dump)

## 증상
- 어제/그저께 daily 리포트가 비어 있음. weekly 는 ko/ja 가 거의 없음(en 만 존재).
- 기사 본문(`content_original`)은 멀쩡(2000건+). 즉 데이터 문제 아님.

## 원인
1. **리포트 생성 LLM 호출이 ollama-cloud 429(Too Many Requests)로 실패.** 리포트는 키워드 분석과 무관하며, 본문만 있으면 되지만 리포트 본문을 써내는 LLM 호출 자체가 rate limit 에 막힘.
   - 로그: `report.lang_failed ... 'All LLM providers failed: [('ollama-cloud', ...429...)]'`
2. **fallback 이 죽어 있었음.** `config.py` 기본값은 풀 체인(`ollama_cloud,omlx_local,openrouter,openai_oauth,ollama_local`)인데 `.env.local` 이 `LLM_PROVIDERS=ollama_cloud` 단일로 덮어써서, 429 시 떨어질 곳이 없어 `All providers failed` 즉사.
3. **weekly/ja 가 특히 실패.** ja 는 하루 ~120건이라 한 주치 프롬프트가 거대(866건). 프롬프트 크기 무제한이라 큰 호출일수록 실패율↑ (en 은 기사가 적어 성공 → 테이블에 en 만 남던 이유).
4. **daily backfill off-by-one.** `backfill_reports("daily")` 가 `range(1, days+1)` 라 최신 커버 기간이 `today-2`. 어제치(today-1)는 실시간 00:30 cron 한 번만 시도 → 거기서 429 면 다음날까지 재시도 안 됨.

## 참고 (오해였던 점)
- cron 은 정상 작동. 컨테이너 TZ=Asia/Seoul 이라 `30 0 * * *` daily report 는 00:30 KST(=15:30 UTC)에 실제로 실행됨.
- 구조화 로그에 ANSI 컬러코드가 끼어 `grep 'task=report'` 가 빗나가 "안 돈다"고 오판하기 쉬움. `trender.start` 등 색이 안 끼는 토큰으로 grep 할 것.

## 해결
1. `.env.local`: `LLM_PROVIDERS=ollama_cloud,ollama_local`, `OLLAMA_HOST=http://host.docker.internal:11434`, `OLLAMA_LOCAL_MODEL=qwen3.6:latest`, `OLLAMA_NUM_CTX=65536`. → 429 시 호스트 Ollama 로 fallback.
2. `OllamaLocalClient`: `num_ctx`(기본 65536)·`timeout`(기본 600s) 적용. ollama 기본 컨텍스트(~4k)로 잘려 엉터리 리포트가 나오던 문제 차단.
3. `report.py _cap_articles`: per-article `_BODY_CHAR_LIMIT=2000`, 합계 `_MAX_TOTAL_BODY_CHARS=50000` 예산으로 기사 수를 캡(최근순). 로컬 컨텍스트 초과 방지. 캡 발생 시 `report.articles_capped` 로깅(무음 절단 금지).
4. `backfill_reports("daily")` `range(0, days)` 로 변경 → 어제치 당일 재시도 포함.
5. `entrypoint.sh` env dump 목록에 `OLLAMA_NUM_CTX OLLAMA_TIMEOUT_SECONDS` 추가(cron 자식 프로세스가 받도록).

## 알려진 한계 (후속)
- `_cap_articles` 는 최근순 head 절단이라 weekly 에서 마지막 날들에 편중될 수 있음. 기간 전반에 걸친 균등 샘플링은 후속 과제.
- 캡으로 cloud 리포트도 이전(기사 120건 전부)보다 입력 기사 수가 줄어 품질이 다소 낮아질 수 있음. 신뢰성(양 provider 모두 처리 가능) 우선의 트레이드오프.
