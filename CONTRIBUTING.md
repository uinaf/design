# Contributing

Use Node from `.node-version` and [pnpm](https://pnpm.io/installation).

```sh
pnpm install --frozen-lockfile
pnpm run verify
pnpm run verify:full   # uncached
pnpm run dev           # local guide
```

Set `SMOKE_PORT` per worktree when smokes run in parallel; [`scripts/smoke.sh`](scripts/smoke.sh) owns the default.

The commit type decides the npm release ([`.releaserc.json`](.releaserc.json)).
