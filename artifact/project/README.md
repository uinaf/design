**uinaf**: a small independent software studio. One typeface, near-black, hairline borders, one accent, visible structure. Dark only.

## Voice

- Short, direct, a little dry. Describes, never sells. No emoji, no exclamation marks, no em dashes in prose.
- Lowercase in product UI, commits and CLI output; sentence case in docs. Names stay lowercase everywhere: uinaf, ffss, skillcheck.

## Rules

- **Type:** Berkeley Mono only, sized never weighted. Scale tops out at 40px. Hierarchy comes from the 11px uppercase micro-label (`u-label`) and space.
- **Color:** neutrals do the work. One accent, `accent` lime, at most once per viewport. Status is a dot plus a word.
- **Structure:** 1px borders, square corners (`radius-md` 6px ceiling), no shadows, no background bands.
- **Assets:** two raster marks, no vector logo (set `uinaf` in type). Eight icons, closed set.

Specifics live in the tokens, each component's README, and [design.uinaf.dev](https://design.uinaf.dev).

## The font

Berkeley Mono is licensed and loads only from `https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css`. Previews here can't reach it and render in JetBrains Mono or SF Mono instead.

## In code

```css
@import "@uinaf/design/css";
```

Wrap UI in `.uinaf`; the package is CSS only, so the app toggles state through attributes (`hidden`, `aria-pressed`, `aria-selected`, `data-copied`). Gate repos with `design-check src` (`--ratchet` for an existing backlog). Agents start from `https://design.uinaf.dev/llms.txt`.

> Generated from [uinaf/design](https://github.com/uinaf/design); change it there, not here. Motion and `hairline*` variables live in `bundle.css`. Whole screens, adoption docs and tooling stay in the repo.
