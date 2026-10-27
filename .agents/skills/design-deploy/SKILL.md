---
name: design-deploy
description: Recover or roll back the design.uinaf.dev Worker deploy. Use when CI refuses to deploy because Alchemy lost the live Worker, when renaming the Alchemy stack, `Guide` id, or Worker `name`, or when rolling back a bad deploy.
---

# Design deploy

## Adopt the live Worker

Alchemy adopts the live Worker by its tags: `alchemy:stack:uinaf-design`, `alchemy:stage:prod`, `alchemy:id:Guide`.

- Renaming the stack or the `Guide` id orphans them.
- Deploying `--adopt` under another stage orphans them too.
- Orphaned: CI refuses to deploy until one `pnpm run deploy --adopt` (no `--`).
- Changing `name` creates a second script; the old one keeps the domain.

## Roll back

1. `pnpm exec wrangler versions list` for the version id.
2. `pnpm exec wrangler rollback <version-id>`.
3. Revert on `main`, or the next merge redeploys.

`wrangler.toml` serves `wrangler types` and `wrangler rollback` only. `test/worker.test.ts` keeps it in step with `alchemy.run.ts`.
