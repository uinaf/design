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

## Preview locally

```sh
pnpm run guide:sync
pnpm exec wrangler dev
```

## Releases / deploy

See [Releasing](docs/releasing.md). Guide deploys from `main` via the `production` environment; npm publishes via the `release` environment.
