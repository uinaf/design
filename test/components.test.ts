import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

type Pattern = {
  name: string;
  classes: string[];
  use: string;
  markup?: string;
};

const components = JSON.parse(readFileSync(resolve(root, "src/components.json"), "utf8")) as {
  patterns: Pattern[];
};
const css =
  readFileSync(resolve(root, "src/tokens.css"), "utf8") +
  readFileSync(resolve(root, "src/components.css"), "utf8");
const definedClasses = new Set([...css.matchAll(/\.(u-[a-zA-Z0-9_-]+)/g)].map((m) => m[1]));

const referenced = (p: Pattern): string[] =>
  p.classes.map((c) => c.replace(/^\./, "").split(/[\s:>,[]/)[0]).filter((c) => c.startsWith("u-"));

describe("components.json", () => {
  it("names only classes the CSS defines", () => {
    const undefined_ = components.patterns.flatMap((p) =>
      referenced(p)
        .filter((c) => !definedClasses.has(c))
        .map((c) => `${p.name} → .${c}`),
    );
    expect(undefined_).toEqual([]);
  });

  it("gives every pattern a use and at least one class", () => {
    for (const p of components.patterns) {
      expect(p.use, `${p.name} missing use`).toBeTruthy();
      expect(p.classes.length, `${p.name} has no classes`).toBeGreaterThan(0);
    }
  });

  it("keeps markup free of unresolved placeholders in attributes", () => {
    const broken = components.patterns
      .filter((p) => p.markup && /(?:src|href)="…"/.test(p.markup))
      .map((p) => p.name);
    expect(broken).toEqual([]);
  });

  it("has markup for the patterns that currently carry it", () => {
    // Coverage is partial upstream — see the tracked markup gap. This locks in
    // what exists so a regression cannot silently drop a chunk.
    const withMarkup = components.patterns
      .filter((p) => p.markup)
      .map((p) => p.name)
      .sort();
    expect(withMarkup).toEqual([
      "breadcrumbs",
      "button",
      "card",
      "field",
      "micro-label",
      "pagination",
      "panel",
      "panel-grid",
      "stat",
      "table",
      "tag+dot",
      "topbar",
    ]);
  });
});

describe("class extraction", () => {
  it("does not treat URL fragments as defined classes", () => {
    // cdn.uinaf.dev/…/font.css would otherwise contribute `dev` and `css`,
    // letting markup use those names without the CSS defining anything.
    const raw =
      readFileSync(resolve(root, "src/tokens.css"), "utf8") +
      readFileSync(resolve(root, "src/components.css"), "utf8");
    const stripped = raw
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/url\([^)]*\)/g, " ")
      .replace(/"[^"]*"|'[^']*'/g, " ");
    const defined = new Set(
      [...stripped.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]),
    );
    expect(defined.has("dev")).toBe(false);
    expect(defined.has("css")).toBe(false);
    expect(defined.has("uinaf")).toBe(true);
  });
});
