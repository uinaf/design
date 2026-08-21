import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { wantsMarkdown } from "../src/worker";

const root = resolve(import.meta.dirname, "..");
const accepts = (accept?: string): boolean =>
  wantsMarkdown(new Request("https://design.uinaf.dev/", accept ? { headers: { accept } } : {}));

describe("markdown negotiation", () => {
  it("serves markdown when an agent asks for it", () => {
    expect(accepts("text/markdown")).toBe(true);
    expect(accepts("text/markdown, */*")).toBe(true);
  });

  it("does not hijack browser requests", () => {
    // Chrome's default Accept. Serving markdown here would break the site.
    expect(
      accepts("text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,*/*;q=0.8"),
    ).toBe(false);
    expect(accepts("text/html")).toBe(false);
    expect(accepts(undefined)).toBe(false);
    expect(accepts("*/*")).toBe(false);
  });

  it("treats an equally-weighted pair as the server's choice, and picks html", () => {
    // Order in Accept is not preference — q is. Equal q and equal specificity
    // means either is acceptable, so serve the one that keeps browsers working.
    expect(accepts("text/html,text/markdown")).toBe(false);
    expect(accepts("text/markdown,text/html")).toBe(false);
  });
});

describe("asset routing config", () => {
  const wrangler = readFileSync(resolve(root, "wrangler.toml"), "utf8");

  it("serves assets at their exact path so .html is not a redirect", () => {
    // The published components.json points at /patterns/x.html.
    expect(wrangler).toContain('html_handling = "none"');
  });

  it("runs the Worker before HTML assets so negotiation can apply", () => {
    // An exact asset match bypasses Worker code entirely, which silently
    // disables Accept: text/markdown on every page that exists as a file.
    expect(wrangler).toMatch(/run_worker_first = \[[^\]]*"\/\*\.html"/);
    expect(wrangler).toMatch(/run_worker_first = \[[^\]]*"\/patterns\/\*\.html"/);
  });
});

describe("Accept quality weights", () => {
  it("refuses markdown the client explicitly rejected", () => {
    expect(accepts("text/markdown;q=0")).toBe(false);
    expect(accepts("text/markdown;q=0, text/html")).toBe(false);
  });

  it("honours q ranking over textual order", () => {
    // Listed first but weighted lower — order alone would get this wrong.
    expect(accepts("text/html;q=0.1, text/markdown;q=1")).toBe(true);
    expect(accepts("text/markdown;q=0.2, text/html;q=0.9")).toBe(false);
  });

  it("prefers a specific range over a wildcard", () => {
    expect(accepts("text/markdown, */*;q=0.1")).toBe(true);
    expect(accepts("text/html, */*")).toBe(false);
  });
});

describe("malformed and cased Accept parameters", () => {
  it("treats the q parameter name case-insensitively", () => {
    expect(accepts("text/markdown;Q=0, text/html;q=0.5")).toBe(false);
    expect(accepts("text/html;Q=0.1, text/markdown;Q=1")).toBe(true);
  });

  it("does not promote an unparseable weight to full preference", () => {
    expect(accepts("text/markdown;q=invalid, text/html;q=0.5")).toBe(false);
    // parseFloat would read these as 1 and 0.5 and hand markdown the win.
    expect(accepts("text/markdown;q=1abc, text/html;q=0.5")).toBe(false);
    expect(accepts("text/markdown;q=0.5xyz, text/html;q=0.1")).toBe(false);
    expect(accepts("text/markdown;q=2, text/html;q=0.5")).toBe(false);
  });

  it("still accepts well-formed weights", () => {
    expect(accepts("text/markdown;q=1.0, text/html;q=0.5")).toBe(true);
    expect(accepts("text/markdown;q=0.9, text/html;q=0.001")).toBe(true);
  });
});

describe("duplicated ranges", () => {
  it("does not let header order decide between duplicates", () => {
    // Both orderings must agree; Array.find would disagree with itself here.
    expect(accepts("text/markdown;q=0, text/markdown;q=1, text/html;q=0.5")).toBe(true);
    expect(accepts("text/markdown;q=1, text/markdown;q=0, text/html;q=0.5")).toBe(true);
  });
});
