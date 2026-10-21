/**
 * Exercises the deployed read routes end to end: every machine-layer artifact
 * and every page and pattern in HTML and Markdown. Config assertions and unit
 * tests cannot catch a renamed artifact or a route that 404s while its artifact
 * is present. Only real round trips against the asset binding can.
 *
 *   node scripts/smoke-guide.ts [baseUrl]     # default http://localhost:8788
 */

export {}; // top-level await requires this file to be a module

const base = (process.argv[2] ?? "http://localhost:8788").replace(/\/$/, "");

let failures = 0;

// Every request needs its own bound. smoke.sh times out the boot and then waits
// on this process, and release.yml runs it against production with only the job
// timeout behind it. A fetch that never settles hangs both, and no
// SMOKE_TIMEOUT covers it.
const REQUEST_TIMEOUT_MS = Number(process.env.SMOKE_REQUEST_TIMEOUT_MS ?? 15_000);

const check = (label: string, condition: boolean, detail = ""): void => {
  if (condition) {
    console.log(`  ok   ${label}`);
    return;
  }
  failures += 1;
  console.error(`  FAIL ${label}${detail ? `\n       ${detail}` : ""}`);
};

// A redirect fails the check: followed, `/patterns/x.html` → `/patterns/x` would
// pass while the published `.html` links stop being the canonical answer.
const get = (path: string, accept?: string): Promise<Response> =>
  fetch(`${base}${path}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: accept ? { accept } : {},
    redirect: "manual",
  });

const json = async <T>(path: string): Promise<T> => {
  const response = await get(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return (await response.json()) as T;
};

type Slugged = { slug: string };

// Slugs come from the served indexes, never a list written here: a renamed page
// or template has to fail this smoke rather than leave a stale literal passing.
const pages = await json<Slugged[]>("/pages.json");
const templates = await json<Slugged[]>("/templates.json");

check("pages.json lists the six reference screens", pages.length === 6, `${pages.length} page(s)`);
check("templates.json lists templates", templates.length > 0, `${templates.length} template(s)`);

console.log(`guide smoke → ${base}`);

const served = async (path: string, type: string, accept?: string): Promise<void> => {
  const response = await get(path, accept);
  const got = response.headers.get("content-type") ?? "";
  check(
    `GET ${path}${accept ? ` as ${accept}` : ""} → ${type}`,
    response.ok && got.includes(type),
    `HTTP ${response.status}, content-type ${got || "none"}`,
  );
};

for (const [path, type] of [
  ["/components.json", "application/json"],
  ["/tokens.json", "application/json"],
  ["/pages.json", "application/json"],
  ["/templates.json", "application/json"],
  ["/llms.txt", "text/plain"],
] as const) {
  await served(path, type);
}

for (const { slug } of pages) {
  await served(`/pages/${slug}.html`, "text/html");
  await served(`/pages/${slug}.md`, "text/markdown");
  await served(`/pages/${slug}.html`, "text/markdown", "text/markdown");
}

for (const { slug } of templates) {
  await served(`/templates/${slug}.html`, "text/html");
  await served(`/templates/${slug}.md`, "text/markdown");
}

const { patterns } = await json<{ patterns: Slugged[] }>("/components.json");
check("components.json lists patterns", patterns.length > 0, `${patterns.length} pattern(s)`);
for (const { slug } of patterns) {
  await served(`/patterns/${slug}.html`, "text/html");
  await served(`/patterns/${slug}.md`, "text/markdown");
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nguide smoke ok");
