# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## Pipeline

`.github/workflows/release.yml` on push to `main`:

1. verify
2. secret scan
3. npm release (`release` Environment, OIDC trusted publishing + `uinaf-releaser`)
4. guide deploy (`production` Environment) — same workflow so publish and deploy share one gate

## npm bootstrap (one-time, owner)

```sh
cd ~/projects/uinaf/design
npm login
pnpm run verify
npm publish --access public
npx -y npm@^11.10.0 trust github @uinaf/design \
  --repo uinaf/design \
  --file release.yml \
  --env release \
  --allow-publish \
  --yes
```

Also copy `UINAF_RELEASE_APP_PRIVATE_KEY` from `uinaf/workspace-kit`'s `release`
Environment into this repo's `release` Environment.

## Guide host

`design.uinaf.dev` is bound in `uinaf/infra` (`workers_custom_domains`), not via
wrangler routes.
