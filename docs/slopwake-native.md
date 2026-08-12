# slopwake native product contract

`slopwake` uses a canonical derivative of `uinaf-computer`: the front face of
the CRT remains the silhouette, the awake state opens its eyes, and the app
icon retains the source mark's bone-black-phosphor palette and slime detail.
The derivative is product artwork, not an extension of the utility icon set.

## Assets

- `assets/products/slopwake/slopwake-menu-idle.svg` is the monochrome template
  mark for an idle or released hold.
- `assets/products/slopwake/slopwake-menu-active.svg` is the monochrome
  template mark for an active automatic or manual hold.
- `assets/products/slopwake/slopwake-app-icon.svg` is the 1024-point app-icon
  source. Export it at 16, 32, 64, 128, 256, 512, and 1024 pixels; the 32, 64,
  256, 512, and 1024 exports fill the macOS 2x slots.

The SVG files are canonical. Product repositories copy exact revisions and
record the source commit. Do not redraw, recolor, rotate, add glow, or replace
them with symbols from an icon library.

On macOS, reproduce the raster app-icon exports with:

```sh
pnpm run assets:slopwake -- /path/to/output
```

## Native tokens

- Use neutral system surfaces and separators; do not recreate web card chrome.
- Use system monospaced typography. Do not bundle Berkeley Mono.
- Reserve phosphor `#D4FF3F` for the live status label or active marker. Never
  tint the menu-bar template mark; macOS owns that rendering.
- Use native menu spacing and controls. Avoid custom window chrome, shadows,
  notifications, badges, and looping motion.
- State changes are immediate. If a larger surface later needs transition,
  use a 160 ms ease-out and reduce it to no animation under Reduce Motion.

## Verification

Inspect both template marks at 18 points in light and dark menu bars. Inspect
the app icon in Finder, Dock, About, and a Gatekeeper dialog at the exported
sizes. Thin CRT and eye details must remain distinct without relying on color.
