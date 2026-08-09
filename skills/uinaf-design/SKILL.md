---
name: uinaf-design
description: "Build uinaf-branded interfaces and assets — production code, prototypes, mocks, or any visual artifact that should feel like uinaf (undefined is not a function LLC). Fetch patterns from design.uinaf.dev rather than inventing them: the site carries the artifacts, this skill carries the rules. Use when writing UI for a uinaf product, restyling an existing screen, or producing branded assets. Do not use for non-uinaf projects or for backend work with no visual surface."
disable-model-invocation: true
---

# uinaf design

## The workflow

1. **Never write uinaf UI from memory.** Fetch the nearest pattern first:
   `https://design.uinaf.dev/components.json` to find it, then
   `/patterns/<name>.md` for the markup. Copy it, then adapt the content — do
   not reinterpret the design.
2. **Import the CSS and use what is there.** `@import "@uinaf/design/css";`
   gives tokens and every pattern class. Take exact values from
   `/tokens.json` when writing custom CSS.
3. **Prefer the MCP tools when connected** (`https://design.uinaf.dev/mcp`):
   `list_patterns`, `get_pattern`, `get_tokens`, `search_guidelines`.
4. **Finish on green.** `npm run design:check` must pass before you are done.
   Red is not done, and neither is silencing it.

Set up once per repo: `npm i -D @uinaf/design`, then add the script so the
command always resolves to the installed binary:

```json
{ "scripts": { "design:check": "design-check src" } }
```

Always run it through the script. A bare `npx design-check` resolves against the
public registry when the package is not installed locally, and the bin name is
not the package name.

If the repo already has violations, do not try to fix the whole codebase. Record
the baseline **before you touch anything** — `npm run design:check -- --update-ratchet`
on a clean tree, then commit `.design-ratchet.json`. Running it afterwards bakes
your own new violations into the baseline and the ratchet will never catch them.
From then on add `--ratchet`, which fails only when a count rises, so your change
is held to green without inheriting the backlog.

Fonts: Berkeley Mono is licensed and loads from
`https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css`. Never bundle it.

## The system in one breath

Berkeley Mono only · everything lowercase except micro-labels and abbreviations
(PR, AI, CLI, URL — never `pr`) · small type, hierarchy from the 11↔24 spread
plus air · one phosphor-lime accent used like a laser pointer · white-fill
primary buttons, monochrome everything else · 1px borders, square corners, no
shadows, no gradients, no emoji, no icon fonts · quiet dot-scale status · narrow
shell by default · product nav is ONE 56px topbar row, never stacked · dry
lowercase copy with no SaaS sludge.

## Hard guardrails

The lint enforces these — do not fight it.

- No raw color outside token definitions; no `border-radius` over 6px; no
  `box-shadow` except `var(--shadow-glow-accent)`
- One accent element per view; a second means neither glows
- The topbar row and the page content share the same shell class — one gutter
- Type sizes only from the scale (10/11/13/14/16/20/24/32/40) — no 18px
- Do not group prose with borders, or mark sections with background bands
- Status is a dot plus a word, never a filled banner

## Reference

| Where                 | What                                                    |
| --------------------- | ------------------------------------------------------- |
| `/components.json`    | every pattern: classes, use, rules, nevers              |
| `/patterns/<name>.md` | one pattern, contract plus copyable markup              |
| `/tokens.json`        | tokens grouped by role                                  |
| `/design.md`          | the spec: voice, type, color, structure, layout, motion |
| `/llms.txt`           | index of the above                                      |

## When a choice is not covered

Pick the quieter option and match the nearest pattern on design.uinaf.dev. If it
still feels undefined, ask rather than invent.
