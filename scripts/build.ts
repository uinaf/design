import fs from "node:fs";
import path from "node:path";
import * as esbuild from "esbuild";
import { CDN } from "../src/cdn.ts";

const root = path.resolve(import.meta.dirname, "..");
const css = fs.readFileSync(path.join(root, "src/tokens.css"), "utf8");

fs.mkdirSync(path.join(root, "dist/css"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/css/tokens.css"), css);
fs.copyFileSync(path.join(root, "src/components.css"), path.join(root, "dist/css/components.css"));

const vars = [...css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map(
  (m) => [m[1], m[2].trim()] as const,
);
const obj = Object.fromEntries(vars);

/** Ordered prefix rules; first match wins. Every token must land in exactly one group. */
const groupRules: ReadonlyArray<readonly [string, RegExp]> = [
  ["typography", /^(font|text|leading|tracking|weight)-/],
  ["neutrals", /^neutral-/],
  ["accent", /^accent(-|$)/],
  ["links", /^link(-|$)/],
  ["slime", /^slime-/],
  ["viz", /^viz-/],
  ["status", /^(ok|warn|error|info)$/],
  ["spacing", /^sp-/],
  ["radius", /^radius-/],
  ["borders", /^hairline(-|$)/],
  ["shadows", /^shadow-/],
  ["motion", /^(ease|duration|stagger)-/],
  ["layout", /^container-/],
  ["semantic", /^(bg|fg|border|tick)(-|$)/],
];

const groups: Record<string, Record<string, string>> = Object.fromEntries(
  groupRules.map(([name]) => [name, {}]),
);
const ungrouped: string[] = [];
for (const [name, value] of vars) {
  const rule = groupRules.find(([, pattern]) => pattern.test(name));
  if (!rule) {
    ungrouped.push(name);
    continue;
  }
  groups[rule[0]][`--${name}`] = value;
}
if (ungrouped.length > 0) {
  throw new Error(
    `tokens.json: no group for ${ungrouped.map((n) => `--${n}`).join(", ")} — add a rule to groupRules in scripts/build.ts`,
  );
}

fs.writeFileSync(
  path.join(root, "dist/tokens.json"),
  `${JSON.stringify(
    {
      $schema: "uinaf design tokens v2",
      $source: "src/tokens.css (generated in the build — do not hand-edit)",
      groups,
    },
    null,
    2,
  )}\n`,
);
fs.writeFileSync(path.join(root, "dist/tokens.flat.json"), `${JSON.stringify(obj, null, 2)}\n`);
fs.writeFileSync(
  path.join(root, "dist/tokens.js"),
  `export const tokens = ${JSON.stringify(obj, null, 2)}\nexport default tokens\n`,
);
const keys = vars.map(([k]) => `  "${k}": string`).join("\n");
fs.writeFileSync(
  path.join(root, "dist/tokens.d.ts"),
  `export declare const tokens: {\n${keys}\n}\nexport default tokens\n`,
);

type Pattern = {
  name: string;
  classes: string[];
  use: string;
  markup?: string;
  rules?: string[];
  never?: string[];
};

const components = JSON.parse(fs.readFileSync(path.join(root, "src/components.json"), "utf8")) as {
  patterns: Pattern[];
};

const componentsCss = fs.readFileSync(path.join(root, "src/components.css"), "utf8");
// Strip comments and url()/quoted content first: `cdn.uinaf.dev/…/font.css`
// otherwise contributes `uinaf`, `dev`, and `css` as if they were selectors,
// which would let a markup class by those names slip past the drift guard.
const allCss = `${css}${componentsCss}`
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/url\([^)]*\)/g, " ")
  .replace(/"[^"]*"|'[^']*'/g, " ");
// u-* classes are the public contract; every class the CSS defines — including
// scoped helpers like `.u-crumbs .sep` — is what markup is allowed to use.
const publicClasses = new Set([...allCss.matchAll(/\.(u-[a-zA-Z0-9_-]+)/g)].map((m) => m[1]));
const definedClasses = new Set(
  [...allCss.matchAll(/\.([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]),
);
// Both the declared contract and the markup itself: a chunk that styles itself
// with a class nobody ships is the exact drift this artifact exists to prevent.
const declared = components.patterns.flatMap((p) =>
  p.classes
    .map((c) => c.replace(/^\./, "").split(/[\s:>,[]/)[0])
    .filter((c) => c.startsWith("u-") && !publicClasses.has(c))
    .map((c) => `${p.name} classes → .${c}`),
);
// All three HTML attribute forms — double-quoted, single-quoted, and bare —
// or markup could dodge the guard just by changing its quoting.
const classAttr = /class\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
const inMarkup = components.patterns.flatMap((p) =>
  [...(p.markup ?? "").matchAll(classAttr)]
    .flatMap((m) => (m[1] ?? m[2] ?? m[3] ?? "").split(/\s+/))
    .filter((c) => c && !definedClasses.has(c))
    .map((c) => `${p.name} markup → .${c}`),
);
const undefinedClasses = [...declared, ...inMarkup];
if (undefinedClasses.length > 0) {
  throw new Error(
    `components.json uses classes the CSS does not define:\n  ${undefinedClasses.join("\n  ")}`,
  );
}

const slug = (name: string): string => name.replace(/\+/g, "-").replace(/[^a-z0-9-]/gi, "-");

// Absolute so a chunk previews correctly wherever it is opened — served from the
// guide, opened from dist/patterns/, or saved anywhere else. In a real project,
// import the package instead of linking this URL.
const patternPage = (p: Pattern): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>uinaf — ${p.name}</title>
<link rel="stylesheet" href="https://design.uinaf.dev/tokens.css">
</head>
<body class="uinaf">
<!-- In your project: @import "@uinaf/design/css"; then copy the markup below. -->
${p.markup}
</body>
</html>
`;

const patternsDir = path.join(root, "dist/patterns");
fs.rmSync(patternsDir, { recursive: true, force: true });
fs.mkdirSync(patternsDir, { recursive: true });
let chunks = 0;
for (const p of components.patterns) {
  if (!p.markup) continue;
  fs.writeFileSync(path.join(patternsDir, `${slug(p.name)}.html`), patternPage(p));
  chunks += 1;
}

fs.writeFileSync(
  path.join(root, "dist/components.json"),
  `${JSON.stringify(
    {
      ...components,
      patterns: components.patterns.map((p) => ({
        ...p,
        slug: slug(p.name),
        ...(p.markup
          ? {
              chunk: `https://design.uinaf.dev/patterns/${slug(p.name)}.html`,
              chunkFile: `./patterns/${slug(p.name)}.html`,
            }
          : {}),
      })),
    },
    null,
    2,
  )}\n`,
);

// The lint ships as real JS. Node refuses to strip types for anything under
// node_modules, so a consumer running `design-check` from the installed package
// cannot execute TypeScript source however new their runtime is.
const lintOut = path.join(root, "dist/lint");
fs.rmSync(lintOut, { recursive: true, force: true });
await esbuild.build({
  entryPoints: [path.join(root, "src/lint/cli.ts"), path.join(root, "src/lint/index.ts")],
  outdir: lintOut,
  platform: "node",
  target: "node24",
  format: "esm",
  bundle: true,
  packages: "external",
});
// esbuild emits no declarations, and the ./lint export is a public API.
fs.writeFileSync(
  path.join(lintOut, "index.d.ts"),
  `export type Severity = "error" | "warn";
export type Violation = {
  rule: string;
  severity: Severity;
  file: string;
  line: number;
  message: string;
  fix: string;
};
export type MarkupOptions = { abbreviations?: string[] };
export type CheckOptions = MarkupOptions & { paths?: string[]; ignore?: string[] };
export type RatchetResult = {
  passed: boolean;
  risen: Array<{ rule: string; was: number; now: number }>;
  improved: Array<{ rule: string; was: number; now: number }>;
};
export declare const check: (options?: CheckOptions) => Violation[];
export declare const checkFile: (file: string, options?: CheckOptions) => Violation[];
export declare const checkCss: (css: string, file: string) => Violation[];
export declare const checkMarkup: (
  source: string,
  file: string,
  options?: MarkupOptions,
) => Violation[];
export declare const collectFiles: (roots: string[], ignore?: string[]) => string[];
export declare const countByRule: (violations: Violation[]) => Record<string, number>;
export declare const compareRatchet: (
  baseline: Record<string, number>,
  current: Record<string, number>,
) => RatchetResult;
export declare const formatViolation: (violation: Violation) => string;
export declare const hasErrors: (violations: Violation[]) => boolean;
export declare const summarise: (violations: Violation[]) => string;
`,
);

const literalType = (value: unknown, indent = 0): string => {
  const pad = "  ".repeat(indent);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${pad}  readonly ${k}: ${literalType(v, indent + 1)}`)
      .join("\n");
    return `{\n${entries}\n${pad}}`;
  }
  throw new Error(`unsupported CDN value: ${typeof value}`);
};

fs.writeFileSync(
  path.join(root, "dist/cdn.js"),
  `export const CDN = ${JSON.stringify(CDN, null, 2)}\n`,
);
fs.writeFileSync(
  path.join(root, "dist/cdn.d.ts"),
  `export declare const CDN: ${literalType(CDN)}\n`,
);

console.log(
  `built ${vars.length} tokens across ${Object.keys(groups).length} groups · ${components.patterns.length} patterns, ${chunks} chunks`,
);
