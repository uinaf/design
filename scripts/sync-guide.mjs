import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const guide = path.join(root, "guide");
fs.mkdirSync(guide, { recursive: true });
fs.copyFileSync(path.join(root, "dist/css/tokens.css"), path.join(guide, "tokens.css"));
execSync("rm -rf preview && cp -R ../preview .", { cwd: guide, stdio: "inherit" });
execSync(
  `find preview -name '*.html' -print0 | xargs -0 sed -i '' -E 's|href="[^"]*tokens\\.css[^"]*"|href="/tokens.css"|g'`,
  { cwd: guide, shell: "/bin/bash", stdio: "inherit" },
);
console.log("guide synced");
