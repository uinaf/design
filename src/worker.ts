/**
 * design.uinaf.dev — static assets plus content negotiation.
 *
 * Every artifact is a build output; this Worker only routes. `html_handling` is
 * off so assets serve at their exact path, which keeps `/patterns/x.html` a 200
 * rather than a redirect to `/patterns/x` — the skill and the published
 * components.json both point at the `.html` form. Extensionless paths are
 * resolved here so both spellings work.
 */

type MediaRange = { type: string; subtype: string; q: number };

const parseAccept = (header: string): MediaRange[] =>
  header
    .split(",")
    .map((part) => {
      const [media = "", ...params] = part.trim().split(";");
      const [type = "", subtype = ""] = media.trim().toLowerCase().split("/");
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
      return { type, subtype, q: Number.isFinite(q) ? Math.min(Math.max(q, 0), 1) : 1 };
    })
    .filter((r) => r.type !== "");

/** The most specific range matching a media type, with how specific it was. */
const matchFor = (
  ranges: MediaRange[],
  type: string,
  subtype: string,
): { q: number; specificity: number } => {
  const exact = ranges.find((r) => r.type === type && r.subtype === subtype);
  if (exact) return { q: exact.q, specificity: 2 };
  const typeWildcard = ranges.find((r) => r.type === type && r.subtype === "*");
  if (typeWildcard) return { q: typeWildcard.q, specificity: 1 };
  const anything = ranges.find((r) => r.type === "*" && r.subtype === "*");
  return anything ? { q: anything.q, specificity: 0 } : { q: 0, specificity: -1 };
};

/**
 * Markdown only when the client prefers it over HTML: higher q, or equal q via a
 * more specific range. Order in the header is not preference — q is — so a fully
 * equal pair falls to HTML, keeping the site normal for anything browser-shaped.
 */
export const wantsMarkdown = (request: Request): boolean => {
  const header = request.headers.get("accept");
  if (!header) return false;
  const ranges = parseAccept(header);
  const markdown = matchFor(ranges, "text", "markdown");
  if (markdown.q === 0) return false;
  const html = matchFor(ranges, "text", "html");
  return markdown.q > html.q || (markdown.q === html.q && markdown.specificity > html.specificity);
};

/** Re-point a request at another path, preserving method and headers. */
const fetchAsset = (env: Env, request: Request, url: URL, pathname: string): Promise<Response> => {
  const target = new URL(url);
  target.pathname = pathname;
  return env.ASSETS.fetch(new Request(target, request));
};

const ok = (response: Response): boolean => response.status < 400;

/** These URLs have more than one representation, so caches must key on Accept. */
const varyOnAccept = (response: Response): Response => {
  const varied = new Response(response.body, response);
  const parts = (varied.headers.get("vary") ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.some((p) => p.toLowerCase() === "accept")) parts.push("Accept");
  varied.headers.set("vary", parts.join(", "));
  return varied;
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Anything that mutates has no business here; let the asset binding answer
    // with its own method handling rather than returning a page for a POST.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return env.ASSETS.fetch(request);
    }

    const isDirectory = pathname === "/" || pathname.endsWith("/");
    const hasExtension = /\.[a-z0-9]+$/i.test(pathname);
    const negotiable = isDirectory || !hasExtension || pathname.endsWith(".html");

    if (negotiable && wantsMarkdown(request)) {
      const base = isDirectory ? `${pathname}index` : pathname.replace(/\.html$/, "");
      const twin = await fetchAsset(env, request, url, `${base}.md`);
      if (ok(twin)) return varyOnAccept(twin);
    }

    if (isDirectory) {
      const index = await fetchAsset(env, request, url, `${pathname}index.html`);
      return ok(index) ? varyOnAccept(index) : env.ASSETS.fetch(request);
    }

    const direct = await fetchAsset(env, request, url, pathname);
    if (ok(direct)) return negotiable ? varyOnAccept(direct) : direct;

    // Extensionless → the .html asset, so /patterns/topbar and
    // /patterns/topbar.html both resolve without a redirect.
    if (!hasExtension) {
      const asHtml = await fetchAsset(env, request, url, `${pathname}.html`);
      if (ok(asHtml)) return varyOnAccept(asHtml);
    }

    return direct;
  },
} satisfies ExportedHandler<Env>;
