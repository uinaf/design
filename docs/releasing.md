# Releasing

Tracker: [design → attach](https://github.com/orgs/uinaf/projects/1)

## npm `@uinaf/design`

Publishing uses npm Trusted Publishing (OIDC) from `.github/workflows/release.yml`
via the `release` GitHub Environment.

Bootstrap (one-time, package owner):

1. Ensure the `uinaf` npm org exists and your user can publish `@uinaf/*`.
2. First publish may need a manual `npm publish` with 2FA if npm has not yet
   accepted an OIDC publisher for this package name.
3. Then register the trusted publisher:

```sh
npx -y npm@^11.10.0 trust github @uinaf/design \
  --repo uinaf/design \
  --file release.yml \
  --env release \
  --allow-publish \
  --yes
```

## Guide deploy

`.github/workflows/main.yml` deploys `guide/` through the `production`
environment with Wrangler. Hostname `design.uinaf.dev` is bound in
`uinaf/infra` (`workers_custom_domains` inventory), not via wrangler routes.
