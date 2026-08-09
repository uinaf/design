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
  markup?: string;
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

// One markdown twin per pattern. This is the token-cheap form of a chunk: an
// agent gets the contract and the markup without parsing a full HTML document.
for (const p of components.patterns) {
  const markup = p.markup
    ? `\n\`\`\`html\n${p.markup}\n\`\`\`\n`
    : "\nNo markup published for this pattern yet — use the classes and rules above.\n";
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

// Reference docs served as-is; they are already markdown.
for (const [source, name] of [
  ["DESIGN.md", "design"],
  ["README.md", "readme"],
] as const) {
  write(`${name}.md`, fs.readFileSync(path.join(root, source), "utf8"));
}

const withMarkup = components.patterns.filter((p) => p.markup);
const withoutMarkup = components.patterns.filter((p) => !p.markup);

write(
  "index.md",
  `# uinaf design system

Tokens, CSS primitives, and the pattern contract for uinaf interfaces.
Machine-readable by design: fetch a pattern instead of writing UI from memory.

## Start here

- /components.json — the pattern contract, ${components.patterns.length} patterns
- /tokens.json — design tokens, grouped
- /design.md — the spec: voice, type, color, structure, layout, guardrails

## Patterns with copyable markup (${withMarkup.length})

${withMarkup.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}

## Contract-only patterns (${withoutMarkup.length})

Classes and rules, no markup published yet.

${withoutMarkup.map((p) => `- [${p.name}](/patterns/${p.slug}.md) — ${p.use}`).join("\n")}

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

- [components.json](https://design.uinaf.dev/components.json): every pattern with classes, use, rules, and nevers. ${withMarkup.length} carry copyable markup.
- [tokens.json](https://design.uinaf.dev/tokens.json): design tokens grouped by role.

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

const skill = fs.readFileSync(path.join(root, ".agents/skills/uinaf-design/SKILL.md"), "utf8");
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

const twins = fs.readdirSync(path.join(guide, "patterns")).filter((f) => f.endsWith(".md")).length;
console.log(`machine layer: ${twins} pattern twins, llms.txt, index.md, skill discovery`);
