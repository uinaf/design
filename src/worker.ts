/**
 * design.uinaf.dev — static assets plus content negotiation.
 *
 * Every artifact is a build output; this Worker only routes. `html_handling` is
 * off so assets serve at their exact path, which keeps `/patterns/x.html` a 200
 * rather than a redirect to `/patterns/x` — the skill and the published
 * components.json both point at the `.html` form. Extensionless paths are
 * resolved here so both spellings work.
 */

export const wantsMarkdown = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("text/markdown")) return false;
  // A browser sends `text/html,...` with no mention of markdown; an agent asking
  // for markdown means it. Only prefer markdown when html is not ranked above it.
  const html = accept.indexOf("text/html");
  const markdown = accept.indexOf("text/markdown");
  return html === -1 || markdown < html;
};

const fetchAsset = async (env: Env, url: URL, pathname: string): Promise<Response> => {
  const target = new URL(url);
  target.pathname = pathname;
  return env.ASSETS.fetch(new Request(target, { method: "GET" }));
};

const ok = (response: Response): boolean => response.status < 400;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Directory-style request → index.
    if (pathname === "/" || pathname.endsWith("/")) {
      const index = `${pathname}index.html`;
      if (wantsMarkdown(request)) {
        const twin = await fetchAsset(env, url, `${pathname}index.md`);
        if (ok(twin)) return twin;
      }
      const response = await fetchAsset(env, url, index);
      if (ok(response)) return response;
      return env.ASSETS.fetch(request);
    }

    const hasExtension = /\.[a-z0-9]+$/i.test(pathname);

    // `Accept: text/markdown` on an HTML page or an extensionless path serves the
    // twin — roughly a 90% token cut for an agent versus fetching the HTML.
    if (wantsMarkdown(request) && (!hasExtension || pathname.endsWith(".html"))) {
      const base = pathname.replace(/\.html$/, "");
      const twin = await fetchAsset(env, url, `${base}.md`);
      if (ok(twin)) return twin;
    }

    const direct = await fetchAsset(env, url, pathname);
    if (ok(direct)) return direct;

    // Extensionless → the .html asset, so /patterns/topbar and
    // /patterns/topbar.html both resolve without a redirect.
    if (!hasExtension) {
      const asHtml = await fetchAsset(env, url, `${pathname}.html`);
      if (ok(asHtml)) return asHtml;
    }

    return direct;
  },
} satisfies ExportedHandler<Env>;
