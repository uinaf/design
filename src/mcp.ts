import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

/**
 * The four read tools over build output. Kept deliberately small — large tool
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

const text = (body: string) => ({ content: [{ type: "text" as const, text: body }] });

const asset = async (env: Env, path: string): Promise<Response> =>
  env.ASSETS.fetch(new Request(`https://design.uinaf.dev${path}`));

const json = async <T>(env: Env, path: string): Promise<T> =>
  (await asset(env, path)).json() as Promise<T>;

/**
 * Section-level keyword scoring. A heading match counts double: a section
 * titled "color" answers "color" better than one that merely mentions it.
 */
export const rankSections = (
  spec: string,
  query: string,
): { hits: Array<{ heading: string; body: string; score: number }>; sections: string[] } => {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const sections = spec.split(/\n(?=## )/).map((body) => {
    const heading = body.split("\n")[0].replace(/^#+\s*/, "");
    const haystack = body.toLowerCase();
    const score = terms.reduce(
      (sum, term) =>
        sum + (heading.toLowerCase().includes(term) ? 2 : 0) + (haystack.split(term).length - 1),
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
