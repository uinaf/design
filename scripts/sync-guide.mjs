import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const guide = path.join(root, "guide");
const previewSrc = path.join(root, "preview");
const previewDest = path.join(guide, "preview");

fs.mkdirSync(guide, { recursive: true });
fs.copyFileSync(path.join(root, "dist/css/tokens.css"), path.join(guide, "tokens.css"));

fs.rmSync(previewDest, { recursive: true, force: true });
fs.cpSync(previewSrc, previewDest, { recursive: true });

const rewriteCssHref = (filePath) => {
  const before = fs.readFileSync(filePath, "utf8");
  const after = before.replace(/href="[^"]*tokens\.css[^"]*"/g, 'href="/tokens.css"');
  if (after !== before) fs.writeFileSync(filePath, after);
};

for (const name of fs.readdirSync(previewDest)) {
  if (!name.endsWith(".html")) continue;
  rewriteCssHref(path.join(previewDest, name));
}

console.log("guide synced");
