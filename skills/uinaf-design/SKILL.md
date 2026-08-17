---
name: uinaf-design
description: "Build uinaf-branded interfaces and assets — production code, prototypes, mocks, or any visual artifact that should feel like uinaf (undefined is not a function LLC). Fetch patterns from design.uinaf.dev rather than inventing them: the site carries the artifacts, this skill carries the rules. Use when writing UI for a uinaf product, restyling an existing screen, or producing branded assets. Do not use for non-uinaf projects or for backend work with no visual surface."
disable-model-invocation: true
---

# uinaf design

## The workflow

1. **Never write uinaf UI from memory.** Fetch first, then adapt the content —
   do not reinterpret the design.
   - Building a **whole page**? Start from a reference page:
     `https://design.uinaf.dev/pages/<name>.md` — `product-landing`,
     `dashboard`, `login`, `settings`, `docs`, `device-auth`. Keep the
     structure; the layout is the design.
   - Building a **uinaf-owned surface** — uinaf.dev itself, a blog, a repo's
     social image? `https://design.uinaf.dev/templates/<name>.md` — `homepage`,
     `blog-index`, `blog-post`, `changelog`, `projects`, `project-page`,
     `roadmap`, `status`, `not-found`, and the `export-*` artboards. An artboard
     is a fixed canvas; render it at the size it states, do not adapt it.
   - Building **one component**? `https://design.uinaf.dev/components.json` to
     find the nearest pattern, then
     `https://design.uinaf.dev/patterns/<name>.md` for its markup.
2. **Import the CSS and use what is there.** `@import "@uinaf/design/css";`
   gives tokens and every pattern class. With no bundler, link
   `node_modules/@uinaf/design/dist/css/tokens.css` instead — a browser does not
   resolve a bare specifier. Take exact values from
   `https://design.uinaf.dev/tokens.json` when writing custom CSS.
3. **Prefer the MCP tools when connected** (`https://design.uinaf.dev/mcp`):
   `get_page`, `get_template`, `list_patterns`, `get_pattern`, `get_tokens`,
   `search_guidelines`.
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
on a clean tree, then commit `.design-ratchet.json`. Running it afterward bakes
your own new violations into the baseline and the ratchet will never catch them.
From then on add `--ratchet`, which fails only when a count rises, so your change
is held to green without inheriting the backlog.

Fonts: Berkeley Mono is licensed and loads from
`https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css`. Never bundle it.

## Voice registers

Copy has two registers and one dry voice.

- **Brand register — lowercase.** Use it for the site, product UI, marketing,
  OG cards, commits, PR titles, code comments, and CLI output. Micro-labels are
  uppercase. Abbreviations keep their conventional caps — PR, AI, API, CLI,
  URL, OG, KV, R2, D1, SHA, HDR, HLS, TCC, macOS.
- **Docs register — conventional caps.** README, CONTRIBUTING, `docs/`,
  repository changelog files, GitHub release notes, and design-system catalog
  copy use sentence case, never title case. Keep the same short, dry voice.
- A changelog or blog rendered on uinaf.dev is a brand surface, not a repo doc,
  and stays lowercase.
- Product and studio names stay lowercase in both registers, even at sentence
  start: `tccutil manages…`, never `Tccutil manages…`.

Read as a document → docs register. Read as the product talking → brand
register. When unsure, lowercase.

## The system in one breath

Berkeley Mono only · brand surfaces lowercase, repo docs sentence case ·
micro-labels and abbreviations keep their caps (PR, AI, CLI, URL — never `pr`) ·
small type, hierarchy from the 11↔24 spread plus air · one phosphor-lime accent
used like a laser pointer · white-fill primary buttons, monochrome everything
else · 1px borders, square corners, no shadows, no gradients, no emoji, no icon
fonts · quiet dot-scale status · narrow shell by default · product nav is ONE
56px topbar row, never stacked · dry copy with no SaaS sludge.

## Hard guardrails

The lint enforces these — do not fight it.

- No raw color outside token definitions; no `border-radius` over 6px; no
  `box-shadow` except `var(--shadow-glow-accent)`
- One accent element per view; a second means neither glows
- The topbar row and the page content share the same shell class — one gutter
- Type sizes only from the scale (10/11/13/14/16/20/24/32/40) — no 18px
- Do not group prose with borders, or mark sections with background bands
- Status is a dot plus a word, never a filled banner

Icons are a last resort and the set is closed. Glyphs come first — `↗` external,
`·` separator, `···` menu, `←` `→` pagination, `.u-dot` status. When a pattern
genuinely needs one, pick from the eight 16-grid stroke svgs at
`https://design.uinaf.dev/assets/icons/<name>.svg` — search, copy, download,
refresh, file, folder, branch, warning. Stroke scales inversely with size —
16/1.5 default, 12/1.75 in tags and meta rows, 20/1.25 in large buttons and
empty states. Never import an icon library, never paste from a third-party set
(lucide, feather, heroicons, geist), and never put an icon beside a word that
already says it. A new icon is a pull request to the set, in its idiom — never
an inline invention.

## Reference

Every path below is on `https://design.uinaf.dev`, never a route in the repo
you are working in.

| Where                      | What                                                    |
| -------------------------- | ------------------------------------------------------- |
| `/pages/<name>.md`         | a whole reference screen, markup included               |
| `/templates/<name>.md`     | a uinaf.dev surface or a fixed-size export artboard     |
| `/components.json`         | every pattern: classes, use, rules, nevers              |
| `/patterns/<name>.md`      | one pattern, contract plus copyable markup              |
| `/tokens.json`             | tokens grouped by role                                  |
| `/design.md`               | the spec: voice, type, color, structure, layout, motion |
| `/assets/icons/<name>.svg` | one icon from the closed set                            |
| `/llms.txt`                | index of the above                                      |

## When a choice is not covered

Pick the quieter option and match the nearest pattern on design.uinaf.dev. If it
still feels undefined, ask rather than invent.
