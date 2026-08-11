# AGENTS.md

`@uinaf/design` — public tokens, CSS primitives, preview cards, and the guide at design.uinaf.dev.

## Tracker

[design → attach](https://github.com/orgs/uinaf/projects/1)

## Invariants

- Never commit Berkeley Mono binaries or a `fonts/` directory.
- Font URLs in tokens must stay on `https://cdn.uinaf.dev/fonts/berkeley-mono/...`.
- Every `cdn.uinaf.dev` URL written in `preview/`, `pages/`, or `templates/` must also be declared in the `CDN` export (`src/cdn.ts`) — a test fails on an inline one, because an undeclared URL is a 404 nobody can grep for. The assets live in `uinaf/infra`, so `pnpm run cdn:check` proves they resolve; it is outside `verify` because it needs the network.
- CSS source is the pair `src/tokens.css` + `src/components.css`; `tokens.css` `@import`s the other, so consumers import one file and the two must stay side by side in `dist/css/` and `guide/`.
- Handoff CSS is adopted **content-verbatim, formatter-normalized** — `vp fmt` owns layout, hex casing, and trailing zeros. Never add `src/*.css` to a formatter ignore to preserve upstream byte formatting.
- `dist/tokens.json` is generated. Every custom property must match a rule in `groupRules` (`scripts/build.ts`); an ungrouped token fails the build by design.
- All of `dist/` is generated and untracked, so `scripts/check.ts` must run **after** the build, never before. `verify` had them the other way round: the gate asserted on the previous build's artifacts while the current source went unchecked, and it passed only because `dist/` was committed. `check.ts` now fails by name when `dist/` is absent, `check` builds first, and `verify` reaches it through `guide:sync`.
- Tarball contents are declared twice on purpose: `files` in `package.json` and `SHIPPED` in `scripts/check.ts`. `check` fails when they disagree, so changing what consumers download costs a reason rather than a one-line edit. `system/assets/` is the counter-example that earned the rule — the two source PNGs are tracked but deliberately unshipped, because every surface loads brand images from the cdn.
- The tarball is `dist/` + `DESIGN.md` + `assets/` + the skill. `preview/`, `pages/`, and `templates/` are **site-only**: whole HTML documents reached by url, and no `exports` entry maps them, so a consumer subpath import raises `ERR_PACKAGE_PATH_NOT_EXPORTED`. They shipped for a while and were 145 kB of unreachable copy — `templates/` is uinaf.dev's own site plus uinaf's brand artboards, which no consumer wants. `test/surfaces.test.ts` keeps them out, because `files`/`SHIPPED` parity only catches drift, not both being widened together. To serve a surface, deploy the guide.
- Every `src`/`href` in `preview/`, `pages/`, or `templates/` that names a path must resolve to a file inside the repo (`test/surfaces.test.ts`) — existence and containment, since a ref that climbs out of the root resolves locally and 404s once the guide serves it from its own root. `guide:sync` used to rewrite `../assets/uinaf-*.png` to the cdn on the way out, so a path resolving to nothing still published correctly and broke only in the tarball; that rewrite is gone and this test replaced it. `scripts/check.ts` checked this for `templates/` alone and no longer does — one owner.
- Spec: `DESIGN.md`. Skill: `skills/uinaf-design/` — a published artifact, not a skill this repo consumes. Lint it with `pnpm run skill:lint`.
- Guide static root is `guide/`. `guide/index.html` is hand-authored; `pnpm run guide:sync` refreshes tokens + `guide/preview/` from `preview/`, `guide/pages/` from `pages/`, and `guide/templates/` from `templates/`. It runs before `vp test run` in `verify` because the page and template suites assert on published output.
- `pages/` holds the six reference screens. Each needs an `@page name="…" description="…"` marker — the sync strips it when publishing and fails the build if it is missing. Pages carry no guide chrome: they already own a topbar, and a second bar would break the one-row rule they exist to demonstrate.
- `templates/` holds uinaf.dev's own surfaces plus four `export-*` artboards, and publishes the same way behind `@template name="…" description="…"`. An artboard is a fixed canvas, not a page: the sync reads its declared `width:…px;height:…px` into `templates.json` and zooms it to fit, and `design:check` waives exactly `type-scale-only` and `spacing-grid` on `templates/export-` because a 2560px canvas obeys no viewport rule. That is `--except`, not `--ignore`: an artboard still may not carry an emoji or a raw hex, because it is a published uinaf brand surface, so the other rules stay in force.
- Keep tracker / GitHub Project links out of the public guide and out of package-facing docs (`README.md`, `DESIGN.md`).

## Commands

```sh
pnpm install --frozen-lockfile   # bootstrap — Node from .node-version, pnpm from packageManager
pnpm run verify                  # the gate CI runs; ends in the real-surface smoke
pnpm run smoke                   # that smoke alone: boots the Worker, exercises /mcp + every machine-layer route, tears it down
pnpm run cdn:check               # HEADs every URL in the CDN export; run before a deploy that adds one
```

Prefer `vp` for lint/format/test: `pnpm exec vp check`, `pnpm exec vp test run`.

`pnpm run smoke` syncs the guide, binds port 8788, and always kills the server it started. Set `SMOKE_PORT` to run it from a second worktree; logs land in `.smoke/` (gitignored). Two runs in the _same_ checkout will fight over `guide/` — use a separate worktree, or call `./scripts/smoke.sh` directly once the guide is built.

`pnpm run deploy` publishes the working tree to **production** `design.uinaf.dev`. It is outside `verify` on purpose and must not run unattended — CI deploys from `main` (`.github/workflows/release.yml`). To see your change, run `pnpm run smoke` or `pnpm exec wrangler dev`.

## Pipelines

| Workflow                             | Trigger                          | Jobs                                                                       |
| ------------------------------------ | -------------------------------- | -------------------------------------------------------------------------- |
| `.github/workflows/verify.yml`       | PR, merge queue, `workflow_call` | `verify` — the one definition, called by the others                        |
| `.github/workflows/release.yml`      | push to `main`                   | (verify + secrets) → guide deploy (`production`) ∥ npm publish (`release`) |
| `.github/workflows/secrets.yml`      | PR, `workflow_call`, weekly      | gitleaks, trufflehog                                                       |
| `.github/workflows/actions-lint.yml` | `.github/workflows/**`           | actionlint, zizmor — both third-party, digest-pinned, run in Docker        |

`+` and `∥` both mean parallel: the two gates run at once, then the two terminal jobs run at once. The `→` is the only chain — nothing after it starts until both gates pass.

A fifth gate has no file. CodeQL runs through GitHub **default setup** (code scanning) over `actions`, `javascript-typescript`, and `typescript`, so `gh run list` shows runs no workflow in this repo declares. It is a repository setting, changed on GitHub, not in a pull request.

Two rules the file names do not tell you:

- `release.yml` is the **only** push-to-`main` workflow, and its file name is pinned by npm Trusted Publishing. Renaming it breaks `npm publish` until someone edits the trusted publisher on npmjs.com. That is why the guide deploy lives in a file called `release`.
- `deploy` and `release` are siblings on `needs: [verify, secrets]`. Never gate guide deploy on the release job — `design.uinaf.dev` must keep shipping when a publish fails.

Credentials for each path are listed in `docs/releasing.md` (vars vs secrets).

## Docs map

| Doc                 | When                                       |
| ------------------- | ------------------------------------------ |
| `README.md`         | package install / consumer usage           |
| `DESIGN.md`         | visual + voice rules                       |
| `CONTRIBUTING.md`   | local setup and verify                     |
| `docs/releasing.md` | npm + guide deploy pipelines               |
| `docs/adoption.md`  | stylesheet + lint wiring in a product repo |
| skill               | building UI that should feel like uinaf    |
