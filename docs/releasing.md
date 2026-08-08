# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## Pipeline

`.github/workflows/release.yml` on push to `main`:

1. verify
2. secret scan
3. npm release (`release` Environment, OIDC trusted publishing + `uinaf-releaser`)
4. guide deploy (`production`) — needs successful release job

Hostname `design.uinaf.dev` is bound in `uinaf/infra` (`workers_custom_domains`),
not via wrangler routes.

## npm bootstrap (one-time, owner)

Until the package exists and trust is registered, the release job fails closed
on publish/auth. Because deploy needs release, that also blocks guide deploy
until bootstrap is done — intentional.

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
Environment into this repo's `release` Environment (vars
`UINAF_RELEASE_APP_CLIENT_ID` / `UINAF_RELEASE_APP_ID` should already be set).

Confirm `uinaf-releaser` bypass on `protect-main` / `protect-release-tags`.

## Ship loop

For delivery PRs: gh-setup conventions → `autoreview` → Bugbot → autopilot
until merge-ready (CI green, threads triaged). Do not merge from the agent.
