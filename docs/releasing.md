# Releasing

## Guide (`design.uinaf.dev`)

Push to `main` runs `main.yml`: verify → secret scanning → deploy through the
`production` environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).

Custom domain `design.uinaf.dev` → `uinaf-design` is also inventoried in
`uinaf/infra` (`tofu/inventory/workers_custom_domains.json`). Wrangler deploys
the Worker script + assets; hostname ownership stays in infra.

## npm (`@uinaf/design`) — deferred

Bootstrap publish + trusted publisher registration are a maintainer one-time
step (do together). Until the package exists on npm, there is **no**
`release.yml` — semantic-release OIDC fails with `package not found`.

After bootstrap:

1. Add `release.yml` matching `@uinaf/workspace-kit` (OIDC + `uinaf-releaser`).
2. Register trusted publisher:
   `npm trust github @uinaf/design --repo uinaf/design --file release.yml --env release --allow-publish --yes`
3. Grant `uinaf-releaser` bypass on `protect-main` / `protect-release-tags`.

Tracker: https://github.com/orgs/uinaf/projects/1
