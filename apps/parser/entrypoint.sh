#!/usr/bin/env bash
set -euo pipefail

mkdir -p /var/log
touch /var/log/trender.log

cat > /usr/local/bin/trender-run <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
shopt -s expand_aliases
if [[ "${1:-}" == "report" ]]; then
  shift
  exec /opt/venv/bin/trender --task report "$@"
fi
TASKS=()
for arg in "$@"; do
  TASKS+=("$arg")
done
for task in "${TASKS[@]}"; do
  /opt/venv/bin/trender --task "$task" || echo "[trender-run] task $task failed (continuing)"
done
EOF
chmod +x /usr/local/bin/trender-run

# Ensure seeds are synced once on boot
/opt/venv/bin/trender --task seed || echo "[entrypoint] seed sync failed (continuing)"

# Run cron in foreground, but also tail the log so docker logs see output
cron
tail -F /var/log/trender.log
