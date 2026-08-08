import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const css = fs.readFileSync(path.join(root, "dist/css/tokens.css"), "utf8");
if (css.includes("./fonts/") || css.includes("berkeley-mono-variable-regular.woff2")) {
  fail("tokens.css must not embed local font file URLs");
}
if (!css.includes("cdn.uinaf.dev/fonts/berkeley-mono")) {
  fail("tokens.css must reference CDN Berkeley Mono");
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

console.log("check ok");
