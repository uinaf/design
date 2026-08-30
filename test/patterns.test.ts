import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { attributeValues } from "./attributes.ts";

const root = resolve(import.meta.dirname, "..");

type Pattern = { name: string; markup?: string };

const patterns = (
  JSON.parse(readFileSync(resolve(root, "src/components.json"), "utf8")) as {
    patterns: Pattern[];
  }
).patterns.filter((p): p is Required<Pattern> => Boolean(p.markup));

describe("pattern markup", () => {
  it("gives every button an explicit type", () => {
    // A bare <button> submits its enclosing form. Agents copy this markup
    // verbatim into forms, so the default is a latent bug in every consumer.
    const bare = patterns
      .filter((p) => /<button(?![^>]*\btype=)/.test(p.markup))
      .map((p) => p.name);
    expect(bare).toEqual([]);
  });

  // Layout parameters like grid-template-columns are a per-use decision and
  // belong inline. Anything the tokens own must not be spelled out inline.
  // `background: #b6ff3c` is the failure mode. A `var(--viz-1)` reference is
  // not: the value still comes from the tokens, and which series a swatch shows
  // is as per-use as the `width: 44%` beside it.
  //
  // Case-insensitive: CSS property names are, so `BACKGROUND:` is the same
  // declaration. `attributeValues` covers the attribute side. One definition,
  // used by both the gate and the proof below, so the two cannot drift apart.
  // The longhands matter more than the shorthands: `background-color` is the
  // spelling people reach for first. `border(?!-)` stays deliberate. The other
  // border longhands are width and style, which are layout, not tokens, but
  // `border-color` carries a colour and belongs here.
  const OWNED =
    /(?:^|[;\s])(color|background(?:-color|-image)?|border(?!-)|border-color|border-radius|box-shadow|font-family|font-size)\s*:\s*([^;]+)/gi;
  // Comments are legal wherever whitespace is, including between a property and
  // its colon, so `background/**/:#b6ff3c` applies the background while reading
  // as something else. Strip them before matching.
  const hasHardcodedOwnedValue = (markup: string): boolean =>
    attributeValues(markup, "style")
      .map((style) => style.replace(/\/\*[\s\S]*?\*\//g, " "))
      .some((style) =>
        [...style.matchAll(OWNED)].some((d) => !/^var\(--[a-z0-9-]+\)$/i.test(d[2].trim())),
      );

  it("keeps hardcoded token-owned values out of inline styles", () => {
    const offenders = patterns.filter((p) => hasHardcodedOwnedValue(p.markup)).map((p) => p.name);
    expect(offenders).toEqual([]);
  });

  it("still rejects a hardcoded token-owned value", () => {
    // Proves the exemption above is scoped to `var(--…)` and has not opened the
    // rule up: these fixtures must be caught.
    expect(hasHardcodedOwnedValue('<i style="background:#b6ff3c"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue('<i style="font-size:13px"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue('<i STYLE="BACKGROUND:#b6ff3c"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue("<i style='font-size:13px'></i>")).toBe(true);
    expect(hasHardcodedOwnedValue("<i style=background:#b6ff3c></i>")).toBe(true);
    expect(hasHardcodedOwnedValue('<i style="background/**/:#b6ff3c"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue('<i style="background-color:#b6ff3c"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue('<i style="border-color:#222"></i>')).toBe(true);
    expect(hasHardcodedOwnedValue('<i style="background-color:var(--viz-2)"></i>')).toBe(false);
    expect(hasHardcodedOwnedValue('<i style="border-width:1px"></i>')).toBe(false);
    expect(hasHardcodedOwnedValue('<i data-style="background:#b6ff3c"></i>')).toBe(false);
    expect(hasHardcodedOwnedValue('<i style="width:44%;background:var(--viz-1)"></i>')).toBe(false);
  });

  // Through `attributeValues`, like every other markup gate here. The old
  // `class="…"` regex read one of the three quoting forms, so `class='fa-bug'`
  // and `class=material-icons` walked past a gate whose whole job is to stop
  // them.
  const ICON_FONT = /^(?:fa-|icon-|material-icons$)/i;
  const usesIconFont = (markup: string): boolean =>
    attributeValues(markup, "class")
      .flatMap((value) => value.split(/\s+/).filter(Boolean))
      .some((token) => ICON_FONT.test(token));

  it("uses no icon fonts", () => {
    const offenders = patterns.filter((p) => usesIconFont(p.markup)).map((p) => p.name);
    expect(offenders).toEqual([]);
  });

  it("still rejects an icon font in any quoting form", () => {
    expect(usesIconFont('<i class="fa-bug"></i>')).toBe(true);
    expect(usesIconFont("<i class='fa-bug'></i>")).toBe(true);
    expect(usesIconFont("<i class=material-icons></i>")).toBe(true);
    expect(usesIconFont('<i CLASS="icon-star"></i>')).toBe(true);
    expect(usesIconFont('<i class="u-btn"></i>')).toBe(false);
    // Not a prefix match on the whole attribute: a class that merely contains
    // the letters is a different class.
    expect(usesIconFont('<i class="u-notification-icon-slot"></i>')).toBe(false);
  });
});
