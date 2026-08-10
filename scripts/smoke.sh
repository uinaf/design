#!/usr/bin/env bash
# Boots the Worker, runs the MCP contract against it, and always tears it down.
#
# `scripts/smoke-mcp.ts` assumes a server is already listening, so nothing —
# not verify, not CI — could run it. It went two releases asserting that some
# patterns still had no markup, which stopped being true at #33. A check with
# no runner does not fail; it rots. This script is the runner.
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

if curl -sf -o /dev/null "http://127.0.0.1:$port/" 2>/dev/null; then
  echo "smoke: something already serves port $port." >&2
  echo "       Stop it, or set SMOKE_PORT to a free port." >&2
  exit 1
fi

server_pid=""
cleanup() {
  [ -n "$server_pid" ] || return 0
  # wrangler dev spawns workerd children; the negative pid signals the whole
  # group so a failed run leaves no listener behind for the next one.
  kill -- "-$server_pid" 2>/dev/null || kill "$server_pid" 2>/dev/null || true
  wait "$server_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

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

ready=""
for _ in $(seq 1 "$timeout_seconds"); do
  kill -0 "$server_pid" 2>/dev/null || fail_with_log "wrangler dev exited during boot."
  if curl -sf -o /dev/null "http://127.0.0.1:$port/"; then
    ready=1
    break
  fi
  sleep 1
done
[ -n "$ready" ] || fail_with_log "no answer on http://127.0.0.1:$port after ${timeout_seconds}s."

set +e
node scripts/smoke-mcp.ts "http://127.0.0.1:$port" 2>&1 | tee "$artifacts/smoke-mcp-$port.log"
status=${PIPESTATUS[0]}
set -e
exit "$status"
