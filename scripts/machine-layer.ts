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
  write(
    `patterns/${p.slug}.md`,
    `# ${p.name}

${p.use}

**Classes** — ${p.classes.join(", ")}
${bullets("Rules", p.rules)}${bullets("Never", p.never)}${markup}
Import \`@uinaf/design/css\`, then copy the markup. Full contract: /components.json
`,
  );
}

// Preview cards are negotiated too, so each needs a twin. The useful markdown
// form of a visual demo is what it demonstrates, not a prose retelling of it.
for (const card of previews) {
  const html = fs.readFileSync(path.join(guide, "preview", `${card.slug}.html`), "utf8");
  const classes = [
    ...new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("u-")),
    ),
  ].sort();
  const related = components.patterns.filter((p) =>
    p.classes.some((c) => classes.includes(c.replace(/^\./, ""))),
  );
  write(
    `preview/${card.slug}.md`,
    `# ${card.name}

${card.group}${card.subtitle ? ` — ${card.subtitle}` : ""}

Rendered card: /preview/${card.slug}.html

**Classes demonstrated** — ${classes.length ? classes.map((c) => `.${c}`).join(", ") : "none"}
${related.length ? `\n**Related patterns**\n${related.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}\n` : ""}`,
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
  const classes = [
    ...new Set(
      [...html.matchAll(/class="([^"]*)"/g)]
        .flatMap((m) => m[1].split(/\s+/))
        .filter((c) => c.startsWith("u-")),
    ),
  ].sort();
  const related = components.patterns.filter((p) =>
    p.classes.some((c) => classes.includes(c.replace(/^\./, ""))),
  );
  write(
    `pages/${page.slug}.md`,
    `# ${page.name}

${page.description}

Rendered page: /pages/${page.slug}.html

**Classes used** — ${classes.length ? classes.map((c) => `.${c}`).join(", ") : "none"}
${related.length ? `\n**Patterns on this page**\n${related.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}\n` : ""}
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

## Patterns (${components.patterns.length})

${components.patterns.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}

## Preview cards

${previews.map((c) => `- [${c.name}](/preview/${c.slug}.html) — ${c.group}${c.subtitle ? `, ${c.subtitle}` : ""}`).join("\n")}

## CSS

\`\`\`css
@import "@uinaf/design/css";
\`\`\`

Berkeley Mono is licensed and loads from cdn.uinaf.dev — never bundle it.
`,
);

write(
  "llms.txt",
  `# uinaf design system

> Tokens, CSS primitives, and a ${components.patterns.length}-pattern contract for building uinaf-branded interfaces. Fetch a pattern before writing any component.

## Contract

- [components.json](https://design.uinaf.dev/components.json): every pattern with classes, use, rules, and nevers. Every pattern carries copyable markup.
- [tokens.json](https://design.uinaf.dev/tokens.json): design tokens grouped by role.

## Reference pages

Whole screens, markup included. Prefer these over assembling a page from patterns.

${pages.map((p) => `- [${p.name}](https://design.uinaf.dev/pages/${p.slug}.md): ${p.description}`).join("\n")}

## Patterns

${components.patterns.map((p) => `- [${p.name}](https://design.uinaf.dev/patterns/${p.slug}.md): ${p.use}`).join("\n")}

## Spec

- [design.md](https://design.uinaf.dev/design.md): voice, type, color, structure, components, layout, motion, guardrails.
- [readme.md](https://design.uinaf.dev/readme.md): package install and usage.
- [index.md](https://design.uinaf.dev/index.md): this site as markdown.

## Optional

- [SKILL.md](https://design.uinaf.dev/.well-known/skills/uinaf-design/SKILL.md): the agent skill.
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
          description:
            "Build uinaf-branded UI. Fetch patterns from design.uinaf.dev instead of inventing them.",
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
console.log(
  `machine layer: ${twins} pattern twins, ${cards} preview twins, ${pageTwins} page twins, llms.txt, index.md, skill discovery`,
);
