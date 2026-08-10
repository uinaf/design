#!/usr/bin/env bash
# Boots the Worker, runs the MCP contract against it, and always tears it down.
#
#   SMOKE_PORT       port to bind (default 8788; set it per worktree)
#   SMOKE_TIMEOUT    seconds to wait for the worker to answer (default 90)
#   SMOKE_ARTIFACTS  directory for the server and smoke logs (default .smoke)
set -euo pipefail

port="${SMOKE_PORT:-8788}"
timeout_seconds="${SMOKE_TIMEOUT:-90}"
artifacts="${SMOKE_ARTIFACTS:-.smoke}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."
mkdir -p "$artifacts"
server_log="$artifacts/wrangler-$port.log"
client_log="$artifacts/smoke-mcp-$port.log"

probe() { curl -sf --connect-timeout "$1" --max-time "$1" -o /dev/null "http://127.0.0.1:$port/"; }

if probe 5 2>/dev/null; then
  echo "smoke: something already serves port $port." >&2
  echo "       Stop it, or set SMOKE_PORT to a free port." >&2
  exit 1
fi

# guide/design.md is gitignored and written by machine-layer.ts, so on a clean
# checkout search_guidelines has nothing to read.
if [ ! -f guide/design.md ]; then
  echo "smoke: guide assets are missing; building them first"
  if ! pnpm run guide:sync >"$artifacts/guide-sync.log" 2>&1; then
    echo "smoke: guide:sync failed. Last lines of $artifacts/guide-sync.log:" >&2
    tail -20 "$artifacts/guide-sync.log" >&2
    exit 1
  fi
fi

server_pid=""
client_pid=""
interrupted=""

cleanup() {
  [ -n "$server_pid" ] || return 0
  # wrangler dev spawns workerd children; the negative pid signals the group.
  kill -- "-$server_pid" 2>/dev/null || kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
# Bash defers a trap until the foreground command returns, so the client runs in
# the background and the handler kills it. In the foreground, a stalled client
# held SIGTERM until it finished and left workerd listening.
on_signal() {
  interrupted=1
  [ -n "$client_pid" ] && kill "$client_pid" 2>/dev/null
  return 0
}
trap cleanup EXIT
trap on_signal INT TERM

set -m
pnpm exec wrangler dev --port "$port" >"$server_log" 2>&1 &
server_pid=$!
set +m

fail_with_log() {
  echo "smoke: $1" >&2
  echo "       last lines of $server_log:" >&2
  tail -20 "$server_log" >&2
  exit 1
}

# A deadline, not an iteration count: each probe can spend seconds on a worker
# that accepts and never answers.
ready=""
deadline=$(($(date +%s) + timeout_seconds))
while :; do
  [ -n "$interrupted" ] && {
    echo "smoke: interrupted during boot" >&2
    exit 130
  }
  kill -0 "$server_pid" 2>/dev/null || fail_with_log "wrangler dev exited during boot."
  remaining=$((deadline - $(date +%s)))
  [ "$remaining" -gt 0 ] || break
  if probe $((remaining < 5 ? remaining : 5)); then
    ready=1
    break
  fi
  [ $((deadline - $(date +%s))) -gt 0 ] || break
  sleep 1
done
[ -n "$ready" ] || fail_with_log "no answer on http://127.0.0.1:$port after ${timeout_seconds}s."

set +e
node scripts/smoke-mcp.ts "http://127.0.0.1:$port" >"$client_log" 2>&1 &
client_pid=$!
wait "$client_pid"
status=$?
set -e
cat "$client_log"

if [ -n "$interrupted" ]; then
  echo "smoke: interrupted" >&2
  exit 130
fi
exit "$status"
