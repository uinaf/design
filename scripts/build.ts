import fs from "node:fs";
import path from "node:path";
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

console.log(`built ${vars.length} tokens across ${Object.keys(groups).length} groups`);
