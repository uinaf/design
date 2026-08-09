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
