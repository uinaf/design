# Contributing

## Setup

Node (see `.node-version`) with Corepack enabled:

```sh
pnpm install --frozen-lockfile
```

The `prepare` script runs `vp config --no-agent` during that install, so there is
no second setup step.

## Validation

```sh
pnpm run verify
```

That builds tokens, syncs `guide/`, runs checks + tests, then boots the Worker and exercises the `/mcp` contract against it. The last step alone is `pnpm run smoke`; it binds port 8788 (override with `SMOKE_PORT`) and writes its logs to `.smoke/`.

The deterministic steps use Vite Task caching. Run `pnpm run verify:full` to bypass the cache; the Worker smoke remains uncached in both commands.

## Preview locally

```sh
pnpm run guide:sync
pnpm exec wrangler dev
```

## Releases / deploy

See [Releasing](docs/releasing.md). Guide deploys from `main` via the `production` environment; npm publishes via the `release` environment.

## Dependency automerge

- Eligible Renovate updates use GitHub auto-merge after required checks: verify and scan / Gitleaks, scan / TruffleHog, scan / Actionlint, scan / Zizmor.
- Checks are non-strict; repository admins and the existing release App retain direct writes through
  a bypass limited to the check ruleset. Renovate has no bypass.
- Shared release-age and major/digest rules remain unchanged. Add new voting
  checks to the ruleset; workflow presence alone does not require them.
