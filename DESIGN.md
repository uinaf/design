DUMMY PR FOR DUMMY CODEX

# uinaf — design system

**uinaf** ("undefined is not a function LLC") — a small independent software studio. developer tools, automation, agent infrastructure, weird useful internet machinery. tagline: **"we bet you've seen us before."**

one typeface, near-black, hairline borders, one accent, visible structure.

## index

| file                                   | what                                                                                           |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `@uinaf/design/css`                    | tokens + ready styles implementing everything below. the only css you import                   |
| `design.uinaf.dev/pages/<name>.md`     | six whole reference screens — start from one of these when building a page, not a component    |
| `design.uinaf.dev/templates/<name>.md` | uinaf.dev's own surfaces, plus fixed-size `export-*` artboards for OG and README images        |
| Berkeley Mono (CDN only)               | `https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css` — never vendored in this package |
| brand images (CDN only)                | `https://cdn.uinaf.dev/images/…` — see the `CDN` export; never vendored in this package        |
| `design.uinaf.dev`                     | one card per pattern — the canonical reference for each                                        |
| `assets/icons/`                        | the closed icon set — eight 16-grid stroke svgs, `currentColor`                                |

whole screens are read by url, never imported. the package carries css, tokens, the lint, the icon set, and this spec.

## voice

- short, direct, a little dry. no SaaS sludge, no exclamation marks. fragments fine, periods at the end.
- everything lowercase. one exception: micro-labels are uppercase.
- "we" for the studio. "you" sparingly, in actual instructions.
- no emoji, ever. `↗` external, `→` forward, `·` separator.
- product copy describes, never sells: `tccutil — CLI helpers for managing macOS TCC permissions.`
- if a sentence could appear on a generic SaaS landing page, rewrite it.

## type

- Berkeley Mono only. sized, never weighted. bold = inline emphasis only.
- scale: 10 / 11 / 13 / 14 / 16 / 20 / 24 / 32 / 40. body 14, page title 24, hero 32, ceiling 40.
- hierarchy comes from the small↔large spread plus air — never from weight, never from giant display sizes.
- **the micro-label** is the hierarchy device: 11px, uppercase, wide tracking, dim. it kicks off sections, heads tables, labels fields, captions stats. the only uppercase in the system.
- body line-height 1.6 — mono needs the air.

| role                          | size              |
| ----------------------------- | ----------------- |
| micro-label / kicker          | 11, caps, tracked |
| meta (dates, counts)          | 11                |
| secondary body, buttons, code | 13                |
| body                          | 14                |
| list title / minor heading    | 16                |
| section heading               | 20                |
| page title / stat value       | 24                |
| hero                          | 32                |
| display ceiling               | 40                |

no 18px. pick the nearest step.

## color

- monochrome neutrals do all the ui work: light text on near-black, dim labels, darker hairlines. hierarchy by border + background step, never hue.
- **one accent — phosphor lime.** allowed: link hover, text selection + caret, live dots, active markers, first chart series, at most one accent-filled button per screen. never: body text, washes, resting borders. if two things glow, neither does.
- the slime family (cyan / green / magenta / purple) lives in the artwork and chart series 2+. cyan is not a ui color.
- status = a small muted dot + a lowercase word. never a filled banner, never neon.

## structure

- spacing has two regimes. **layout** — 16px and up, plus section and block margins — sits on the scale: 4 · 8 · 12 · 16 · 20 · 24 · 28 · 32 · 36 · 40 · 48 · 56 · 64 · 72 · 80 · 96. **micro** — under 16px, between elements inside one row or control: dot to text, icon to label, chip padding — has a 2px resolution, and 2 · 6 · 10 · 14 are deliberate optical half-steps, not drift. panels breathe 20 inside, rows 16, groups 32, sections 64–96. off the scale, round to the nearest step; an exact tie rounds down, because denser is on-brand.
- borders: 1px, one rest shade + one hover shade. dashed marks a bounded long-form region. never thicker.
- corners square by default, 2px on controls, 6px ceiling. shadows: none (the live dot's glow is the one exception).
- the vocabulary: **panel** (bordered region) · **corner ticks** (technical-drawing + marks on panel corners) · **panel grid** (panels sharing single hairlines — stat strips, kanban) · **stat** (label / value / note) · **frame** (full-width hairline band) · **table** (micro-label headers, hairline rules, numerics right).
- panels group data. whitespace groups prose. sections separate with a hairline + space, never background bands.

## components

- **buttons:** 32px tall (26 / 38 small / large), 13px lowercase labels. primary = white fill; secondary = outline; tertiary = borderless; accent fill = the rare loud one. pair primary + tertiary; two fills never sit together. press compresses slightly.
- **fields:** micro-label above a 32px control on a slightly raised fill. focus brightens the border — no rings, no glow. caret in accent. errors: muted red border + one dry sentence, never a banner.
- **tags:** small caps, bordered, square, never filled.
- **links, three families, never mixed:** prose links (visible dim underline, phosphor on hover) · plain links for chrome (opacity fade, no underline) · the whole card as one link.
- **header chrome:** small framed mark + small name; the page title outranks it. never sticky, no background, no shadow.
- **code:** inline chips on a raised fill; blocks slightly darker, 13px. never wrap code — scroll it. highlighting stays neutral; slime may color strings + keywords only.

## layout

- three shells: narrow 40rem (default — prose, home, detail), base 48rem (data-dense: tables, dashboards), wide 72rem (rare — cap inner prose at narrow). if unsure, narrow. one product = one width: a data-dense view may step UP to base, but a detail page never shrinks below its index/home.
- hero formula: micro-label kicker (optionally with a live dot) → 32px title (≤22ch) → one 14px sub-line (≤46ch) → primary + tertiary buttons → optional stat strip. see the project page template.
- never widen a shell to fit one element — let the element break out or redesign it.

## motion

snappy decel, no bounce. 160ms hover/press, 220ms entry. entry = fade-up 10px with 45ms stagger, once per session. reduced motion → plain fade. nothing loops.

## imagery & logo

- two illustrations, total: `uinaf-team.png` (primary mark, 220–240px framed) and `uinaf-computer.png` (small mark, 24–64px). pure black behind, 1px frame, square crop. never rotate, recolor, or generate look-alikes.
- the favicon is neither of those — it is its own rendered set on the cdn, under `CDN.favicons`: 16 / 32 / 48 / 192 / 512 plus apple-touch.
- no photos, no icon fonts. `↗` `→` `·` and hairlines carry the iconography.
- **icons are a last resort, and the set is closed.** eight 16-grid stroke svgs live in `assets/icons/` — search, copy, download, refresh, file, folder, branch, warning. original work, licensed with the repo. pick from the set; extend it in its idiom (stroke 1.5, square caps, `currentColor`, no fills) as a pull request, never inline. sizes scale the stroke inversely: 16/1.5 default, 12/1.75 in tags and meta rows, 20/1.25 in large buttons and empty states. never import an icon library, never paste from a third-party set, and never put an icon beside a word that already says it.

## guardrails

- don't fix hierarchy with size — add a micro-label and space.
- don't pass 40px. don't add a second accent, a second typeface, or a filled tag.
- don't group prose with borders. don't mark sections with background bands.
- don't let two accent elements share a viewport.

## caveats

- Berkeley Mono is commercial. no binary lives in this repo or the npm tarball — every surface loads it from the cdn under the owner's license. substitute: JetBrains Mono.
