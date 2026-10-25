# Contributing

Use Node from `.node-version` and [pnpm](https://pnpm.io/installation).

```sh
pnpm install --frozen-lockfile
pnpm run verify        # cached checks and tests, then the Worker smoke
pnpm run verify:full   # same, uncached
pnpm run dev           # local guide on port 8787 (DEV_PORT overrides)
```

`pnpm run smoke` binds port 8788 (`SMOKE_PORT` overrides) and logs to `.smoke/`.

A merge to `main` redeploys the guide; the commit type decides the npm release ([`.releaserc.json`](.releaserc.json)).
