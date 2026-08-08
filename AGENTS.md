# AGENTS.md

`@uinaf/design` — public uinaf design tokens and guide.

## Tracker

[design → attach](https://github.com/orgs/uinaf/projects/1)

## Rules

- Never commit Berkeley Mono binaries or a `fonts/` directory.
- Tokens must reference `https://cdn.uinaf.dev/fonts/berkeley-mono/...`.
- Spec lives in `DESIGN.md`; agent skill in `.agents/skills/uinaf-design/`.
- Guide static root is `guide/` (synced from `preview/` + tokens).

## Toolchain

Vite+ (`vp`). Prefer `vp run verify`, `vp check`, `vp test run`.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm exec vp run verify
pnpm exec vp run deploy
```
