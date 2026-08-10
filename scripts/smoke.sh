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
# One deadline for the whole run, set before the first probe. A fixed preflight
# would spend its own seconds outside SMOKE_TIMEOUT against a listener that
# accepts and never answers.
deadline=$(($(date +%s) + timeout_seconds))
budget() {
  local left=$((deadline - $(date +%s)))
  [ "$left" -lt 1 ] && left=1
  [ "$left" -gt 5 ] && left=5
  echo "$left"
}

if probe "$(budget)" 2>/dev/null; then
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

# wrangler dev spawns workerd children; the negative pid signals the group.
# TERM then KILL, because a wrapper that ignores TERM would otherwise leave this
# waiting forever on every exit path — and `wait` returns when the wrapper goes,
# which is not the same as the listener going.
cleanup() {
  local status=$?
  [ -n "$server_pid" ] || return "$status"
  kill -- "-$server_pid" 2>/dev/null || kill "$server_pid" 2>/dev/null || true
  for _ in 1 2 3 4 5; do
    kill -0 -- "-$server_pid" 2>/dev/null || break
    sleep 1
  done
  kill -9 -- "-$server_pid" 2>/dev/null || kill -9 "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
  # A warning here would be swallowed: an EXIT trap keeps the pre-trap status, so
  # a passing contract run would still exit 0 with a listener left behind — the
  # next run then finds the port busy and blames the wrong thing.
  if probe 2 2>/dev/null; then
    echo "smoke: port $port is still serving after teardown; the worker escaped its process group." >&2
    exit 1
  fi
  return "$status"
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
# that accepts and never answers. The deadline was set before preflight.
ready=""
while :; do
  [ -n "$interrupted" ] && {
    echo "smoke: interrupted during boot" >&2
    exit 130
  }
  kill -0 "$server_pid" 2>/dev/null || fail_with_log "wrangler dev exited during boot."
  [ $((deadline - $(date +%s))) -gt 0 ] || break
  if probe "$(budget)"; then
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
