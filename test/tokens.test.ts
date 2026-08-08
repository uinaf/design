import { describe, expect, it } from "vite-plus/test";
import fs from "node:fs";
import path from "node:path";

describe("tokens.css", () => {
  it("loads fonts from CDN and never local binaries", () => {
    const css = fs.readFileSync(path.resolve(import.meta.dirname, "../src/tokens.css"), "utf8");
    expect(css).toContain("cdn.uinaf.dev/fonts/berkeley-mono");
    expect(css).not.toContain("./fonts/");
    expect(css).toContain("--accent:");
  });
});
