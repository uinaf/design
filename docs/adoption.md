# Adopting the design system in a product repo

Three pieces, pasted once. After this, an agent working in the repo fetches
patterns instead of inventing them, and cannot finish a task while design
adherence is red.

## 1. Install

```sh
npm i -D @uinaf/design
```

Then add the script. Everything below invokes it by name, so the binary always
resolves from `node_modules/.bin` rather than the public registry:

```json
{
  "scripts": {
    "design:check": "design-check src"
  }
}
```

Point it at wherever your UI lives — `src`, `app`, `components`. Multiple paths
are fine: `design-check src app`.

## 2. AGENTS.md block

Paste into the repo's `AGENTS.md` or `CLAUDE.md`.

```md
## design system (uinaf)

This repo's UI is uinaf-branded.

1. **Never write uinaf UI from memory.** Fetch the pattern first:
   `https://design.uinaf.dev/components.json` to find it, then
   `/patterns/<name>.md` for the markup. Copy it and adapt the content — do not
   reinterpret the design. If the `design-uinaf` MCP server is connected, prefer
   its tools: `get_pattern`, `get_tokens`, `search_guidelines`, `list_patterns`.
2. **Styles come from `@uinaf/design`.** `@import "@uinaf/design/css";` gives
   tokens and every `u-*` class. Take exact values from `/tokens.json` when
   writing custom CSS. No raw hex, no radius over 6px, no shadows, one accent per
   view, type only from the scale (10/11/13/14/16/20/24/32/40).
3. **Copy is lowercase** except micro-labels and abbreviations — `PR` not `pr`,
   and `CLI`, `URL`, `AI`, `API`.
4. **Product nav is ONE 56px `.u-topbar` row**, and its shell class repeats on the
   page's main content wrapper so both share one gutter. Never stack rows.
5. **Done means `npm run design:check` passes.** Red is not done, and neither is
   silencing it.
```

Add repo-specific abbreviations to point 3 if the product has them (`HLS`, `R2`,
`TCC`). Everything else is copy-pasteable as-is.

## 3. MCP server

Add to the repo's `.mcp.json`, or register it at user level:

```json
{
  "mcpServers": {
    "design-uinaf": {
      "type": "http",
      "url": "https://design.uinaf.dev/mcp"
    }
  }
}
```

Read-only and unauthenticated. Confirm it answers:

```sh
curl -s -X POST https://design.uinaf.dev/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2026-07-28","capabilities":{},"clientInfo":{"name":"probe","version":"1"}}}'
```

The site works without MCP — every tool is a thin wrapper over a URL an agent can
fetch directly. MCP saves the agent from constructing those URLs itself.

## 4. Stop-hook

The instructions above persuade. This one guarantees. Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npm run --silent design:check || { echo 'design adherence failing — fix before finishing' >&2; exit 2; }"
          }
        ]
      }
    ]
  }
}
```

Exit code 2 blocks the turn and feeds stderr back to the agent, so it sees the
violations and fixes them rather than stopping.

It fails closed. Every one of these blocks:

| situation                            | exit |
| ------------------------------------ | ---- |
| clean                                | 0    |
| a violation is present               | 2    |
| the `design:check` script is missing | 2    |
| `@uinaf/design` is not installed     | 2    |

A misconfigured hook cannot quietly pass.

## Adopting in a repo that already has violations

`design:check` will be red before you change anything. Do not fix the whole
codebase, and do not remove the hook.

Record the baseline **on a clean tree, before making changes** — running it
afterwards bakes your own new violations into the baseline and the ratchet will
never catch them:

```sh
npm run design:check -- --update-ratchet
git add .design-ratchet.json
```

Then switch the script to ratchet mode:

```json
{
  "scripts": {
    "design:check": "design-check src --ratchet"
  }
}
```

It now fails only when a violation count _rises_, so the existing backlog can
migrate gradually instead of blocking every change. When a count falls, the check
says so; re-record to lock the improvement in.

Be clear about what this does and does not guarantee. It is a non-increasing
count, not a clean bill of health: removing one `radius-ceiling` and adding
another leaves the count at one and passes. It stops the codebase getting worse,
which is the point during a migration — it does not certify that new work is
clean.

For that, run the strict check against what you actually changed, and keep the
ratchet as the repo-wide floor:

```json
{
  "scripts": {
    "design:check": "design-check src --ratchet",
    "design:check:changed": "design-check $(git diff --name-only --diff-filter=d HEAD | grep -E '\\.(css|html|jsx|tsx)$' | tr '\\n' ' ')"
  }
}
```

Point the Stop-hook at whichever matches how strict you want the repo to be.

## Checking it works

1. `npm run design:check` — passes on a clean tree
2. Add `<div style="border-radius: 20px">` to a page — the check fails with the
   file, line, and the fix
3. Ask an agent to build a screen — it should fetch a pattern rather than writing
   markup from memory, and refuse to finish while the check is red
