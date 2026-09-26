# uinaf design system

**uinaf** ("undefined is not a function LLC"): a small independent software studio. Developer tools, automation, agent infrastructure, weird useful internet machinery. Tagline: **"we bet you've seen us before."**

One typeface, near-black, hairline borders, one accent, visible structure.

## Index

| File                                   | What                                                                                          |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `@uinaf/design/css`                    | Tokens + ready styles implementing everything below. The only CSS you import                  |
| `design.uinaf.dev/pages/<name>.md`     | Six whole reference screens; start from one of these when building a page, not a component    |
| `design.uinaf.dev/templates/<name>.md` | uinaf.dev's own surfaces, plus fixed-size `export-*` artboards for OG and README images       |
| Berkeley Mono (CDN only)               | `https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css`; never vendored in this package |
| Brand images (CDN only)                | `https://cdn.uinaf.dev/images/…`; see the `CDN` export; never vendored in this package        |
| `design.uinaf.dev`                     | One card per pattern; the canonical reference for each                                        |
| `assets/icons/`                        | The closed icon set: eight 16-grid stroke SVGs, `currentColor`                                |

Whole screens are read by URL, never imported. The package carries CSS, tokens, the lint, the icon set, and this spec.

## Voice

- Short, direct, a little dry. No SaaS sludge, no exclamation marks. Fragments fine, periods at the end.
- "We" for the studio. "You" sparingly, in actual instructions.
- No emoji, ever. `↗` external, `→` forward, `·` separator.
- No em dashes in prose. Use a colon, a semicolon, or a shorter sentence. The `name — description` lockup (banners, OG cards, their alt text, and card micro-labels) is the one place the glyph lives.
- Product copy describes, never sells: `skillcheck — lint and eval harness for agent skills.`
- If a sentence could appear on a generic SaaS landing page, rewrite it.

### Two registers, one voice

- **Brand register: lowercase.** Everything rendered as uinaf (the site, product UI, marketing, OG cards) plus commit messages, PR titles, code comments, and CLI output. Two exceptions: micro-labels are uppercase, and **abbreviations keep their conventional caps**: PR, AI, API, CLI, URL, OG, KV, R2, D1, SHA, HDR, HLS, TCC, macOS. `pr review` is wrong; `PR review` is right.
- **Docs register: conventional caps.** Repo docs (README, CONTRIBUTING, `docs/`), repository changelog files, and GitHub release notes take standard capitalization: sentences start with a capital, headings use sentence case, never title case. Same voice, short and dry and free of sludge, just capitalized. An all-lowercase README reads as a broken shift key, not a brand. This file uses the docs register. The design system's own catalog is documentation too: card names, group labels, subtitles, and spec files take sentence case. A changelog rendered on uinaf.dev is a brand surface and stays lowercase.
- **Product and studio names stay lowercase in both registers**, even at sentence start: `skillcheck runs…`, never `Skillcheck runs…`. Recast the sentence if it bothers you. This applies to uinaf, ffss, slopguard, skillcheck, slopwake, dotfiles, workspace-kit, and agent-skills.
- The boundary: read as a document → docs register. Read as the product talking → brand register. When unsure, lowercase.

### Repository identity

- The GitHub repository name and About description use the brand register: lowercase, short, descriptive, and free of marketing copy. Conventional abbreviations keep their caps.
- The first README heading is exactly `# uinaf/<repo>`; a banner or badges may precede it. This H1 stays lowercase; the remaining README headings and prose use the docs register.
- Package names stay literal in body copy, install commands, and imports (`@uinaf/design`); they do not replace the repository H1.
- On uinaf.dev a repo description renders with its leading capital dropped and a period guaranteed: `Shared Renovate preset…` becomes `shared Renovate preset….`

## Type

- Berkeley Mono only. Sized, never weighted. Bold = inline emphasis only.
- Scale: 10 / 11 / 13 / 14 / 16 / 20 / 24 / 32 / 40. Body 14, page title 24, hero 32, ceiling 40.
- Hierarchy comes from the small↔large spread plus air; never from weight, never from giant display sizes.
- **The micro-label** is the hierarchy device: 11px, uppercase, wide tracking, dim. It kicks off sections, heads tables, labels fields, captions stats. The only uppercase besides abbreviations.
- Body line-height 1.6; mono needs the air.

| Role                          | Size              |
| ----------------------------- | ----------------- |
| Micro-label / kicker          | 11, caps, tracked |
| Meta (dates, counts)          | 11                |
| Secondary body, buttons, code | 13                |
| Body                          | 14                |
| List title / minor heading    | 16                |
| Section heading               | 20                |
| Page title / stat value       | 24                |
| Hero                          | 32                |
| Display ceiling               | 40                |

No 18px. Pick the nearest step.

## Color

- Monochrome neutrals do all the UI work: light text on near-black, dim labels, darker hairlines. Hierarchy by border + background step, never hue.
- Dim text has two steps: `--fg-subtle` (neutral-500, 4.2:1 on the canvas) for labels and meta, `--fg-faint` (neutral-600) for axes, hints, and separators. Nothing that must be read sits below subtle.
- **One accent: phosphor lime.** Allowed: link hover, text selection + caret, live dots, active markers, first chart series, at most one accent-filled button per screen. Never: body text, washes, resting borders. If two things glow, neither does.
- The slime family (cyan / green / magenta / purple) lives in the artwork and chart series 2+. Cyan is not a UI color.
- Status = a small muted dot + a lowercase word. Never a filled banner, never neon.

## Structure

- Spacing has two regimes. **Layout**, 16px and up plus section and block margins, sits on the scale: 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 36 · 40 · 48 · 56 · 64 · 72 · 80 · 96. **Micro**, under 16px between elements inside one row or control (dot to text, icon to label, chip padding), has a 2px resolution, and 2 · 6 · 10 · 14 are deliberate optical half-steps, not drift. Panels breathe 20 inside, rows 16, groups 32, sections 64–96. Off the scale, round to the nearest step; an exact tie rounds down, because denser is on-brand.
- Borders: 1px, one rest shade + one hover shade. Dashed marks a bounded long-form region. Never thicker.
- Corners square by default, 2px on controls, 6px ceiling. Shadows: none (the live dot's glow is the one exception).
- Box model: everything inside `.uinaf` is border-box. Element defaults (`h1`, `p`, `code`, `pre`, `hr`) carry zero specificity, so any `u-` class on the element wins.
- The vocabulary: **panel** (bordered region) · **corner ticks** (technical-drawing + marks on panel corners) · **panel grid** (panels sharing single hairlines: stat strips, kanban) · **stat** (label / value / note) · **frame** (full-width hairline band) · **table** (micro-label headers, hairline rules, numerics right).
- Panels group data. Whitespace groups prose. Sections separate with a hairline + space, never background bands.

## Components

- **Buttons:** 32px tall (26 / 38 small / large), 13px lowercase labels. Primary = white fill; secondary = outline; tertiary = borderless; accent fill = the rare loud one. Pair primary + tertiary; two fills never sit together. Press compresses slightly.
- **Fields:** micro-label above a 32px control on a slightly raised fill. Focus brightens the border: no rings, no glow. Caret in accent. Errors: muted red border + one dry sentence, never a banner.
- **Tags:** small caps, bordered, square, never filled.
- **Links, three families, never mixed:** prose links (visible dim underline, phosphor on hover) · plain links for chrome (opacity fade, no underline) · the whole card as one link.
- **Site header,** uinaf.dev subpages: a 24px framed mark plus `uinaf`, 48px above the page title. No nav row; the footer carries the links.
- **App topbar,** on the uinaf.dev homepage, product pages, dashboards, and logged-in views: one 56px row. 20px framed mark left, with the product name beside it only when the surface has one; otherwise the mark alone, labelled `home`. Plain links right, current page brightest, at most one small button. Never two rows, never sticky, no background, no shadow. The topbar row and the content below share one shell class, so chrome and content sit flush left.
- **Ruled row:** the index primitive. Name at 14, a bare `↗` right at 12 in subtle, description below at 13 in muted, hairline above every row. The whole row is one link.
- **Install snippet:** one command on a raised line with a dim `$` and a copy button that confirms in place. Tabs above it only for alternate installers (npm, pnpm, bun).
- **Dash bullets:** short what-it-does lists. A faint `-` marker, one sentence per item.
- **Pill:** a pressable filter chip; `aria-pressed` carries state. Filters views, never triggers actions.
- **Code:** inline chips on a raised fill; blocks slightly darker, 13px. Never wrap code; scroll it. Highlighting stays neutral; slime may color strings + keywords only.

## Layout

- Three shells: narrow 40rem (default: prose, detail, and indexes), base 48rem (data-dense: tables, dashboards, and the banded homepage), wide 72rem (rare; cap inner prose at narrow). If unsure, narrow. One product = one width: a data-dense view may step UP to base, but a detail page never shrinks below its index/home.
- Hero formula: micro-label kicker (optionally with a live dot) → 32px title (≤22ch) → one 14px sub-line (≤46ch) → primary + tertiary buttons → optional stat strip. See the project page template.
- Never widen a shell to fit one element; let the element break out or redesign it.

## Motion

Snappy decel, no bounce. 160ms hover/press, 220ms entry. Entry = fade-up 10px with 45ms stagger, once per session. Reduced motion → plain fade. Nothing loops.

## Imagery & logo

- Two illustrations, total: `uinaf-team.png` (primary mark, 200–240px framed) and `uinaf-computer.png` (small mark, 20–64px, and the 120px frame on the 404). Pure black behind, 1px frame, square crop. Never rotate, recolor, or generate look-alikes.
- The favicon is neither of those; it is its own rendered set on the CDN, under `CDN.favicons`: 16 / 32 / 48 / 192 / 512 plus apple-touch. It is not the small mark scaled down.
- No photos, no icon fonts. `↗` `→` `·` and hairlines carry the iconography.
- **Icons are a last resort, and the set is closed.** Eight 16-grid stroke SVGs live in `assets/icons/`: search, copy, download, refresh, file, folder, branch, warning. Original work, licensed with the repo. Pick from the set; extend it in its idiom (stroke 1.5, square caps, `currentColor`, no fills) as a pull request, never inline. Sizes scale the stroke inversely: 16/1.5 default, 12/1.75 in tags and meta rows, 20/1.25 in large buttons and empty states. Never import an icon library, never paste from a third-party set, and never put an icon beside a word that already says it.

## Guardrails

- Don't fix hierarchy with size; add a micro-label and space.
- Don't pass 40px. Don't add a second accent, a second typeface, or a filled tag.
- Don't group prose with borders. Don't mark sections with background bands.
- Don't let two accent elements share a viewport.
- Don't name a private, archived, or retired repo on a public surface, sample copy included.

## Caveats

- Berkeley Mono is commercial. No binary lives in this repo or the npm tarball; every surface loads it from the CDN under the owner's license. Substitute: JetBrains Mono.
