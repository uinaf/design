# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## Pipelines

| Workflow      | On push to `main`                                                   |
| ------------- | ------------------------------------------------------------------- |
| `main.yml`    | verify → secrets → guide deploy (`production`)                      |
| `release.yml` | verify → secrets → npm publish (`release`, OIDC + `uinaf-releaser`) |

Guide deploy is independent of npm so `design.uinaf.dev` keeps shipping while
the package bootstraps.

## npm bootstrap (one-time, owner)

```sh
cd ~/projects/uinaf/design
npm login
pnpm run verify
npm publish --access public
# semantic-release reads git tags (tagFormat v${version}); match the bootstrap
# npm version so the next automated release continues from 0.1.0.
git tag -s v0.1.0 -m v0.1.0
git push origin v0.1.0
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

## Ship loop

For delivery PRs: gh-setup → builder verify → autoreview → Bugbot → autopilot.
Do not merge from the agent; leave merge to the owner.
