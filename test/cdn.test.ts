import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { CDN } from "../src/cdn";

const root = path.resolve(import.meta.dirname, "..");

const declared = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Object.values(value as Record<string, unknown>).flatMap(declared);

const authored = (): { file: string; url: string }[] => {
  const found: { file: string; url: string }[] = [];
  for (const dir of ["preview", "pages", "templates"]) {
    for (const file of fs.readdirSync(path.join(root, dir)).sort()) {
      if (!file.endsWith(".html")) continue;
      const html = fs.readFileSync(path.join(root, dir, file), "utf8");
      for (const m of html.matchAll(/https:\/\/cdn\.uinaf\.dev[^"')\s]*/g)) {
        found.push({ file: `${dir}/${file}`, url: m[0] });
      }
    }
  }
  return found;
};

describe("CDN", () => {
  it("points fonts at cdn.uinaf.dev", () => {
    expect(CDN.berkeleyMonoVariableCss).toContain("cdn.uinaf.dev/fonts/berkeley-mono");
  });

  it("keeps every declared url on the cdn origin", () => {
    for (const url of declared(CDN)) {
      if (url === CDN.origin) continue;
      expect(url.startsWith(`${CDN.origin}/`)).toBe(true);
    }
  });

  // The CDN is a separate repo, so a url that is only ever written inline is a
  // 404 nobody can grep for. Declaring it here is what makes `cdn:check` able
  // to prove the asset exists before the guide deploys.
  it("declares every cdn url the authored surfaces use", () => {
    const known = new Set(declared(CDN));
    const undeclared = authored().filter(({ url }) => !known.has(url));
    expect(undeclared).toEqual([]);
  });
});
