import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { CDN, cdnUrls } from "../src/cdn";

const root = path.resolve(import.meta.dirname, "..");

// `guide/index.html` is hand-authored, not synced, so it is the one published
// surface that can name a url no build step ever sees.
const authoredFiles = (): string[] => {
  const files = ["guide/index.html"];
  for (const dir of ["preview", "pages", "templates"]) {
    for (const file of fs.readdirSync(path.join(root, dir)).sort()) {
      if (file.endsWith(".html")) files.push(`${dir}/${file}`);
    }
  }
  return files;
};

const authored = (): { file: string; url: string }[] =>
  authoredFiles().flatMap((file) =>
    [
      ...fs
        .readFileSync(path.join(root, file), "utf8")
        .matchAll(/https:\/\/cdn\.uinaf\.dev[^"')\s]*/g),
    ].map((m) => ({ file, url: m[0] })),
  );

describe("CDN", () => {
  it("points fonts at cdn.uinaf.dev", () => {
    expect(CDN.berkeleyMonoVariableCss).toContain("cdn.uinaf.dev/fonts/berkeley-mono");
  });

  it("keeps every declared url on the cdn origin", () => {
    expect(cdnUrls().length).toBeGreaterThan(0);
    for (const url of cdnUrls()) {
      expect(url.startsWith(`${CDN.origin}/`)).toBe(true);
    }
  });

  // Counted from the source text rather than from `CDN` itself, so the walk is
  // proved against something that does not use it. A leaf the walk cannot reach
  // is invisible to both `cdn:check` and the gate below — the same 404 nobody
  // can grep for, arrived at from inside the declaration.
  it("flattens every url the declaration writes, dropping none", () => {
    const declared = [
      ...fs
        .readFileSync(path.join(root, "src/cdn.ts"), "utf8")
        .matchAll(/"(https:\/\/cdn\.uinaf\.dev[^"]*)"/g),
    ]
      .map(([, url]) => url)
      .filter((url) => url !== CDN.origin);

    expect(cdnUrls().sort()).toEqual(declared.sort());
  });

  // The CDN is a separate repo, so a url that is only ever written inline is a
  // 404 nobody can grep for. Declaring it here is what makes `cdn:check` able
  // to prove the asset exists before the guide deploys.
  it("declares every cdn url the authored surfaces use", () => {
    const known = new Set(cdnUrls());
    const undeclared = authored().filter(({ url }) => !known.has(url));
    expect(undeclared).toEqual([]);
  });
});
