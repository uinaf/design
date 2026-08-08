import fs from "node:fs";
import path from "node:path";
import { CDN } from "../src/cdn.ts";

const root = path.resolve(import.meta.dirname, "..");
const cssSrc = path.join(root, "src/tokens.css");
const css = fs.readFileSync(cssSrc, "utf8");

fs.mkdirSync(path.join(root, "dist/css"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/css/tokens.css"), css);

const vars = [...css.matchAll(/--([a-z0-9-]+):\s*([^;]+);/gi)].map(
  (m) => [m[1], m[2].trim()] as const,
);
const obj = Object.fromEntries(vars);
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

console.log(`built ${vars.length} tokens`);
