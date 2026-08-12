import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vite-plus/test";

const root = path.resolve(import.meta.dirname, "..");
const productRoot = path.join(root, "assets/products/slopwake");

describe("slopwake product assets", () => {
  test.each(["idle", "active"])("%s menu mark stays template-safe", (state) => {
    const svg = fs.readFileSync(path.join(productRoot, `slopwake-menu-${state}.svg`), "utf8");
    expect(svg).toContain('viewBox="0 0 32 32"');
    expect(svg).toContain("currentColor");
    expect(svg).not.toMatch(/#[0-9a-f]{3,8}/i);
  });

  test("app icon keeps the canonical native palette and source size", () => {
    const svg = fs.readFileSync(path.join(productRoot, "slopwake-app-icon.svg"), "utf8");
    expect(svg).toContain('viewBox="0 0 1024 1024"');
    const colors = (svg.match(/#[0-9a-f]{6}/gi) ?? []).map((color) => color.toUpperCase());
    expect(new Set(colors)).toEqual(new Set(["#090909", "#F4F0E6", "#D4FF3F"]));
  });
});
