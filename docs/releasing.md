# Releasing

## Guide (`design.uinaf.dev`)

Push to `main` runs `main.yml`: verify → secret scanning → deploy through the
`production` environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
Custom domain binding is also inventoried in `uinaf/infra`.

## npm (`@uinaf/design`)

Public package. Bootstrap publish + trusted publisher registration are a
maintainer one-time step (do together). After that, wire semantic-release +
OIDC like `@uinaf/workspace-kit` (`release` environment already exists).

Tracker: https://github.com/orgs/uinaf/projects/1
