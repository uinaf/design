import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const fail = (m) => {
  console.error(m);
  process.exit(1);
};

const css = fs.readFileSync(path.join(root, "dist/css/tokens.css"), "utf8");
if (css.includes("./fonts/") || css.includes("berkeley-mono-variable-regular.woff2")) {
  fail("tokens.css must not embed local font file URLs");
}
if (!css.includes("cdn.uinaf.dev/fonts/berkeley-mono")) {
  fail("tokens.css must reference CDN Berkeley Mono");
}

for (const bad of ["fonts", ".handoff-src"]) {
  if (fs.existsSync(path.join(root, bad)) && bad === "fonts")
    fail("fonts/ must not exist in package root");
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if ((pkg.files || []).some((f) => f === "fonts" || f.includes("font"))) {
  fail("package.json files must not include fonts");
}

console.log("check ok");
