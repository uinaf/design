# Contributing

## Setup

Node >= 24.18 (see `.node-version`) with Corepack enabled, and git. The repo
runs on the [Vite+](https://github.com/voidzero-dev/vite-plus) toolchain (`vp`):

```
pnpm install --frozen-lockfile
pnpm exec vp config --no-agent
```

## Validation

```
pnpm exec vp run verify
pnpm exec vp check --fix
```

## Pull requests

Branch from `main`, keep PRs scoped, use Conventional Commits, and fill the
PR template. CI must be green; `main` requires signed commits when rulesets
are enabled.

Releases are automatic on push to `main` (semantic-release + npm trusted
publishing). Guide deploys to [design.uinaf.dev](https://design.uinaf.dev)
via the `production` GitHub Environment.
