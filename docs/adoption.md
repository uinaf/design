# Adopting the design system in a product repo

Two things to wire up: the stylesheet, and the adherence lint. Agent guidance is
not wired up here — it ships with the package.

## 1. Install

```sh
npm i -D @uinaf/design
```

```css
@import "@uinaf/design/css";
```

With no bundler, link `node_modules/@uinaf/design/dist/css/tokens.css` — a
browser does not resolve a bare specifier. Berkeley Mono is licensed and loads
from `cdn.uinaf.dev`; the stylesheet already imports it.

## 2. The lint

Add the binary as a script, so the command resolves from `node_modules/.bin`
rather than the public registry:

```json
{ "scripts": { "design:check": "design-check src" } }
```

Point it at wherever the UI lives — `src`, `app`, `components`. Multiple paths
are fine: `design-check src app`.

Exit code is 0 clean, 1 with errors. Run it in CI, and make it the finish gate
for whatever agent works in the repo: red is not done, and neither is silencing
it.

## Starting from a repo that already has violations

`design:check` will be red before you change anything. Do not fix the whole
codebase.

Record the baseline **on a clean tree, before making changes** — running it
afterward bakes your own new violations into the baseline and the ratchet will
never catch them:

```sh
npm run design:check -- --update-ratchet
git add .design-ratchet.json
```

Then switch the script to ratchet mode:

```json
{ "scripts": { "design:check": "design-check src --ratchet" } }
```

It now fails only when a violation count _rises_, so the existing backlog can
migrate gradually instead of blocking every change. When a count falls, the check
says so; re-record to lock the improvement in.

When a new release adds a rule, the baseline has no entry for it, so every
existing instance reads as a rise from zero and `--ratchet` fails on the upgrade.
That is not the code getting worse. Read the new rule, then re-record on a clean
tree. Warnings count toward the ratchet as well as errors, so this applies even
to a rule that never fails a plain run.

The ratchet is a non-increasing count, not a clean bill of health: removing one
`radius-ceiling` and adding another leaves the count at one and passes. It stops
the codebase getting worse, which is the point during a migration — it does not
certify that new work is clean.

For that, add `--changed`, which checks only the files the branch touched:

```json
{
  "scripts": {
    "design:check": "design-check src --ratchet",
    "design:check:changed": "design-check --changed"
  }
}
```

It covers all three ways a file can be changed — committed against the base
branch, edited but not committed, and untracked — and enumerates through git, so
a filename containing a space survives. Override the base with `--base <ref>`.

Use whichever matches how strict the repo should be.

## Agent guidance

Nothing to paste. The rules live in the skill at `skills/uinaf-design/` inside
the package, and every artifact an agent needs is a document on
[design.uinaf.dev](https://design.uinaf.dev) — reference screens, pattern markup,
tokens, the spec. The guide also answers MCP at `https://design.uinaf.dev/mcp`,
read-only and unauthenticated, which saves an agent from constructing those URLs
itself.

Registering the skill and the MCP server is harness provisioning, so it belongs
wherever the machine's agent config lives, not in a product repo.

## Checking it works

1. `npm run design:check` — passes on a clean tree
2. Add `<div style="border-radius: 20px">` to a page — the check fails with the
   file, line, and the fix
3. Ask an agent to build a screen — it should fetch a pattern rather than writing
   markup from memory, and refuse to finish while the check is red
