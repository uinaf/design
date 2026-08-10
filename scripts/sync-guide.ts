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
// The sanctioned icon set. Agents are told to pick from the committed set rather
// than a gallery, so the set has to be fetchable, not only present in the tarball.
fs.cpSync(path.join(root, "assets/icons"), path.join(guide, "assets/icons"), { recursive: true });

const patternsDest = path.join(guide, "patterns");
fs.rmSync(patternsDest, { recursive: true, force: true });
fs.cpSync(path.join(root, "dist/patterns"), patternsDest, { recursive: true });

fs.rmSync(previewDest, { recursive: true, force: true });
fs.cpSync(previewSrc, previewDest, { recursive: true });

// Fails closed, like the @page marker below. A default of "Other / preview"
// publishes a broken card under a label that reads like a deliberate choice,
// so the defect survives review.
const parseCard = (html: string, file: string): CardMeta => {
  const m = html.match(/@dsCard\s+group="([^"]+)"\s+name="([^"]+)"(?:\s+subtitle="([^"]*)")?/);
  if (!m) throw new Error(`preview/${file} has no @dsCard group="…" name="…" marker`);
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
  const meta = parseCard(html, path.basename(filePath));

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

/**
 * Reference pages are whole screens, not cards, so they get no guide chrome —
 * a second bar above a page that already owns a topbar would break the one-row
 * rule the pages exist to demonstrate. The marker comment is authoring
 * metadata and is stripped rather than published.
 */
const pagesSrc = path.join(root, "pages");
const pagesDest = path.join(guide, "pages");
fs.rmSync(pagesDest, { recursive: true, force: true });
fs.cpSync(pagesSrc, pagesDest, { recursive: true });

const pages: Array<{ slug: string; name: string; description: string }> = [];
for (const file of fs.readdirSync(pagesDest).sort()) {
  if (!file.endsWith(".html")) continue;
  const target = path.join(pagesDest, file);
  const html = fs.readFileSync(target, "utf8");
  const m = /@page\s+name="([^"]+)"\s+description="([^"]*)"/.exec(html);
  if (!m) throw new Error(`pages/${file} has no @page marker`);
  fs.writeFileSync(
    target,
    html
      .replace(/^\s*<!--\s*@page[\s\S]*?-->\s*$\n?/m, "")
      .replace(/href="[^"]*tokens\.css[^"]*"/g, 'href="/tokens.css"'),
  );
  pages.push({ slug: file.replace(/\.html$/, ""), name: m[1], description: m[2] });
}
fs.writeFileSync(path.join(guide, "pages.json"), `${JSON.stringify(pages, null, 2)}\n`);

console.log(`guide synced (${catalog.length} previews, ${pages.length} pages)`);
