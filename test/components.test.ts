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

  it("gives every pattern copyable markup", () => {
    // The gap is closed (#17). A pattern without markup is now a regression,
    // not a known hole, so this asserts the invariant rather than a list.
    const missing = components.patterns.filter((p) => !p.markup).map((p) => p.name);
    expect(missing).toEqual([]);
  });

  it("gives every pattern markup that uses at least one of its own classes", () => {
    // Markup copied from the wrong card would still be non-empty. It has to
    // actually demonstrate the pattern it is filed under.
    //
    // Whole tokens inside class attributes only: a substring search would let
    // `.u-btn` be satisfied by `u-btn-primary`, or by the name appearing in an
    // id or in visible copy.
    const classTokens = (markup: string): Set<string> =>
      new Set(
        [...markup.matchAll(/class="([^"]*)"/g)].flatMap((m) => m[1].split(/\s+/)).filter(Boolean),
      );
    const mismatched = components.patterns
      .filter((p) => {
        const used = classTokens(p.markup ?? "");
        return !p.classes.some((c) => used.has(c.replace(/^\./, "")));
      })
      .map((p) => p.name);
    expect(mismatched).toEqual([]);
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
