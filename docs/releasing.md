# Releasing

## Pipelines

| Workflow                        | On push to `main`                                                   |
| ------------------------------- | ------------------------------------------------------------------- |
| `.github/workflows/main.yml`    | verify → secrets → guide deploy (`production`)                      |
| `.github/workflows/release.yml` | verify → secrets → npm publish (`release`, OIDC + `uinaf-releaser`) |

Guide deploy stays independent of npm so `design.uinaf.dev` keeps shipping even when a release job fails. Do not make deploy `needs: [release]`.

## npm

`@uinaf/design` publishes from `.github/workflows/release.yml` via npm Trusted Publishing (OIDC) and `uinaf-releaser`.

Required on the `release` GitHub Environment:

| Name                            | Kind   | Purpose                                     |
| ------------------------------- | ------ | ------------------------------------------- |
| `UINAF_RELEASE_APP_CLIENT_ID`   | var    | GitHub App client id for the releaser bot   |
| `UINAF_RELEASE_APP_PRIVATE_KEY` | secret | GitHub App private key for the releaser bot |

npm trusted publisher is already registered for this repo / workflow file (`release.yml`) / `release` environment.

Manual publish is only for emergency recovery:

```sh
pnpm run verify
npm publish --access public
```

## Guide

CI deploys from `.github/workflows/main.yml` via the `production` GitHub Environment.

Required on `production`:

| Name                    | Kind   | Purpose               |
| ----------------------- | ------ | --------------------- |
| `CLOUDFLARE_ACCOUNT_ID` | var    | Cloudflare account id |
| `CLOUDFLARE_API_TOKEN`  | secret | Workers deploy token  |

Local:

```sh
pnpm run deploy
```

`design.uinaf.dev` is bound in `uinaf/infra` (`workers_custom_domains`), not via wrangler routes.
