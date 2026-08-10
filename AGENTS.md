# AGENTS.md

`@uinaf/design` — public tokens, CSS primitives, preview cards, and the guide at design.uinaf.dev.

## Tracker

[design → attach](https://github.com/orgs/uinaf/projects/1)

## Invariants

- Never commit Berkeley Mono binaries or a `fonts/` directory.
- Font URLs in tokens must stay on `https://cdn.uinaf.dev/fonts/berkeley-mono/...`.
- CSS source is the pair `src/tokens.css` + `src/components.css`; `tokens.css` `@import`s the other, so consumers import one file and the two must stay side by side in `dist/css/` and `guide/`.
- Handoff CSS is adopted **content-verbatim, formatter-normalized** — `vp fmt` owns layout, hex casing, and trailing zeros. Never add `src/*.css` to a formatter ignore to preserve upstream byte formatting.
- `dist/tokens.json` is generated. Every custom property must match a rule in `groupRules` (`scripts/build.ts`); an ungrouped token fails the build by design.
- Spec: `DESIGN.md`. Skill: `skills/uinaf-design/` — a published artifact, not a skill this repo consumes. Lint it with `pnpm run skill:lint`.
- Guide static root is `guide/`. `guide/index.html` is hand-authored; `pnpm run guide:sync` refreshes tokens + `guide/preview/` from `preview/` and `guide/pages/` from `pages/`.
- `pages/` holds the six reference screens. Each needs an `@page name="…" description="…"` marker — the sync strips it when publishing and fails the build if it is missing. Pages carry no guide chrome: they already own a topbar, and a second bar would break the one-row rule they exist to demonstrate.
- Keep tracker / GitHub Project links out of the public guide and out of package-facing docs (`README.md`, `DESIGN.md`).

## Commands

```sh
pnpm install --frozen-lockfile   # bootstrap — Node from .node-version, pnpm from packageManager
pnpm run verify                  # the gate CI runs; ends in the real-surface smoke
pnpm run smoke                   # that smoke alone: boots the Worker, calls /mcp, tears it down
```

Prefer `vp` for lint/format/test: `pnpm exec vp check`, `pnpm exec vp test run`.

`pnpm run smoke` syncs the guide, binds port 8788, and always kills the server it started. Set `SMOKE_PORT` to run it from a second worktree; logs land in `.smoke/` (gitignored). Two runs in the _same_ checkout will fight over `guide/` — use a separate worktree, or call `./scripts/smoke.sh` directly once the guide is built.

`pnpm run deploy` publishes the working tree to **production** `design.uinaf.dev`. It is outside `verify` on purpose and must not run unattended — CI deploys from `main` (`.github/workflows/main.yml`). To see your change, run `pnpm run smoke` or `pnpm exec wrangler dev`.

## Pipelines

| Workflow                        | On push to `main`                              |
| ------------------------------- | ---------------------------------------------- |
| `.github/workflows/main.yml`    | verify → secrets → guide deploy (`production`) |
| `.github/workflows/release.yml` | verify → secrets → npm publish (`release`)     |

Do not gate guide deploy on the release job. Credentials for each path are listed in `docs/releasing.md` (vars vs secrets).

## Docs map

| Doc                 | When                                      |
| ------------------- | ----------------------------------------- |
| `README.md`         | package install / consumer usage          |
| `DESIGN.md`         | visual + voice rules                      |
| `CONTRIBUTING.md`   | local setup and verify                    |
| `docs/releasing.md` | npm + guide deploy pipelines              |
| `docs/adoption.md`  | the paste-once drop-in for a product repo |
| skill               | building UI that should feel like uinaf   |
