# @uinaf/design

Public design tokens and guidance for [uinaf](https://uinaf.dev) surfaces.

- **Guide:** [design.uinaf.dev](https://design.uinaf.dev)
- **Tracker:** [design → attach](https://github.com/orgs/uinaf/projects/1)
- **Fonts:** Berkeley Mono is licensed — load from [`cdn.uinaf.dev`](https://cdn.uinaf.dev), not this package

## Install

```sh
pnpm add @uinaf/design
```

```css
@import "@uinaf/design/css";
```

Or link the stylesheet after the CDN font sheet:

```html
<link rel="stylesheet" href="https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css" />
<link rel="stylesheet" href="node_modules/@uinaf/design/dist/css/tokens.css" />
```

```ts
import { tokens } from "@uinaf/design";
import { CDN } from "@uinaf/design/cdn";
```

## Package contents

| Path                           | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `dist/css/tokens.css`          | CSS custom properties + component primitives |
| `dist/tokens.js`               | Flat token map                               |
| `DESIGN.md`                    | Full design spec                             |
| `preview/`                     | Canonical pattern cards                      |
| `templates/`                   | Starter HTML                                 |
| `.agents/skills/uinaf-design/` | Agent skill                                  |

## Development

```sh
pnpm install
pnpm run build
pnpm run check
pnpm run deploy   # Cloudflare Worker assets → design.uinaf.dev
```

## License

MIT for the tokens and docs in this repository. Berkeley Mono remains proprietary; do not redistribute font binaries.
