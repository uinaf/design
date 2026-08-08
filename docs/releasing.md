# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## npm `@uinaf/design`

Publishing uses npm Trusted Publishing (OIDC) from `.github/workflows/release.yml`
via the `release` GitHub Environment. No long-lived `NPM_TOKEN` is stored.

### One-time bootstrap (owner)

Trusted publishing requires an existing package. With a fresh npm login:

```sh
cd ~/projects/uinaf/design
pnpm run verify
npm publish --access public   # 2FA if prompted → creates @uinaf/design@0.1.0
npx -y npm@^11.10.0 trust github @uinaf/design \
  --repo uinaf/design \
  --file release.yml \
  --env release \
  --allow-publish \
  --yes
```

Create the `uinaf` npm org first if it does not exist. After trust is
registered, subsequent `feat:`/`fix:` pushes to `main` publish via OIDC.

## Guide deploy

`.github/workflows/main.yml` deploys `guide/` through the `production`
environment with Wrangler. Hostname `design.uinaf.dev` is bound in
`uinaf/infra` (`workers_custom_domains` inventory), not via wrangler routes.
