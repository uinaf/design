import { describe, expect, it } from "vite-plus/test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { attributeValues } from "./attributes.ts";

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

  it("gives every pattern a use, and splits cleanly into components and policy", () => {
    // The contract carries two kinds of entry: a component names classes and
    // shows markup, a policy entry (`icons`) does neither and is rules only.
    // A half-entry — classes with nothing to copy, or markup for classes it
    // never declares — is the drift worth failing on.
    for (const p of components.patterns) {
      expect(p.use, `${p.name} missing use`).toBeTruthy();
      expect(
        p.classes.length > 0,
        `${p.name} declares ${p.classes.length} classes but ${p.markup ? "has" : "has no"} markup`,
      ).toBe(Boolean(p.markup));
    }
  });

  it("keeps markup free of unresolved placeholders in attributes", () => {
    const broken = components.patterns
      .filter((p) => p.markup && /(?:src|href)="…"/.test(p.markup))
      .map((p) => p.name);
    expect(broken).toEqual([]);
  });

  it("gives copyable markup to every pattern that names classes", () => {
    // The gap is closed (#17), so this asserts the invariant rather than a list.
    // Scoped to patterns with classes: the contract now also carries policy
    // entries, which declare none and have nothing to copy by design.
    const missing = components.patterns
      .filter((p) => p.classes.length > 0 && !p.markup)
      .map((p) => p.name);
    expect(missing).toEqual([]);
  });

  it("gives every pattern markup that uses at least one of its own classes", () => {
    // Policy entries declare no classes and ship no markup, so there is nothing
    // to demonstrate; the split is asserted above.
    // Markup copied from the wrong card would still be non-empty. It has to
    // actually demonstrate the pattern it is filed under.
    //
    // Whole tokens inside class attributes only: a substring search would let
    // `.u-btn` be satisfied by `u-btn-primary`, or by the name appearing in an
    // id or in visible copy.
    const classTokens = (markup: string): Set<string> =>
      new Set(attributeValues(markup, "class").flatMap((v) => v.split(/\s+/).filter(Boolean)));
    const mismatched = components.patterns
      .filter((p) => {
        if (p.classes.length === 0) return false; // policy entry — nothing to demonstrate
        const used = classTokens(p.markup ?? "");
        return !p.classes.some((c) => used.has(c.replace(/^\./, "")));
      })
      .map((p) => p.name);
    expect(mismatched).toEqual([]);
  });
});

/**
 * A class nothing demonstrates is how `_ds_bundle.js` (#31) and
 * `colors_and_type.css` (#15) shipped broken: no code path read them, so no
 * code path could fail. These two gates give every class a reader.
 */
describe("every class is demonstrated", () => {
  const classTokens = (html: string): string[] =>
    attributeValues(html, "class").flatMap((v) => v.split(/\s+/).filter(Boolean));

  const markupCorpus = components.patterns.map((p) => p.markup ?? "");
  const htmlCorpus = ["preview", "pages", "templates"].flatMap((dir) =>
    readdirSync(resolve(root, dir))
      .filter((f) => f.endsWith(".html"))
      .map((f) => readFileSync(resolve(root, dir, f), "utf8")),
  );

  // Standalone utilities with no markup of their own: `.u-h1`…`.u-p` and
  // `.u-hr` are the escape hatches for consumers who cannot put `.uinaf` on an
  // ancestor (the CSS pairs each with its element selector), and `.u-frame` /
  // `.u-code-bleed` are opt-in modifiers applied to a host element. Every other
  // class has to appear somewhere a consumer can copy it.

  it("shows every u-* class the CSS defines somewhere copyable", () => {
    const shown = new Set([...htmlCorpus, ...markupCorpus].flatMap(classTokens));
    const orphans = [...definedClasses].filter((c) => !shown.has(c));
    expect(orphans.sort()).toEqual([]);
  });

  it("demonstrates every contract class in the pattern that declares it", () => {
    // components.json is what the MCP tools and the skill serve to agents, and
    // they serve it one pattern at a time. Against the whole corpus this passed
    // while `prose` declared `.u-link-plain` and showed `.u-link` — the class
    // was demonstrated, just not anywhere `get_pattern prose` would return it.
    const undemonstrated = components.patterns.flatMap((p) => {
      const own = new Set(classTokens(p.markup ?? ""));
      return referenced(p)
        .filter((c) => !own.has(c))
        .map((c) => `${p.name} → .${c}`);
    });
    expect(undemonstrated.sort()).toEqual([]);
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
