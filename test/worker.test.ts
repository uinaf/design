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

  it("respects the order html and markdown are listed in", () => {
    expect(accepts("text/html,text/markdown")).toBe(false);
    expect(accepts("text/markdown,text/html")).toBe(true);
  });
});

describe("asset routing config", () => {
  const wrangler = readFileSync(resolve(root, "wrangler.toml"), "utf8");

  it("serves assets at their exact path so .html is not a redirect", () => {
    // The published components.json and the skill both point at /patterns/x.html.
    expect(wrangler).toContain('html_handling = "none"');
  });

  it("runs the Worker before HTML assets so negotiation can apply", () => {
    // An exact asset match bypasses Worker code entirely, which silently
    // disables Accept: text/markdown on every page that exists as a file.
    expect(wrangler).toMatch(/run_worker_first = \[[^\]]*"\/\*\.html"/);
    expect(wrangler).toMatch(/run_worker_first = \[[^\]]*"\/patterns\/\*\.html"/);
  });
});
