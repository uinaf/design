# AGENTS.md

`@uinaf/design` — public tokens, CSS primitives, preview cards, and the guide at design.uinaf.dev.

## Tracker

[design → attach](https://github.com/orgs/uinaf/projects/1)

## Invariants

- Never commit Berkeley Mono binaries or a `fonts/` directory.
- Font URLs in tokens must stay on `https://cdn.uinaf.dev/fonts/berkeley-mono/...`.
- Spec: `DESIGN.md`. Skill: `.agents/skills/uinaf-design/`.
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
