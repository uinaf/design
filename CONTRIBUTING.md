# Contributing

## Setup

Node (see `.node-version`) and [pnpm](https://pnpm.io/installation):

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
pnpm run dev
```

It serves on port 8787 (override with `DEV_PORT`), so it can run beside the smoke.

## Releases / deploy

Every merge to `main` redeploys the guide; semantic-release publishes to npm when the commit type calls for it (`feat`, `fix`, `perf`, or a breaking change).

## Dependency automerge

Eligible Renovate updates auto-merge once `verify` passes. The shared scan skips pull requests; on the push to `main` it runs inside `verify`, where a finding stops the guide deploy and npm release.
