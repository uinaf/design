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
});

describe("package boundary", () => {
  it("does not ship fonts/ in package files", () => {
    const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
    expect(pkg.files).not.toContain("fonts");
    expect(pkg.files.every((f: string) => !f.includes("font"))).toBe(true);
  });
});
