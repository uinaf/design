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
  JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).files,
);

describe("authored surfaces", () => {
  it("has local references to check", () => {
    expect(localRefs().length).toBeGreaterThan(0);
  });

  // `guide:sync` used to rewrite `../assets/uinaf-*.png` to the cdn on the way
  // out, so a path that resolved to nothing still published correctly and only
  // broke in the tarball. Resolving against the repo catches the source.
  it("resolves every local reference to a file that exists", () => {
    const broken = localRefs().filter(
      ({ file, ref }) =>
        !fs.existsSync(path.resolve(root, path.dirname(file), ref.replace(/[?#].*$/, ""))),
    );
    expect(broken).toEqual([]);
  });

  // A card that iframes `pages/dashboard.html` is blank for a consumer unless
  // `pages` is in the tarball. Whatever an authored surface points at has to
  // travel with it.
  it("only references directories the tarball ships", () => {
    const unshipped = localRefs()
      .map(({ file, ref }) => ({
        file,
        ref,
        top: path.relative(root, path.resolve(root, path.dirname(file), ref)).split(path.sep)[0],
      }))
      .filter(({ top }) => top !== undefined && !shipped.has(top));

    expect(unshipped).toEqual([]);
  });
});
