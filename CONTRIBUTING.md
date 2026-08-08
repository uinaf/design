# Contributing

## Setup

Node (see `.node-version`) with Corepack enabled:

```sh
pnpm install --frozen-lockfile
pnpm exec vp config --no-agent
```

## Validation

```sh
pnpm run verify
```

That builds tokens, syncs `guide/`, and runs checks + tests.

## Preview locally

```sh
pnpm run guide:sync
pnpm exec wrangler dev
```

## Releases / deploy

See [Releasing](docs/releasing.md). Guide deploys from `main` via the `production` environment; npm publishes via the `release` environment.
