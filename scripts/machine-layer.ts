import fs from "node:fs";
import path from "node:path";

/**
 * Generates the agent-facing half of design.uinaf.dev: a markdown twin for every
 * page, the llms.txt index, and skill discovery. Everything here is a build
 * output — the Worker serves files and never authors content, so the docs,
 * tokens, and pattern contract cannot drift apart.
 */

const root = path.resolve(import.meta.dirname, "..");
const guide = path.join(root, "guide");

type Pattern = {
  name: string;
  slug: string;
  classes: string[];
  use: string;
  markup: string;
  rules?: string[];
  never?: string[];
};

const components = JSON.parse(fs.readFileSync(path.join(root, "dist/components.json"), "utf8")) as {
  patterns: Pattern[];
};

const previews = JSON.parse(fs.readFileSync(path.join(guide, "previews.json"), "utf8")) as Array<{
  slug: string;
  group: string;
  name: string;
  subtitle: string;
}>;

const write = (relative: string, body: string): void => {
  const target = path.join(guide, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body);
};

const bullets = (heading: string, items?: string[]): string =>
  items?.length ? `\n**${heading}**\n${items.map((r) => `- ${r}`).join("\n")}\n` : "";

// The "Classes used" line of every twin. Single-quoted values are equally valid
// HTML, so a double-quote-only read would print an empty list for a file the
// browser styles fine — and the twin is the only form an agent fetches.
const uClasses = (html: string): string[] =>
  [
    ...new Set(
      [...html.matchAll(/class\s*=\s*(?:"([^"]*)"|'([^']*)')/g)]
        .flatMap((m) => (m[1] ?? m[2] ?? "").split(/\s+/))
        .filter((c) => c.startsWith("u-")),
    ),
  ].sort();

const classList = (classes: string[]): string =>
  classes.length ? classes.map((c) => `.${c}`).join(", ") : "none";

const relatedPatterns = (classes: string[]): Pattern[] =>
  components.patterns.filter((p) => p.classes.some((c) => classes.includes(c.replace(/^\./, ""))));

const patternLinks = (heading: string, classes: string[]): string => {
  const related = relatedPatterns(classes);
  if (related.length === 0) return "";
  const items = related.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n");
  return `\n**${heading}**\n${items}\n`;
};

// Generated output is gitignored, so a renamed or deleted pattern would leave
// an orphan twin that Wrangler keeps deploying. Clear before writing.
for (const name of fs.readdirSync(path.join(guide, "patterns"))) {
  if (name.endsWith(".md")) fs.rmSync(path.join(guide, "patterns", name));
}
fs.rmSync(path.join(guide, ".well-known"), { recursive: true, force: true });
for (const name of fs.readdirSync(path.join(guide, "preview"))) {
  if (name.endsWith(".md")) fs.rmSync(path.join(guide, "preview", name));
}

// One markdown twin per pattern. This is the token-cheap form of a chunk: an
// agent gets the contract and the markup without parsing a full HTML document.
for (const p of components.patterns) {
  const markup = `\n\`\`\`html\n${p.markup}\n\`\`\`\n`;
  // A policy entry names no classes — `icons` restricts an idiom rather than
  // shipping one. An empty "Classes —" line reads as a build bug, so say it.
  const classes = p.classes.length > 0 ? p.classes.join(", ") : "none — this entry is policy";
  write(
    `patterns/${p.slug}.md`,
    `# ${p.name}

${p.use}

**Classes** — ${classes}
${bullets("Rules", p.rules)}${bullets("Never", p.never)}${markup}
Import \`@uinaf/design/css\`, then copy the markup. Full contract: /components.json
`,
  );
}

// Preview cards are negotiated too, so each needs a twin. The useful markdown
// form of a visual demo is what it demonstrates, not a prose retelling of it.
for (const card of previews) {
  const html = fs.readFileSync(path.join(guide, "preview", `${card.slug}.html`), "utf8");
  const classes = uClasses(html);
  write(
    `preview/${card.slug}.md`,
    `# ${card.name}

${card.group}${card.subtitle ? ` — ${card.subtitle}` : ""}

Rendered card: /preview/${card.slug}.html

**Classes demonstrated** — ${classList(classes)}
${patternLinks("Related patterns", classes)}`,
  );
}

// Reference pages: whole screens an agent can start from instead of assembling
// one out of patterns. The markdown twin carries the page's full markup, so a
// single fetch is enough to build the screen.
const pages = JSON.parse(fs.readFileSync(path.join(guide, "pages.json"), "utf8")) as Array<{
  slug: string;
  name: string;
  description: string;
}>;

for (const name of fs.readdirSync(path.join(guide, "pages"))) {
  if (name.endsWith(".md")) fs.rmSync(path.join(guide, "pages", name));
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(guide, "pages", `${page.slug}.html`), "utf8");
  const classes = uClasses(html);
  write(
    `pages/${page.slug}.md`,
    `# ${page.name}

${page.description}

Rendered page: /pages/${page.slug}.html

**Classes used** — ${classList(classes)}
${patternLinks("Patterns on this page", classes)}
\`\`\`html
${html.trim()}
\`\`\`

Copy the markup and replace the content. Import \`@uinaf/design/css\` for the
classes above; take any custom value from /tokens.json.
`,
  );
}

// Templates: whole uinaf.dev surfaces and the export artboards. Same twin shape
// as a page, plus the canvas size — an artboard is a file to render, not a page
// to adapt, and an agent that cannot see that will paste 2560px into a layout.
const templates = JSON.parse(fs.readFileSync(path.join(guide, "templates.json"), "utf8")) as Array<{
  slug: string;
  name: string;
  description: string;
  canvas?: { width: number; height: number };
}>;

for (const name of fs.readdirSync(path.join(guide, "templates"))) {
  if (name.endsWith(".md")) fs.rmSync(path.join(guide, "templates", name));
}

for (const template of templates) {
  const html = fs.readFileSync(path.join(guide, "templates", `${template.slug}.html`), "utf8");
  const classes = uClasses(html);
  write(
    `templates/${template.slug}.md`,
    `# ${template.name}

${template.description}
${
  template.canvas
    ? `\nFixed export canvas — ${template.canvas.width}×${template.canvas.height}. Render it at that size; do not adapt it into a page.\n`
    : ""
}
Rendered template: /templates/${template.slug}.html

**Classes used** — ${classList(classes)}

\`\`\`html
${html.trim()}
\`\`\`

Copy the markup and replace the content. Import \`@uinaf/design/css\` for the
classes above; take any custom value from /tokens.json.
`,
  );
}

// Reference docs served as-is; they are already markdown.
for (const [source, name] of [
  ["DESIGN.md", "design"],
  ["README.md", "readme"],
] as const) {
  write(`${name}.md`, fs.readFileSync(path.join(root, source), "utf8"));
}

write(
  "index.md",
  `# uinaf design system

Tokens, CSS primitives, and the pattern contract for uinaf interfaces.
Machine-readable by design: fetch a pattern instead of writing UI from memory.

## Start here

- /components.json — the pattern contract, ${components.patterns.length} patterns
- /tokens.json — design tokens, grouped
- /design.md — the spec: voice, type, color, structure, layout, guardrails

## Reference pages (${pages.length})

Whole screens. Start here when building a page rather than a component.

${pages.map((p) => `- [${p.name}](/pages/${p.slug}.md) — ${p.description}`).join("\n")}

## Templates (${templates.length})

uinaf.dev's own surfaces, and the fixed-size export artboards.

${templates.map((t) => `- [${t.name}](/templates/${t.slug}.md) — ${t.description}`).join("\n")}

## Patterns (${components.patterns.length})

${components.patterns.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}

## Preview cards

${previews.map((c) => `- [${c.name}](/preview/${c.slug}.html) — ${c.group}${c.subtitle ? `, ${c.subtitle}` : ""}`).join("\n")}

## CSS

\`\`\`css
@import "@uinaf/design/css";
\`\`\`

With no bundler, link \`node_modules/@uinaf/design/dist/css/tokens.css\` instead — a browser does not resolve a bare specifier.

Berkeley Mono is licensed and loads from cdn.uinaf.dev — never bundle it.
`,
);

write(
  "llms.txt",
  `# uinaf design system

> Tokens, CSS primitives, and a ${components.patterns.length}-pattern contract for building uinaf-branded interfaces. Fetch a pattern before writing any component.

Use the MCP server at https://design.uinaf.dev/mcp when it is connected.
Otherwise choose one relevant link below and fetch that Markdown artifact; do
not load the whole catalog. Start with design.md for voice and general rules.

## Guidelines

- [design.md](https://design.uinaf.dev/design.md): canonical voice, type, color, structure, components, layout, motion, and guardrails.
- [readme.md](https://design.uinaf.dev/readme.md): package installation and usage.

## Contract

- [components.json](https://design.uinaf.dev/components.json): every pattern with classes, use, rules, and nevers. Every pattern carries copyable markup.
- [tokens.json](https://design.uinaf.dev/tokens.json): design tokens grouped by role.

## Reference pages

Whole screens, markup included. Prefer these over assembling a page from patterns.

${pages.map((p) => `- [${p.name}](https://design.uinaf.dev/pages/${p.slug}.md): ${p.description}`).join("\n")}

## Templates

uinaf.dev's own surfaces plus the fixed-size export artboards.

${templates.map((t) => `- [${t.name}](https://design.uinaf.dev/templates/${t.slug}.md): ${t.description}`).join("\n")}

## Patterns

${components.patterns.map((p) => `- [${p.name}](https://design.uinaf.dev/patterns/${p.slug}.md): ${p.use}`).join("\n")}

## Optional

- [index.md](https://design.uinaf.dev/index.md): the complete guide as Markdown.
- [SKILL.md](https://design.uinaf.dev/.well-known/skills/uinaf-design/SKILL.md): the manual workflow router; design rules live in the artifacts above.
`,
);

const skill = fs.readFileSync(path.join(root, "skills/uinaf-design/SKILL.md"), "utf8");
write(".well-known/skills/uinaf-design/SKILL.md", skill);
write(
  ".well-known/skills/index.json",
  `${JSON.stringify(
    {
      skills: [
        {
          name: "uinaf-design",
          description: "Route explicitly scoped uinaf work to the live design contract.",
          path: "/.well-known/skills/uinaf-design/SKILL.md",
        },
      ],
    },
    null,
    2,
  )}\n`,
);

// Deploy identity. wrangler ships the Worker and its assets as one version, so
// an asset that changes with every build is proof the new Worker is live —
// components.json is not, because a Worker-only change leaves it byte-identical
// and the post-deploy smoke would then pass against the deployment it replaced.
write(".well-known/build", `${process.env.GITHUB_SHA ?? "dev"}\n`);

const twins = fs.readdirSync(path.join(guide, "patterns")).filter((f) => f.endsWith(".md")).length;
const cards = fs.readdirSync(path.join(guide, "preview")).filter((f) => f.endsWith(".md")).length;
const pageTwins = fs.readdirSync(path.join(guide, "pages")).filter((f) => f.endsWith(".md")).length;
const templateTwins = fs
  .readdirSync(path.join(guide, "templates"))
  .filter((f) => f.endsWith(".md")).length;
console.log(
  `machine layer: ${twins} pattern twins, ${cards} preview twins, ${pageTwins} page twins, ${templateTwins} template twins, llms.txt, index.md, skill discovery`,
);
