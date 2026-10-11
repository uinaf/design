/**
 * The guide Worker: `pnpm run deploy` ships it to production and
 * `alchemy dev` serves it for the smoke.
 *
 * State is throwaway. The live script carries Alchemy's ownership tags, so a
 * fresh state store adopts it on every deploy. The cost: renaming or removing
 * the Worker here never deletes the old script on Cloudflare.
 *
 * `domain` stays unset because `design.uinaf.dev` is bound in `uinaf/infra`;
 * setting it, even to `null`, would make Alchemy reconcile that binding.
 */

import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { localState } from "alchemy/State";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "uinaf-design",
  { providers: Cloudflare.providers(), state: localState() },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Worker("Guide", {
      name: "uinaf-design",
      main: "./src/worker.ts",
      // The Agents SDK MCP handler imports node:async_hooks.
      compatibility: { date: "2025-08-01", flags: ["nodejs_compat"] },
      workersDev: { enabled: true, previewsEnabled: false },
      assets: {
        directory: "./guide",
        // Assets serve at their exact path: /patterns/x.html is a 200, not a redirect.
        htmlHandling: "none",
        notFoundHandling: "none",
        // HTML runs the Worker first so Accept: text/markdown can serve the twin;
        // CSS, JSON, and .md stay on the asset fast path.
        runWorkerFirst: ["/mcp", "/mcp/", "/", "/*.html", "/patterns/*.html", "/preview/*.html"],
      },
      // The smoke probes one port, so a silent fallback would test nothing.
      dev: { port: Number(process.env.DEV_PORT ?? 8788), strictPort: true },
    });
    return { url: worker.url };
  }),
);
