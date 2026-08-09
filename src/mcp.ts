import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * The five read tools over build output. Kept deliberately small — large tool
 * counts burn an agent's context before it has done any work.
 *
 * Every response is assembled from artifacts the build produced, so the tools
 * cannot describe a system that differs from what the site serves. Errors are
 * written to instruct: an unknown name returns the valid ones, because a
 * registry that guides the model beats one that merely refuses it.
 */

type Pattern = {
  name: string;
  slug: string;
  classes: string[];
  use: string;
  markup?: string;
  rules?: string[];
  never?: string[];
};

type Components = { patterns: Pattern[] };
type Tokens = { groups: Record<string, Record<string, string>> };
type Page = { slug: string; name: string; description: string };

const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });

/** A missing artifact is a deploy fault; say which path, not an opaque 500. */
const asset = async (env: Env, path: string): Promise<Response> => {
  const response = await env.ASSETS.fetch(new Request(`https://design.uinaf.dev${path}`));
  if (!response.ok) {
    throw new Error(`design.uinaf.dev${path} is unavailable (HTTP ${response.status}).`);
  }
  return response;
};

const json = async <T>(env: Env, path: string): Promise<T> =>
  (await asset(env, path)).json() as Promise<T>;

/**
 * Section-level keyword scoring. A heading match counts double: a section
 * titled "color" answers "color" better than one that merely mentions it.
 */
/** Occurrences without allocating: split() on a one-character term over a long
 *  document builds an enormous array, which is a cheap way to spike a public
 *  endpoint. */
const countOccurrences = (haystack: string, needle: string): number => {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
};

const MIN_TERM_LENGTH = 2;
const MAX_TERMS = 8;
// Truncate before tokenizing: splitting a multi-megabyte query allocates the
// whole array before any cap can apply.
const MAX_QUERY_LENGTH = 200;

export const rankSections = (
  spec: string,
  query: string,
): { hits: Array<{ heading: string; body: string; score: number }>; sections: string[] } => {
  const terms = query
    .slice(0, MAX_QUERY_LENGTH)
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= MIN_TERM_LENGTH)
    .slice(0, MAX_TERMS);
  const sections = spec.split(/\n(?=## )/).map((body) => {
    const heading = body.split("\n")[0].replace(/^#+\s*/, "");
    const haystack = body.toLowerCase();
    const lowerHeading = heading.toLowerCase();
    const score = terms.reduce(
      (sum, term) => sum + (lowerHeading.includes(term) ? 2 : 0) + countOccurrences(haystack, term),
      0,
    );
    return { heading, body, score };
  });
  return {
    hits: sections
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3),
    sections: sections.map((s) => s.heading),
  };
};

const describe = (p: Pattern): string =>
  [
    `# ${p.name}`,
    "",
    p.use,
    "",
    `**Classes** — ${p.classes.join(", ")}`,
    p.rules?.length ? `\n**Rules**\n${p.rules.map((r) => `- ${r}`).join("\n")}` : "",
    p.never?.length ? `\n**Never**\n${p.never.map((r) => `- ${r}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

export const createServer = (env: Env): McpServer => {
  const server = new McpServer({ name: "uinaf-design", version: "1.0.0" });

  server.registerTool(
    "list_patterns",
    {
      description:
        "List every uinaf UI pattern with a one-line use and its classes. Call this first to find the right pattern, then call get_pattern for the markup. Names only — cheap to call.",
      inputSchema: {},
    },
    async () => {
      const { patterns } = await json<Components>(env, "/components.json");
      return text(
        patterns
          .map(
            (p) =>
              `${p.name}${p.markup ? "" : " (no markup yet)"} — ${p.use} [${p.classes.join(", ")}]`,
          )
          .join("\n"),
      );
    },
  );

  server.registerTool(
    "get_pattern",
    {
      description:
        "Get one pattern's full contract and its copy-installable markup. Call this BEFORE writing any uinaf component — copy the markup and adapt the content, do not reinterpret the design.",
      inputSchema: { name: z.string().describe("Pattern name from list_patterns, e.g. 'topbar'") },
    },
    async ({ name }) => {
      const { patterns } = await json<Components>(env, "/components.json");
      const wanted = name.trim().toLowerCase();
      const pattern =
        patterns.find((p) => p.name.toLowerCase() === wanted) ??
        patterns.find((p) => p.slug.toLowerCase() === wanted);
      if (!pattern) {
        return text(
          `No pattern named "${name}". Valid names:\n${patterns.map((p) => p.name).join(", ")}`,
        );
      }
      if (!pattern.markup) {
        return text(
          `${describe(pattern)}\n\nNo markup is published for this pattern yet. Build it from the classes and rules above, and match the nearest pattern that does have markup.`,
        );
      }
      return text(
        `${describe(pattern)}\n\n\`\`\`html\n${pattern.markup}\n\`\`\`\n\nImport \`@uinaf/design/css\`, then copy the markup above.`,
      );
    },
  );

  server.registerTool(
    "get_tokens",
    {
      description:
        "Get uinaf design tokens, optionally one group. Use these values instead of writing raw hex, sizes, or spacing. Groups: typography, neutrals, semantic, accent, links, slime, viz, status, spacing, radius, borders, shadows, motion, layout.",
      inputSchema: {
        group: z.string().optional().describe("Optional group name; omit for every token"),
      },
    },
    async ({ group }) => {
      const { groups } = await json<Tokens>(env, "/tokens.json");
      if (!group) {
        return text(
          Object.entries(groups)
            .map(
              ([name, tokens]) =>
                `## ${name}\n${Object.entries(tokens)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join("\n")}`,
            )
            .join("\n\n"),
        );
      }
      const wanted = group.trim().toLowerCase();
      const found = Object.entries(groups).find(([name]) => name.toLowerCase() === wanted);
      if (!found) {
        return text(
          `No token group named "${group}". Valid groups: ${Object.keys(groups).join(", ")}`,
        );
      }
      return text(
        `## ${found[0]}\n${Object.entries(found[1])
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")}`,
      );
    },
  );

  server.registerTool(
    "get_page",
    {
      description:
        "Get a whole reference page — a complete, on-brand screen with its full markup. Call this BEFORE building a page, in preference to assembling one from patterns. Pages: product-landing, dashboard, login, settings, docs, device-auth.",
      inputSchema: {
        name: z.string().optional().describe("Page name, e.g. 'dashboard'; omit to list them"),
      },
    },
    async ({ name }) => {
      const pages = await json<Page[]>(env, "/pages.json");
      const list = pages.map((p) => `${p.slug} — ${p.description}`).join("\n");
      if (name === undefined || name.trim() === "") {
        return text(`Reference pages:\n${list}`);
      }
      const wanted = name.trim().toLowerCase();
      const page =
        pages.find((p) => p.slug.toLowerCase() === wanted) ??
        pages.find((p) => p.name.toLowerCase() === wanted);
      if (!page) {
        return text(
          `No reference page named "${name}". Valid pages:\n${list}\n\nFor a single component use get_pattern instead.`,
        );
      }
      const html = await (await asset(env, `/pages/${page.slug}.html`)).text();
      return text(
        `# ${page.name}\n\n${page.description}\n\nRendered: https://design.uinaf.dev/pages/${page.slug}.html\n\n\`\`\`html\n${html.trim()}\n\`\`\`\n\nImport \`@uinaf/design/css\`, copy the markup, and replace the content. Keep the structure — the layout is the design.`,
      );
    },
  );

  server.registerTool(
    "search_guidelines",
    {
      description:
        "Search the uinaf design spec for rules on voice, type, color, structure, layout, motion, or guardrails. Use when a choice is not covered by a pattern.",
      inputSchema: { query: z.string().describe("Keywords, e.g. 'accent' or 'type scale'") },
    },
    async ({ query }) => {
      const spec = await (await asset(env, "/design.md")).text();
      if (query.trim() === "") return text("Empty query. Try 'accent', 'type scale', or 'topbar'.");
      const { hits, sections } = rankSections(spec, query);
      if (hits.length === 0) {
        return text(`Nothing in the spec matched "${query}". Sections: ${sections.join(", ")}`);
      }
      return text(hits.map((s) => s.body.trim()).join("\n\n---\n\n"));
    },
  );

  return server;
};
