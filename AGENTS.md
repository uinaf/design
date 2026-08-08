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

## Ship loop

1. **gh-setup** conventions (Environments, SHA-pinned Actions, secrets scan,
   squash-only, signed-commit rulesets + `uinaf-releaser` bypass).
2. **autoreview** after builder verify (`autoreview review --mode branch`).
3. **Bugbot** on the PR (`/review-bugbot`).
4. **autopilot** to triage comments and CI until merge-ready.

## Workflow invariant

Two push workflows on `main` (intentional during npm bootstrap):

- `main.yml` — verify → secrets → guide deploy (`production`)
- `release.yml` — verify → secrets → npm release (`release`, fail-closed)

Do **not** gate guide deploy on the release job. Do **not** delete `main.yml`
to "simplify" until `@uinaf/design` publishes reliably via OIDC.

## Commands

```sh
pnpm install --frozen-lockfile
pnpm exec vp run verify
pnpm exec vp run deploy
```
