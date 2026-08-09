import fs from "node:fs";
import { parse as parseYaml } from "yaml";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

for (const name of ["tokens.css", "components.css"]) {
  const sheet = fs.readFileSync(path.join(root, "dist/css", name), "utf8");
  if (sheet.includes("./fonts/") || sheet.includes("berkeley-mono-variable-regular.woff2")) {
    fail(`${name} must not embed local font file URLs`);
  }
}

const css = fs.readFileSync(path.join(root, "dist/css/tokens.css"), "utf8");
if (!css.includes('@import url("https://cdn.uinaf.dev/fonts/berkeley-mono')) {
  fail("tokens.css must @import CDN Berkeley Mono");
}
if (!css.includes('@import url("./components.css")')) {
  fail("tokens.css must @import ./components.css — consumers import one file");
}

const tokens = JSON.parse(fs.readFileSync(path.join(root, "dist/tokens.json"), "utf8")) as {
  groups: Record<string, Record<string, string>>;
};
const flat = JSON.parse(
  fs.readFileSync(path.join(root, "dist/tokens.flat.json"), "utf8"),
) as Record<string, string>;
const grouped = Object.values(tokens.groups).flatMap((g) => Object.entries(g));
if (grouped.length !== Object.keys(flat).length) {
  fail(
    `tokens.json has ${grouped.length} tokens, tokens.flat.json has ${Object.keys(flat).length}`,
  );
}
for (const [name, value] of grouped) {
  if (flat[name.slice(2)] !== value) {
    fail(`tokens.json ${name} does not match tokens.flat.json`);
  }
}

// The six reference pages are a published contract: the skill, the adoption
// doc, and get_page all name them, so a rename silently breaks all three.
const REFERENCE_PAGES = [
  "product-landing",
  "dashboard",
  "login",
  "settings",
  "docs",
  "device-auth",
];
for (const name of REFERENCE_PAGES) {
  const source = path.join(root, "pages", `${name}.html`);
  if (!fs.existsSync(source)) {
    fail(`pages/${name}.html is missing — get_page and the skill both name it`);
  }
  if (!/@page\s+name="[^"]+"\s+description="[^"]*"/.test(fs.readFileSync(source, "utf8"))) {
    fail(`pages/${name}.html needs an @page name="…" description="…" marker`);
  }
}

if (fs.existsSync(path.join(root, "fonts"))) {
  fail("fonts/ must not exist in package root");
}

type PackageJson = {
  files?: string[];
};

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as PackageJson;
if ((pkg.files ?? []).some((f) => f === "fonts" || f.includes("font"))) {
  fail("package.json files must not include fonts");
}

// The skill ships inside the npm tarball, so a malformed one is publishable.
// Structural, not a network call: this must hold in CI where tessl is absent.
// `pnpm run skill:lint` remains the richer, optional gate.
const skillDir = path.join(root, "skills/uinaf-design");
const skill = fs.readFileSync(path.join(skillDir, "SKILL.md"), "utf8");
const frontmatter = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---/.exec(skill)?.[1];
if (!frontmatter) {
  fail("skills/uinaf-design/SKILL.md has no frontmatter");
}
type SkillFrontmatter = {
  name?: unknown;
  description?: unknown;
  "disable-model-invocation"?: unknown;
};
const parseFrontmatter = (source: string): SkillFrontmatter => {
  try {
    return (parseYaml(source) ?? {}) as SkillFrontmatter;
  } catch (error) {
    return fail(`SKILL.md frontmatter is not valid YAML: ${(error as Error).message}`);
  }
};
const meta = parseFrontmatter(frontmatter as string);

if (meta.name !== "uinaf-design") {
  fail(`SKILL.md declares name \`${String(meta.name)}\`, expected \`uinaf-design\``);
}
if (typeof meta.description !== "string" || meta.description.trim().length < 40) {
  fail("SKILL.md needs a substantive `description` string");
}
// The invocation policy is a deliberate decision (#11), not incidental.
if (meta["disable-model-invocation"] !== true) {
  fail("SKILL.md frontmatter must set disable-model-invocation: true");
}

const plugin = JSON.parse(
  fs.readFileSync(path.join(skillDir, ".tessl-plugin/plugin.json"), "utf8"),
) as { name?: string; skills?: string[] };
if (plugin.name !== "uinaf/uinaf-design") {
  fail(`plugin.json declares name \`${plugin.name}\`, expected \`uinaf/uinaf-design\``);
}
if (!plugin.skills?.includes("SKILL.md")) {
  fail("plugin.json skills must list SKILL.md");
}
for (const entry of plugin.skills ?? []) {
  if (!fs.existsSync(path.join(skillDir, entry))) {
    fail(`.tessl-plugin/plugin.json lists ${entry}, which does not exist`);
  }
}
const openai = fs.existsSync(path.join(skillDir, "agents/openai.yaml"))
  ? fs.readFileSync(path.join(skillDir, "agents/openai.yaml"), "utf8")
  : fail("skills/uinaf-design/agents/openai.yaml is missing");
// Parsed, not pattern-matched. Regex checks cannot tell a real key from the
// same words inside a `default_prompt: |` block scalar, and cannot see that the
// document is malformed at all — this file ships to consumers and drives the
// Codex picker, so it has to actually be valid YAML.
type OpenAiConfig = {
  interface?: { display_name?: unknown; short_description?: unknown; default_prompt?: unknown };
  policy?: { allow_implicit_invocation?: unknown };
};
const parseOpenAi = (source: string): OpenAiConfig => {
  try {
    return (parseYaml(source) ?? {}) as OpenAiConfig;
  } catch (error) {
    return fail(`agents/openai.yaml is not valid YAML: ${(error as Error).message}`);
  }
};
const openaiConfig = parseOpenAi(openai);
for (const key of ["display_name", "short_description", "default_prompt"] as const) {
  const value = openaiConfig.interface?.[key];
  if (typeof value !== "string" || value.trim() === "") {
    fail(`agents/openai.yaml needs a non-empty string at interface.${key}`);
  }
}
// The invocation policy is a deliberate decision (#11), not incidental.
if (openaiConfig.policy?.allow_implicit_invocation !== false) {
  fail("agents/openai.yaml must set policy.allow_implicit_invocation: false");
}

const packaged = (pkg.files ?? []).some((f) => f === "skills/uinaf-design");
if (!packaged) {
  fail("package.json files must include skills/uinaf-design so the skill ships");
}

console.log("check ok");
