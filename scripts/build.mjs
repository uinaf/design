import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const cssSrc = path.join(root, "src/tokens.css");
const css = fs.readFileSync(cssSrc, "utf8");

fs.mkdirSync(path.join(root, "dist/css"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/css/tokens.css"), css);

const vars = [...css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]);
const obj = Object.fromEntries(vars);
fs.writeFileSync(path.join(root, "dist/tokens.flat.json"), JSON.stringify(obj, null, 2) + "\n");
fs.writeFileSync(
  path.join(root, "dist/tokens.js"),
  `export const tokens = ${JSON.stringify(obj, null, 2)}\nexport default tokens\n`,
);
const keys = vars.map(([k]) => `  "${k}": string`).join("\n");
fs.writeFileSync(
  path.join(root, "dist/tokens.d.ts"),
  `export declare const tokens: {\n${keys}\n}\nexport default tokens\n`,
);

const cdnSrc = fs.readFileSync(path.join(root, "src/cdn.ts"), "utf8");
// emit plain JS + d.ts without a bundler
fs.writeFileSync(
  path.join(root, "dist/cdn.js"),
  cdnSrc
    .replace(/\/\*\*[\s\S]*?\*\/\n/, "")
    .replace(/ as const/g, "")
    .replace(/: string/g, ""),
);
fs.writeFileSync(
  path.join(root, "dist/cdn.d.ts"),
  `export declare const CDN: {
  readonly origin: "https://cdn.uinaf.dev"
  readonly berkeleyMonoVariableCss: "https://cdn.uinaf.dev/fonts/berkeley-mono/variable/font.css"
  readonly berkeleyMonoStaticRegularWoff: "https://cdn.uinaf.dev/fonts/berkeley-mono/static/berkeley-mono-regular.woff"
  readonly images: {
    readonly computer240: "https://cdn.uinaf.dev/images/webp/uinaf-computer-240w.webp"
    readonly team: "https://cdn.uinaf.dev/images/webp/uinaf-team.webp"
  }
}
`,
);

console.log(`built ${vars.length} tokens`);
