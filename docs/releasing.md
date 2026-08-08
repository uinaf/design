# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## Guide deploy

`.github/workflows/main.yml` deploys `guide/` through the `production`
environment with Wrangler. Hostname `design.uinaf.dev` is bound in
`uinaf/infra` (`workers_custom_domains`). Guide deploy does **not** wait on
npm publish.

## npm `@uinaf/design`

`.github/workflows/release.yml` follows the `@uinaf/workspace-kit` shape:
verify → secret scan → semantic-release in the `release` Environment via npm
Trusted Publishing (OIDC) + `uinaf-releaser` for version push-back.

### Bootstrap (one-time, owner — do together)

Until the package exists and trust is registered, `release.yml` fails closed
on publish/auth. That is intentional and must not block guide deploys.

1. Ensure the `uinaf` npm org exists.
2. Fresh login and first publish:

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

3. Copy `UINAF_RELEASE_APP_PRIVATE_KEY` from `uinaf/workspace-kit`'s `release`
   Environment into this repo's `release` Environment (vars
   `UINAF_RELEASE_APP_CLIENT_ID` / `UINAF_RELEASE_APP_ID` should already be set).
4. Confirm `uinaf-releaser` bypass on `protect-main` / `protect-release-tags`.

## Ship loop

For delivery PRs: gh-setup conventions → `autoreview` → Bugbot → autopilot
until merge-ready (CI green, threads triaged). Do not merge from the agent.
