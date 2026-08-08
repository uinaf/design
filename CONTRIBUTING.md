# Contributing

## Setup

Node (see `.node-version`) with Corepack enabled. Then:

```sh
pnpm install --frozen-lockfile
pnpm exec vp config --no-agent
```

## Validation

```sh
pnpm run verify
```

## Releases / deploy

Guide deploys from `main` via the `production` GitHub Environment.
npm publish is wired for trusted publishing once the package exists — see
`docs/releasing.md`.
