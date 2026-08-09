import { describe, expect, it } from "vite-plus/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { rankSections } from "../src/mcp";

const root = resolve(import.meta.dirname, "..");
const spec = readFileSync(resolve(root, "DESIGN.md"), "utf8");

describe("search_guidelines ranking", () => {
  it("puts the section named after the query first", () => {
    expect(rankSections(spec, "color").hits[0].heading).toBe("color");
    expect(rankSections(spec, "voice").hits[0].heading).toBe("voice");
    expect(rankSections(spec, "motion").hits[0].heading).toBe("motion");
  });

  it("finds sections by body content, not just headings", () => {
    const hits = rankSections(spec, "accent").hits;
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.body.toLowerCase().includes("accent"))).toBe(true);
  });

  it("returns nothing for a query the spec does not cover", () => {
    const { hits, sections } = rankSections(spec, "kubernetes");
    expect(hits).toEqual([]);
    // The caller lists these back to the model so it can retry usefully.
    expect(sections).toContain("color");
  });

  it("caps results so a broad query cannot flood the context", () => {
    expect(rankSections(spec, "the a is").hits.length).toBeLessThanOrEqual(3);
  });
});

describe("reference pages", () => {
  const pages = JSON.parse(readFileSync(resolve(root, "guide/pages.json"), "utf8")) as Array<{
    slug: string;
    name: string;
    description: string;
  }>;
  const published = (slug: string) =>
    readFileSync(resolve(root, "guide/pages", `${slug}.html`), "utf8");

  it("publishes exactly the six pages get_page and the skill name", () => {
    expect(pages.map((p) => p.slug).sort()).toEqual([
      "dashboard",
      "device-auth",
      "docs",
      "login",
      "product-landing",
      "settings",
    ]);
  });

  it("strips the authoring marker from published output", () => {
    // The marker is build metadata. Publishing it leaks it into get_page's
    // markup, which an agent would then copy into a product repo.
    for (const page of pages) {
      expect(published(page.slug)).not.toMatch(/@page|@dsCard/);
    }
  });

  it("points every page at the served stylesheet, not the source tree", () => {
    for (const page of pages) {
      const html = published(page.slug);
      expect(html).toContain('href="/tokens.css"');
      expect(html).not.toContain("../dist/");
    }
  });

  it("resolves no template placeholders into published markup", () => {
    // The upstream dashboard template ships an unbound `sc-for` loop; shipping
    // it would hand an agent `{{ row.PR }}` as if it were markup.
    for (const page of pages) {
      expect(published(page.slug)).not.toMatch(/\{\{|<sc-|<x-dc/);
    }
  });

  it("describes each page, since get_page lists descriptions on an unknown name", () => {
    for (const page of pages) {
      expect(page.description.trim().length).toBeGreaterThan(20);
    }
  });
});

describe("mcp runtime config", () => {
  const wrangler = readFileSync(resolve(root, "wrangler.toml"), "utf8");

  it("enables nodejs_compat for the Agents SDK", () => {
    // The MCP handler imports node:async_hooks; without this the Worker throws
    // "No such module" at startup and every route 500s, not just /mcp.
    expect(wrangler).toMatch(/compatibility_flags = \[\s*"nodejs_compat"/);
  });

  it("routes /mcp to the Worker before static assets", () => {
    expect(wrangler).toMatch(/run_worker_first = \[\s*"\/mcp"/);
  });
});

describe("search_guidelines input bounds", () => {
  it("ignores one-character terms that match almost everything", () => {
    // "a"/"e" occur thousands of times; scoring on them is noise, and counting
    // them by splitting the document is a cheap way to spike a public endpoint.
    expect(rankSections(spec, "a e i o u").hits).toEqual([]);
  });

  it("caps how many terms one query can carry", () => {
    const many = Array.from({ length: 200 }, (_, i) => `term${i}`).join(" ");
    expect(() => rankSections(spec, many)).not.toThrow();
    expect(rankSections(spec, many).hits.length).toBeLessThanOrEqual(3);
  });

  it("still ranks a normal multi-word query", () => {
    expect(rankSections(spec, "type scale").hits.length).toBeGreaterThan(0);
  });
});

describe("search_guidelines query length", () => {
  it("truncates before tokenizing rather than after", () => {
    // A cap applied after split() has already allocated the whole array.
    const huge = "color ".repeat(500_000);
    const start = Date.now();
    const { hits } = rankSections(spec, huge);
    expect(Date.now() - start).toBeLessThan(1000);
    expect(hits.length).toBeGreaterThan(0);
  });
});
