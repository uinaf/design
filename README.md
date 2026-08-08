# @uinaf/design

Public design tokens and guidance for [uinaf](https://uinaf.dev) surfaces.

Guide: [design.uinaf.dev](https://design.uinaf.dev)

Berkeley Mono is licensed — load it from [`cdn.uinaf.dev`](https://cdn.uinaf.dev), not this package.

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

## Docs

- [Design spec](DESIGN.md)
- [Contributing](CONTRIBUTING.md)
- [Releasing](docs/releasing.md)
- [Security](SECURITY.md)

## License

MIT for the tokens and docs in this repository. Berkeley Mono remains proprietary; do not redistribute font binaries.
