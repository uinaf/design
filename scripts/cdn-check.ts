/**
 * Proves every url in the `CDN` export resolves. The assets live in uinaf/infra,
 * so this repo can go green while a declared url is still a 404 — run it before
 * a deploy that introduces one.
 *
 * Outside `verify` on purpose: it needs the network, and CI must not go red
 * because the CDN blinked.
 */
import { CDN } from "../src/cdn.ts";

const urls = (value: unknown): string[] =>
  typeof value === "string"
    ? [value]
    : Object.values(value as Record<string, unknown>).flatMap(urls);

const targets = urls(CDN).filter((url) => url !== CDN.origin);

const results = await Promise.all(
  targets.map(async (url) => {
    try {
      const response = await fetch(url, { method: "HEAD" });
      return { url, status: String(response.status), ok: response.ok };
    } catch (error) {
      return { url, status: error instanceof Error ? error.message : "failed", ok: false };
    }
  }),
);

for (const { url, status, ok } of results) {
  console.log(`${ok ? "ok " : "MISS"} ${status.padEnd(4)} ${url}`);
}

const missing = results.filter((result) => !result.ok);
if (missing.length > 0) {
  console.error(`\n${missing.length} of ${results.length} CDN urls do not resolve`);
  process.exit(1);
}
console.log(`\ncdn ok — ${results.length} urls resolve`);
