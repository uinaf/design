# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## Guide deploy

`.github/workflows/main.yml` deploys `guide/` through the `production`
environment with Wrangler (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
Hostname `design.uinaf.dev` is bound in `uinaf/infra`
(`workers_custom_domains` inventory).

## npm `@uinaf/design` — deferred

There is intentionally **no** `release.yml` until the package exists on npm.
Trusted publishing OIDC fails with `package not found` before bootstrap.

### One-time bootstrap (owner — do together)

```sh
cd ~/projects/uinaf/design
pnpm run verify
npm publish --access public   # creates @uinaf/design@0.1.0
```

Then add `release.yml` matching `@uinaf/workspace-kit` (OIDC + `uinaf-releaser`),
register the trusted publisher, and grant ruleset bypass:

```sh
npx -y npm@^11.10.0 trust github @uinaf/design \
  --repo uinaf/design \
  --file release.yml \
  --env release \
  --allow-publish \
  --yes
```
