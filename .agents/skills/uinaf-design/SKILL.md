---
name: uinaf-design
description: Use this skill to generate well-branded interfaces and assets for uinaf (undefined is not a function LLC) — a small independent software studio that builds practical developer tools, automation, and weird useful internet machinery. Tagline "we bet you've seen us before". Use for production code, throwaway prototypes, mocks, slides, or any visual artifact that needs to feel like uinaf.
user-invocable: true
---

# uinaf design

## Spec first

Read `DESIGN.md` at the repo root before building anything — voice, type, color, structure, components, layout, motion, guardrails.

## Package

| Import              | Use                                         |
| ------------------- | ------------------------------------------- |
| `@uinaf/design/css` | tokens + ready styles — the only CSS import |
| `@uinaf/design`     | flat token map                              |
| `@uinaf/design/cdn` | CDN URL constants for fonts and images      |

Fonts: always load Berkeley Mono from `https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css`. Never vendor font binaries in apps or this package.

Brand images: use `CDN.images` / `https://cdn.uinaf.dev/images/...`. Offline package copies live under `system/assets/`.

## References

- `preview/` — one HTML card per pattern; match the nearest card when unsure
- `templates/` — copyable starting points
- Live guide: https://design.uinaf.dev

## Non-negotiables

Berkeley Mono only · everything lowercase except 11px tracked micro-labels · hierarchy from the 11↔24 spread + air · one phosphor-lime accent used like a laser pointer · cyan stays in artwork · white-fill primary buttons, monochrome everything else · 1px borders, square corners, no shadows, no gradients, no emoji, no icon fonts · quiet dot-scale status · narrow shell by default · dry lowercase copy with no SaaS sludge.

If a choice isn't covered: pick the quieter option, and match the nearest preview card.
