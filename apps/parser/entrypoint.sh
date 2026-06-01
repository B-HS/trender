#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/log
touch /var/log/trender.log

# cron이 spawn하는 자식 프로세스는 컨테이너 env를 못 받으므로 파일로 dump해 둔다.
{
  for var in DATABASE_URL TZ LOG_LEVEL LLM_PROVIDERS \
             OLLAMA_CLOUD_KEY OLLAMA_CLOUD_HOST OLLAMA_CLOUD_MODEL \
             OLLAMA_HOST OLLAMA_LOCAL_MODEL OLLAMA_NUM_CTX OLLAMA_TIMEOUT_SECONDS \
             OMLX_HOST OMLX_MODEL \
             OPENROUTER_API_KEY OPENROUTER_MODEL OPENROUTER_HOST OPENROUTER_APP_TITLE OPENROUTER_REFERER \
             OPENAI_OAUTH_MODEL OPENAI_OAUTH_BASE_URL OPENAI_OAUTH_TOKEN OPENAI_OAUTH_AUTH_FILE \
             FETCH_CONCURRENCY FETCH_TIMEOUT_SECONDS FETCH_PER_SOURCE_LIMIT \
             PLAYWRIGHT_BROWSERS_PATH CLOAKBROWSER_CACHE_DIR; do
    if [ -n "${!var:-}" ]; then
      printf 'export %s=%q\n' "$var" "${!var}"
    fi
  done
} > /etc/trender.env
chmod 600 /etc/trender.env

cat > /usr/local/bin/trender-run <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
if [[ -f /etc/trender.env ]]; then
  source /etc/trender.env
fi
shopt -s expand_aliases
# 추가 옵션(--kind, --days, --force 등)을 받는 task 는 단일 실행으로 처리한다.
case "${1:-}" in
  report|backfill|catchup)
    task="$1"
    shift
    exec /opt/venv/bin/trender --task "$task" "$@"
    ;;
esac
TASKS=()
for arg in "$@"; do
  TASKS+=("$arg")
done
for task in "${TASKS[@]}"; do
  /opt/venv/bin/trender --task "$task" || echo "[trender-run] task $task failed (continuing)"
done
EOF
chmod +x /usr/local/bin/trender-run

mkdir -p /var/log/trender-state

# Ensure seeds are synced once on boot
/opt/venv/bin/trender --task seed || echo "[entrypoint] seed sync failed (continuing)"

# 부팅 시점에 한 번 따라잡기 — sleep 후 docker 가 컨테이너를 재기동한 경우 즉시 누락분 보충
/opt/venv/bin/trender --task catchup --force || echo "[entrypoint] catchup failed (continuing)"

# Run cron in foreground, but also tail the log so docker logs see output
cron
tail -F /var/log/trender.log
