---
name: uinaf-design
description: Use this skill to generate well-branded interfaces and assets for uinaf (undefined is not a function LLC) — a small independent software studio that builds practical developer tools, automation, and weird useful internet machinery. Tagline "we bet you've seen us before". Use for production code, throwaway prototypes, mocks, slides, or any visual artifact that needs to feel like uinaf.
user-invocable: true
---

Read `DESIGN.md` at the repo root — it is the design spec (voice, type, color, structure, components, layout, motion, guardrails). Then explore the other files.

Key files:

- `DESIGN.md` — the design spec. Read it before building anything.
- `@uinaf/design/css` (`dist/css/tokens.css`) — tokens + ready styles. Import it and use what's there; load Berkeley Mono from `https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css` (not vendored in the package).
- `templates/` — copyable starting points.
- `preview/` — one card per pattern; the canonical reference.
- Brand images: `https://cdn.uinaf.dev/images/...` or `system/assets/` for package-safe copies.

The non-negotiables, in one breath: Berkeley Mono only · everything lowercase except 11px tracked micro-labels · small type, hierarchy from the 11↔24 spread + air · one phosphor-lime accent used like a laser pointer, cyan stays in the artwork · white-fill primary buttons, monochrome everything else · 1px borders, square corners, no shadows, no gradients, no emoji, no icon fonts · quiet dot-scale status · narrow shell by default · dry lowercase copy with no SaaS sludge.

If a choice isn't covered: pick the quieter option, and match the nearest preview card.
