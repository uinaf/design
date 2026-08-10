/**
 * Exercises the deployed MCP contract end to end: handshake, tool discovery,
 * every tool, and every instructive-error path. Config assertions and unit
 * tests cannot catch a handler/API incompatibility or a renamed artifact —
 * only a real initialize/tools-call round trip against the asset binding can.
 *
 *   node scripts/smoke-mcp.ts [baseUrl]     # default http://localhost:8788
 */

export {}; // top-level await requires this file to be a module

const base = (process.argv[2] ?? "http://localhost:8788").replace(/\/$/, "");
const endpoint = `${base}/mcp`;

type ToolResult = { content?: Array<{ text?: string }> };

let failures = 0;

const PROPOSED_VERSION = "2026-07-28";
// Set from the initialize response: after the handshake every request must
// carry the version the server actually negotiated, not the one we proposed.
let negotiatedVersion: string | undefined;

// Every request needs its own bound. smoke.sh times out the boot and then waits
// on this process, and main.yml runs it against production with only the job
// timeout behind it — so a fetch that never settles hangs both, and no
// SMOKE_TIMEOUT covers it.
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15_000);

const post = (body: unknown): Promise<Response> =>
  fetch(endpoint, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      // Omitted on initialize — there is no negotiated version yet, and sending
      // a proposed one there is rejected outright.
      ...(negotiatedVersion ? { "mcp-protocol-version": negotiatedVersion } : {}),
    },
    body: JSON.stringify(body),
  });

/** Notifications carry no id and expect no response. */
const notify = async (method: string): Promise<void> => {
  const response = await post({ jsonrpc: "2.0", method });
  if (!response.ok && response.status !== 202) {
    throw new Error(`${method}: HTTP ${response.status}`);
  }
};

const rpc = async (method: string, params?: unknown): Promise<Record<string, unknown>> => {
  const response = await post({ jsonrpc: "2.0", id: 1, method, params });
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`);
  const body = await response.text();
  // Streamable HTTP may answer as an SSE frame or as plain JSON.
  const payload = body.startsWith("event:")
    ? (body.split("\n").find((l) => l.startsWith("data: ")) ?? "").slice(6)
    : body;
  const parsed = JSON.parse(payload) as { result?: Record<string, unknown>; error?: unknown };
  if (parsed.error) throw new Error(`${method}: ${JSON.stringify(parsed.error)}`);
  return parsed.result ?? {};
};

const call = async (name: string, args: Record<string, unknown> = {}): Promise<string> => {
  const result = (await rpc("tools/call", { name, arguments: args })) as ToolResult;
  return result.content?.[0]?.text ?? "";
};

const check = (label: string, condition: boolean, detail = ""): void => {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
};

console.log(`mcp smoke → ${endpoint}`);

const init = (await rpc("initialize", {
  protocolVersion: PROPOSED_VERSION,
  capabilities: {},
  clientInfo: { name: "smoke", version: "1" },
})) as { serverInfo?: { name?: string }; protocolVersion?: string };
check("initialize handshake", init.serverInfo?.name === "uinaf-design", JSON.stringify(init));
check(
  "initialize negotiates a protocol version",
  Boolean(init.protocolVersion),
  JSON.stringify(init),
);
negotiatedVersion = init.protocolVersion;

// A lifecycle-enforcing server rejects everything until this arrives.
await notify("notifications/initialized");

const { tools = [] } = (await rpc("tools/list")) as {
  tools?: Array<{ name: string; description?: string }>;
};
const names = tools.map((t) => t.name).sort();
check(
  "tools/list returns the five read tools",
  JSON.stringify(names) ===
    JSON.stringify(["get_page", "get_pattern", "get_tokens", "list_patterns", "search_guidelines"]),
  names.join(", "),
);
check(
  "descriptions carry usage guidance",
  tools.every((t) => (t.description ?? "").length > 40),
);

const list = await call("list_patterns");
check("list_patterns includes topbar", list.includes("topbar"));
// The listing is the only place an agent sees every pattern at once, so an
// entry that loses its use text or class list costs it the contract for that
// pattern. Shape-check every line; asserting on one name would pass a listing
// that degraded everywhere else.
const malformed = list
  .split("\n")
  .filter((line) => line.trim().length > 0 && !/^.+ — .+ \[.+\]$/.test(line));
check(
  "every list_patterns entry carries use and classes",
  malformed.length === 0,
  malformed.join("\n"),
);

const topbar = await call("get_pattern", { name: "topbar" });
check("get_pattern returns markup", topbar.includes("u-topbar-row") && topbar.includes("```html"));
check("get_pattern returns rules", topbar.toLowerCase().includes("56px"));

const modal = await call("get_pattern", { name: "modal" });
check(
  "get_pattern returns markup for a non-headline pattern too",
  modal.includes("u-modal") && modal.includes("```html"),
  modal.slice(0, 200),
);

const unknown = await call("get_pattern", { name: "nonsense" });
check(
  "get_pattern error lists valid names",
  unknown.includes("topbar") && unknown.includes("No pattern named"),
);

const accent = await call("get_tokens", { group: "accent" });
check("get_tokens returns a group", accent.includes("--accent:"));

const allTokens = await call("get_tokens");
check(
  "get_tokens with no group returns every group",
  allTokens.includes("## typography") && allTokens.includes("## layout"),
);

const badGroup = await call("get_tokens", { group: "bogus" });
check(
  "get_tokens error lists valid groups",
  badGroup.includes("typography") && badGroup.includes("No token group"),
);

// Every page, because a page that 404s from the asset binding is invisible to
// unit tests — the tool would still answer, just with a broken artifact.
for (const name of ["product-landing", "dashboard", "login", "settings", "docs", "device-auth"]) {
  const page = await call("get_page", { name });
  check(
    `get_page returns ${name} with markup`,
    page.includes("```html") && page.includes("class=") && !page.includes("@page"),
  );
}

const pageList = await call("get_page");
check(
  "get_page with no name lists the pages",
  pageList.includes("dashboard") && pageList.includes("login"),
);

const badPage = await call("get_page", { name: "nonsense" });
check(
  "get_page error lists valid pages",
  badPage.includes("No reference page named") && badPage.includes("dashboard"),
);

const color = await call("search_guidelines", { query: "accent" });
check("search_guidelines finds the color section", color.toLowerCase().includes("accent"));

const noHit = await call("search_guidelines", { query: "kubernetes" });
check("search_guidelines error lists sections", noHit.includes("Nothing in the spec matched"));

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nmcp smoke ok");
