/**
 * Builds the claude.ai Design System artifact's `project/` files from the repo:
 * tokens from src/tokens.css, one README and preview per pattern from
 * src/components.json, a page card per screen in pages/ and templates/, and
 * bundle.css from the CSS source. Hand-written files
 * under artifact/project/ are copied as they are; artifact/notes.json holds what
 * the source cannot say (token usage notes, type styles, preview cards).
 *
 *   node scripts/artifact.ts     # writes artifact/out/project/ and artifact/out/files.json
 *
 * The index (project/design-system.json) and the uploaded icons and marks stay
 * with the artifact: a publishing session reads them back rather than
 * overwriting them from here.
 */

import fs from "node:fs";
import path from "node:path";
import postcss from "postcss";

const root = path.resolve(import.meta.dirname, "..");
const out = path.join(root, "artifact/out");
const project = path.join(out, "project");

type TypeStyle = { name: string; fontSize: string; usage: string } & Record<string, unknown>;
type Card = { component: string; group: string; height: number };
type Notes = {
  images: Record<string, string>;
  usage: Record<string, string>;
  typeGroups: Array<{ name: string; family: string; styles: TypeStyle[] }>;
  cards: Record<string, Card>;
};
type Pattern = {
  name: string;
  classes: string[];
  use: string;
  markup: string;
  rules?: string[];
  never?: string[];
};

const read = (rel: string): string => fs.readFileSync(path.join(root, rel), "utf8");
const notes = JSON.parse(read("artifact/notes.json")) as Notes;
const { patterns } = JSON.parse(read("src/components.json")) as { patterns: Pattern[] };

const write = (rel: string, text: string): void => {
  const file = path.join(project, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
};

fs.rmSync(out, { recursive: true, force: true });
fs.cpSync(path.join(root, "artifact/project"), project, { recursive: true });

// ---- tokens.json: every :root custom property the artifact format can hold
const sheet = postcss.parse(read("src/tokens.css"), { from: "src/tokens.css" });
const rootRule = sheet.nodes.find(
  (n): n is postcss.Rule => n.type === "rule" && n.selector === ":root",
);
if (!rootRule) throw new Error("src/tokens.css: no :root block");
const vars: Array<readonly [string, string]> = [];
rootRule.walkDecls((decl) => {
  if (decl.prop.startsWith("--"))
    vars.push([decl.prop.slice(2), decl.value.replace(/\s+/g, " ").trim()]);
});
const value = Object.fromEntries(vars);

/** First match wins. Unlisted tokens (motion, hairline shorthands) stay in bundle.css. */
const families: ReadonlyArray<readonly [string, RegExp]> = [
  ["type", /^font-/],
  ["shadow", /^(shadow-|accent-glow$)/],
  ["link", /^link-underline-offset$/],
  ["color", /^(neutral-|bg|fg|border|tick|accent|link|slime-|viz-|ok$|warn$|error$|info$)/],
  ["spacing", /^sp-/],
  ["radius", /^radius-/],
  ["fontSize", /^text-/],
  ["lineHeight", /^leading-/],
  ["letterSpacing", /^tracking-/],
  ["fontWeight", /^weight-/],
  ["layout", /^container-/],
];

// The artifact reads only literal colours or `{alias}` references; var() drops the token.
const colorValue = (v: string): string => v.replace(/^var\(--([a-z0-9-]+)\)$/, "{$1}");

const lists: Record<string, Array<{ name: string; value: string; usage: string }>> = {};
const owned = new Set<string>();
const missing: string[] = [];
for (const [name, v] of vars) {
  const family = families.find(([, pattern]) => pattern.test(name))?.[0];
  if (!family) continue;
  owned.add(name);
  if (family === "type") continue;
  const usage = notes.usage[name];
  if (!usage) missing.push(name);
  (lists[family] ??= []).push({
    name,
    value: family === "color" ? colorValue(v) : v,
    usage: usage ?? "",
  });
}
if (missing.length > 0) {
  throw new Error(
    `artifact/notes.json: no usage note for ${missing.map((n) => `--${n}`).join(", ")}`,
  );
}

const tokens = {
  name: "uinaf design",
  version: 1,
  meta: { source: "github", repo: "uinaf/design", paths: { tokens: ["src/tokens.css"] } },
  color: { themes: [{ id: "dark", name: "Dark" }], tokens: lists.color },
  type: {
    fonts: [],
    families: { mono: value["font-mono"], sans: value["font-mono"], display: value["font-mono"] },
    groups: notes.typeGroups,
  },
  ...Object.fromEntries(
    Object.entries(lists)
      .filter(([family]) => family !== "color")
      .map(([family, list]) => [family, { tokens: list }]),
  ),
};
write("tokens.json", `${JSON.stringify(tokens, null, 2)}\n`);

// ---- bundle.css: the CSS source minus imports and the :root values tokens.json now owns
rootRule.walkDecls((decl) => {
  if (owned.has(decl.prop.slice(2))) decl.remove();
});
sheet.walkAtRules("import", (rule) => {
  rule.remove();
});
sheet.walkComments((comment) => {
  comment.remove();
});
const bundle = [
  // Berkeley Mono is licensed and CDN-only, which the artifact cannot load; previews use the documented substitute.
  '@import url("https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&display=swap");',
  sheet.toString().trim(),
  read("src/components.css").trim(),
].join("\n\n");
write("components/bundle.css", `${bundle}\n`);

// ---- one README and preview per pattern
const names = new Set(patterns.map((p) => p.name));
const unknown = [...names].filter((n) => !notes.cards[n]);
const stale = Object.keys(notes.cards).filter((n) => !names.has(n));
if (unknown.length + stale.length > 0) {
  throw new Error(
    `artifact/notes.json cards: missing ${unknown.join(", ") || "none"}; no such pattern ${stale.join(", ") || "none"}`,
  );
}

const sentence = (s: string): string => {
  const t = s.trim();
  return `${t[0].toUpperCase()}${t.slice(1)}${t.endsWith(".") ? "" : "."}`;
};
const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

for (const p of patterns) {
  const { component, group, height } = notes.cards[p.name];
  let markup = p.markup;
  for (const [cdn, blob] of Object.entries(notes.images)) markup = markup.replaceAll(cdn, blob);
  if (markup.includes("cdn.uinaf.dev"))
    throw new Error(`${p.name}: a cdn.uinaf.dev URL has no entry in notes.images`);

  // Hidden-until-toggled patterns render open so the card shows something.
  const shown = markup
    .replace(/(<div class="u-overlay") hidden>/, "$1>")
    .replace(/(id="menu-list") hidden>/, "$1>");
  write(
    `components/${component}/preview.html`,
    [
      `<!-- @dsCard group="${group}" height=${height} subtitle="${escapeAttr(p.use.split(".")[0].slice(0, 120))}" -->`,
      "<!doctype html>",
      '<html lang="en">',
      `<head><meta charset="utf-8"><title>uinaf · ${p.name}</title>`,
      "<style>html,body{margin:0}body.uinaf{min-height:100vh;padding:var(--sp-5) var(--sp-6)}body.uinaf>*+*{margin-top:var(--sp-3)}</style></head>",
      `<body class="uinaf">\n${p.name === "tooltip" ? `<div style="padding-top:var(--sp-10)">${shown}</div>` : shown}\n</body>`,
      "</html>",
      "",
    ].join("\n"),
  );

  const lines = [`# ${component}`, "", sentence(p.use), ""];
  if (p.classes.length > 0)
    lines.push(`Classes: ${p.classes.map((c) => `\`${c}\``).join(" ")}`, "");
  if (p.rules?.length) lines.push("## Rules", "", ...p.rules.map((r) => `- ${r}`), "");
  if (p.never?.length) lines.push("## Never", "", ...p.never.map((r) => `- ${r}`), "");
  lines.push("## Markup", "", "```html", markup, "```", "");
  write(`components/${component}/README.md`, lines.join("\n"));
}

// ---- whole screens and uinaf.dev surfaces as page cards
const pascal = (slug: string): string =>
  slug.replace(/(^|[-_])([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());

for (const [dir, marker, prefix] of [
  ["pages", "page", "Page"],
  ["templates", "template", "Template"],
] as const) {
  for (const file of fs.readdirSync(path.join(root, dir)).sort()) {
    if (!file.endsWith(".html")) continue;
    const slug = file.replace(/\.html$/, "");
    const html = read(`${dir}/${file}`);
    const m = new RegExp(`@${marker}\\s+name="([^"]+)"\\s+description="([^"]*)"`).exec(html);
    if (!m) throw new Error(`${dir}/${file} has no @${marker} marker`);
    const [, name, description] = m;

    // The frame preloads tokens.css and bundle.css, so the source's own link goes.
    let body = html
      .replace(new RegExp(`^\\s*<!--\\s*@${marker}[\\s\\S]*?-->\\s*$\\n?`, "m"), "")
      .replace(/^\s*<link rel="stylesheet" href="[^"]*tokens\.css" ?\/?>\s*$\n?/m, "");
    for (const [cdn, blob] of Object.entries(notes.images)) body = body.replaceAll(cdn, blob);
    if (body.includes("cdn.uinaf.dev"))
      throw new Error(`${dir}/${file}: a cdn.uinaf.dev URL has no entry in notes.images`);

    // An export artboard states its own canvas; anything else lays out at desktop width.
    const canvas = /width:\s*(\d+)px;\s*height:\s*(\d+)px/.exec(body);
    const artboard = slug.startsWith("export-") && canvas;
    const group = dir === "pages" ? "Screens" : artboard ? "Exports" : "uinaf.dev";
    const size = artboard ? `width=${canvas[1]} height=${canvas[2]}` : "width=1280 height=900";
    const component = `${prefix}${pascal(slug)}`;
    write(
      `components/${component}/preview.html`,
      `<!-- @dsCard group="${group}" ${size} page subtitle="${escapeAttr(name)}" -->\n${body}`,
    );
    write(
      `components/${component}/README.md`,
      `# ${component}\n\n${sentence(description)}\n\nA whole ${dir === "pages" ? "screen" : "surface"}: start from it rather than from components. Markdown: \`https://design.uinaf.dev/${dir}/${slug}.md\`.\n`,
    );
  }
}

// ---- the publish list: every project path, relative to artifact/out
const files: string[] = [];
const walk = (dir: string): void => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else files.push(path.relative(out, full));
  }
};
walk(project);
files.sort();
fs.writeFileSync(path.join(out, "files.json"), `${JSON.stringify(files, null, 2)}\n`);
console.log(
  `artifact: ${files.length} files, ${owned.size} tokens, ${patterns.length} patterns → artifact/out`,
);
