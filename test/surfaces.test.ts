import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vite-plus/test";

const root = path.resolve(import.meta.dirname, "..");
const surfaceDirs = ["preview", "pages", "templates"];

const htmlFiles = (): string[] =>
  surfaceDirs.flatMap((dir) =>
    fs
      .readdirSync(path.join(root, dir))
      .sort()
      .filter((file) => file.endsWith(".html"))
      .map((file) => `${dir}/${file}`),
  );

/** Every `src=` / `href=` in an authored surface that names a path instead of a url. */
const localRefs = (): { file: string; ref: string }[] =>
  htmlFiles().flatMap((file) =>
    [
      ...fs
        .readFileSync(path.join(root, file), "utf8")
        .matchAll(/(?:src|href)="((?!https?:|data:|mailto:|#)[^"]+)"/g),
    ].map(([, ref]) => ({ file, ref })),
  );

const shipped = new Set<string>(
  JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).files as string[],
);

describe("authored surfaces", () => {
  it("has local references to check", () => {
    expect(localRefs().length).toBeGreaterThan(0);
  });

  // `guide:sync` used to rewrite `../assets/uinaf-*.png` to the cdn on the way
  // out, so a path that resolved to nothing still published correctly and only
  // broke in the tarball. Resolving against the repo catches the source.
  //
  // Containment is the other half: a ref that climbs out of the repo resolves on
  // the author's machine and 404s once the guide serves the file from its own
  // root, so existence alone would pass it.
  it("resolves every local reference to a file inside the repo", () => {
    const broken = localRefs().filter(({ file, ref }) => {
      const resolved = path.resolve(root, path.dirname(file), ref.replace(/[?#].*$/, ""));
      const inside = path.relative(root, resolved);
      return inside.startsWith("..") || path.isAbsolute(inside) || !fs.existsSync(resolved);
    });
    expect(broken).toEqual([]);
  });

  // These are whole HTML documents reached by url, and no `exports` entry maps
  // them, so a shipped copy is 145 kB a consumer cannot import. The pull to
  // re-add one is real: a card iframes `../pages/dashboard.html`, which reads
  // like the tarball owes it that file. It does not. The guide serves it. The
  // parity check in `scripts/check.ts` catches `files` drifting from `SHIPPED`,
  // but not both being widened together, which is exactly how this arrived.
  it("keeps the by-url surfaces out of the tarball", () => {
    expect(surfaceDirs.filter((dir) => shipped.has(dir))).toEqual([]);
  });
});
