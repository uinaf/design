import fs from "node:fs";
import path from "node:path";

type CardMeta = {
  group: string;
  name: string;
  subtitle: string;
};

type PreviewEntry = CardMeta & {
  slug: string;
};

const root = path.resolve(import.meta.dirname, "..");
const guide = path.join(root, "guide");
const previewSrc = path.join(root, "preview");
const previewDest = path.join(guide, "preview");

fs.mkdirSync(guide, { recursive: true });
// tokens.css @imports ./components.css — both must land side by side.
fs.copyFileSync(path.join(root, "dist/css/tokens.css"), path.join(guide, "tokens.css"));
fs.copyFileSync(path.join(root, "dist/css/components.css"), path.join(guide, "components.css"));
fs.copyFileSync(path.join(root, "dist/components.json"), path.join(guide, "components.json"));
fs.copyFileSync(path.join(root, "dist/tokens.json"), path.join(guide, "tokens.json"));

const patternsDest = path.join(guide, "patterns");
fs.rmSync(patternsDest, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist/patterns"), patternsDest, { recursive: true });

fs.rmSync(previewDest, { recursive: true, force: true });
fs.cpSync(previewSrc, previewDest, { recursive: true });

const parseCard = (html: string): CardMeta => {
  const m = html.match(/@dsCard\s+group="([^"]+)"\s+name="([^"]+)"(?:\s+subtitle="([^"]*)")?/);
  if (!m) return { group: "Other", name: "preview", subtitle: "" };
  return { group: m[1], name: m[2], subtitle: m[3] ?? "" };
};

const guideChrome = `<!-- guide-chrome -->
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="icon" href="https://cdn.uinaf.dev/images/uinaf-computer.png" type="image/png" />
<style id="guide-chrome">
  html { background: var(--bg, #0a0a0a); }
  body.uinaf {
    box-sizing: border-box;
    max-width: 48rem;
    margin-inline: auto;
    min-height: 100vh;
  }
  .guide-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px 16px;
    margin: 0 0 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--border, #222);
    font-size: 13px;
  }
  .guide-bar a {
    color: var(--fg-muted, #888);
    text-decoration: none;
  }
  .guide-bar a:hover { color: var(--accent, #b6ff3c); }
  .guide-bar .sep { color: var(--fg-faint, #555); }
  .guide-bar .title { color: var(--fg, #ddd); }
  .guide-bar .sub { color: var(--fg-subtle, #777); font-size: 11px; }
</style>
`;

const guideBar = (meta: CardMeta): string => {
  const sub = meta.subtitle ? `<span class="sub">${meta.subtitle}</span>` : "";
  return `<nav class="guide-bar" aria-label="guide">
  <a href="/">← design</a>
  <span class="sep">·</span>
  <span class="u-label">${meta.group}</span>
  <span class="sep">·</span>
  <span class="title">${meta.name}</span>
  ${sub}
</nav>
`;
};

const rewritePreviewHtml = (filePath: string): CardMeta => {
  let html = fs.readFileSync(filePath, "utf8");
  const meta = parseCard(html);

  html = html
    .replace(/href="[^"]*tokens\.css[^"]*"/g, 'href="/tokens.css"')
    .replace(
      /(?:\.\.\/)+assets\/(uinaf-[^"']+\.(?:png|webp|svg|jpg))/g,
      "https://cdn.uinaf.dev/images/$1",
    );

  if (!html.includes('id="guide-chrome"')) {
    html = html.replace(/<\/head>/i, `${guideChrome}</head>`);
  }
  if (!html.includes('class="guide-bar"')) {
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${guideBar(meta)}`);
  }

  fs.writeFileSync(filePath, html);
  return meta;
};

const catalog: PreviewEntry[] = [];
for (const name of fs.readdirSync(previewDest).sort()) {
  if (!name.endsWith(".html")) continue;
  const meta = rewritePreviewHtml(path.join(previewDest, name));
  catalog.push({
    slug: name.replace(/\.html$/, ""),
    ...meta,
  });
}

fs.writeFileSync(path.join(guide, "previews.json"), `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`guide synced (${catalog.length} previews)`);
