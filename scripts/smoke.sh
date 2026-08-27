#!/usr/bin/env bash
# Boots the Worker, runs the read contract against it (MCP plus the machine-layer
# routes those tools wrap), and always tears it down.
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
# Readiness asks for a 2xx; teardown asks only whether anything still holds the
# port. An escaped listener that errors, hangs, or hangs up would pass `probe`
# and be reported as removed.
port_bound() { (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; }
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

server_pid=""
client_pid=""
interrupted=""

# wrangler dev spawns workerd children, and a signal to the wrapper alone leaves
# them running. TERM then KILL by group: a wrapper that ignores TERM would
# otherwise leave this waiting forever on every exit path.
stop_group() {
  local pid="$1" signal="${2:-TERM}"
  kill "-$signal" -- "-$pid" 2>/dev/null || kill "-$signal" "$pid" 2>/dev/null || true
}

cleanup() {
  local status=$?
  [ -n "$server_pid" ] || return "$status"
  stop_group "$server_pid" TERM
  for _ in 1 2 3 4 5; do
    kill -0 -- "-$server_pid" 2>/dev/null || break
    sleep 1
  done
  stop_group "$server_pid" KILL
  wait "$server_pid" 2>/dev/null || true
  # A warning here would be swallowed: an EXIT trap keeps the pre-trap status, so
  # a passing contract run would still exit 0 with a listener left behind. The
  # next run then finds the port busy and blames the wrong thing.
  if port_bound; then
    echo "smoke: port $port is still bound after teardown; the worker escaped its process group." >&2
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
pnpm exec wrangler dev --port "$port" --persist-to "$artifacts/wrangler-state" >"$server_log" 2>&1 &
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
# A signal landing between the launch and this assignment finds an empty
# client_pid, so the handler cannot stop the client and `wait` would sit through
# the whole contract before teardown.
[ -n "$interrupted" ] && kill "$client_pid" 2>/dev/null
wait "$client_pid"
status=$?
set -e
cat "$client_log"

if [ -n "$interrupted" ]; then
  echo "smoke: interrupted" >&2
  exit 130
fi
exit "$status"
