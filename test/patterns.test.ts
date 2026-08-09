import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

  it("leaves no unresolved placeholders in attributes", () => {
    const broken = patterns.filter((p) => /(?:src|href)="…"/.test(p.markup)).map((p) => p.name);
    expect(broken).toEqual([]);
  });

  it("keeps token-owned properties out of inline styles", () => {
    // Layout parameters like grid-template-columns are a per-use decision and
    // belong inline. Anything the tokens own must come from a class.
    const owned =
      /(?:^|[;\s])(color|background|border(?!-)|border-radius|box-shadow|font-family|font-size)\s*:/;
    const offenders = patterns
      .filter((p) => [...p.markup.matchAll(/style="([^"]*)"/g)].some((m) => owned.test(m[1])))
      .map((p) => p.name);
    expect(offenders).toEqual([]);
  });

  it("uses no icon fonts", () => {
    const offenders = patterns
      .filter((p) => /class="[^"]*(?:\bfa-|\bicon-|material-icons)/.test(p.markup))
      .map((p) => p.name);
    expect(offenders).toEqual([]);
  });
});
