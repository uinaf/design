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
- Guide static root is `guide/`. `guide/index.html` is hand-authored; `pnpm run guide:sync` refreshes tokens + `guide/preview/` from `preview/`.
- Keep tracker / GitHub Project links out of the public guide and out of package-facing docs (`README.md`, `DESIGN.md`).

## Commands

```sh
pnpm install --frozen-lockfile
pnpm run verify
pnpm run deploy
```

Prefer `vp` for lint/format/test: `pnpm exec vp check`, `pnpm exec vp test run`.

## Pipelines

| Workflow                        | On push to `main`                              |
| ------------------------------- | ---------------------------------------------- |
| `.github/workflows/main.yml`    | verify → secrets → guide deploy (`production`) |
| `.github/workflows/release.yml` | verify → secrets → npm publish (`release`)     |

Do not gate guide deploy on the release job. Credentials for each path are listed in `docs/releasing.md` (vars vs secrets).

## Docs map

| Doc                 | When                                    |
| ------------------- | --------------------------------------- |
| `README.md`         | package install / consumer usage        |
| `DESIGN.md`         | visual + voice rules                    |
| `CONTRIBUTING.md`   | local setup and verify                  |
| `docs/releasing.md` | npm + guide deploy pipelines            |
| skill               | building UI that should feel like uinaf |
