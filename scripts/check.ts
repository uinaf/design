import fs from "node:fs";
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
const frontmatter = /^---\n([\s\S]*?)\n---/.exec(skill)?.[1];
if (!frontmatter) {
  fail("skills/uinaf-design/SKILL.md has no frontmatter");
}
for (const field of ["name", "description"]) {
  if (!new RegExp(`^${field}:\\s*\\S`, "m").test(frontmatter as string)) {
    fail(`skills/uinaf-design/SKILL.md frontmatter is missing \`${field}\``);
  }
}

const plugin = JSON.parse(
  fs.readFileSync(path.join(skillDir, ".tessl-plugin/plugin.json"), "utf8"),
) as { name?: string; skills?: string[] };
if (!plugin.name || !plugin.skills?.length) {
  fail("skills/uinaf-design/.tessl-plugin/plugin.json needs a name and a skills list");
}
for (const entry of plugin.skills ?? []) {
  if (!fs.existsSync(path.join(skillDir, entry))) {
    fail(`.tessl-plugin/plugin.json lists ${entry}, which does not exist`);
  }
}
if (!fs.existsSync(path.join(skillDir, "agents/openai.yaml"))) {
  fail("skills/uinaf-design/agents/openai.yaml is missing");
}

const packaged = (pkg.files ?? []).some((f) => f === "skills/uinaf-design");
if (!packaged) {
  fail("package.json files must include skills/uinaf-design so the skill ships");
}

console.log("check ok");
