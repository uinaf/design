import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

describe("tokens.css", () => {
  const css = readFileSync(resolve(root, "src/tokens.css"), "utf8");

  it("references CDN Berkeley Mono and no local font files", () => {
    expect(css).toContain("cdn.uinaf.dev/fonts/berkeley-mono");
    expect(css).not.toContain("./fonts/");
  });

  it("exposes core semantic tokens", () => {
    expect(css).toContain("--accent:");
    expect(css).toContain("--bg:");
    expect(css).toContain("--font-mono:");
  });

  it("keeps element defaults at zero specificity", () => {
    // `.uinaf h1` is 0,1,1 and outranks every 0,1,0 `u-` class, so it silently
    // won over the class the markup asked for: `<h1 class="u-display">` rendered
    // at 24px and `<p class="u-meta">` at 14px. Element defaults must go through
    // `:where()` or the whole typography scale is unreachable inside `.uinaf`.
    // A bare element name is the one thing that starts with a letter here.
    // `:where(…)`, `::selection`, `:focus-visible`, and `.uinaf {` all do not.
    const bare = [...css.matchAll(/^\.uinaf [a-z][^,{]*/gm)].map((m) => m[0].trim());
    expect(bare).toEqual([]);
  });
});

describe("package boundary", () => {
  it("does not ship fonts/ in package files", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.files).not.toContain("fonts");
    expect(pkg.files.every((f: string) => !f.includes("font"))).toBe(true);
  });
});
