/**
 * The guide Worker: `pnpm run deploy` ships it to production and
 * `alchemy dev` serves it for the smoke.
 *
 * State lives in memory, so every run starts empty and adopts the live script
 * by its ownership tags; there is no state to host, lock, or lose.
 *
 * `domain` stays unset because `design.uinaf.dev` is bound in `uinaf/infra`;
 * setting it, even to `null`, would make Alchemy reconcile that binding.
 */

import * as Alchemy from "alchemy";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as RemovalPolicy from "alchemy/RemovalPolicy";
import { inMemoryState } from "alchemy/State";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "uinaf-design",
  { providers: Cloudflare.providers(), state: inMemoryState() },
  Effect.gen(function* () {
    const worker = yield* Cloudflare.Worker("Guide", {
      name: "uinaf-design",
      main: "./src/worker.ts",
      // Alchemy adds new_module_registry unasked; listing it lets wrangler.toml match.
      compatibility: { date: "2025-08-01", flags: ["new_module_registry"] },
      workersDev: { enabled: true, previewsEnabled: false },
      assets: {
        directory: "./guide",
        // Assets serve at their exact path: /patterns/x.html is a 200, not a redirect.
        htmlHandling: "none",
        notFoundHandling: "none",
        // HTML runs the Worker first so Accept: text/markdown can serve the twin;
        // CSS, JSON, and .md stay on the asset fast path.
        runWorkerFirst: ["/", "/*.html", "/patterns/*.html", "/preview/*.html"],
      },
      // The smoke probes one port, so a silent fallback would test nothing.
      // 8787 by default keeps `pnpm run dev` off the smoke's 8788.
      dev: { port: Number(process.env.DEV_PORT ?? 8787), strictPort: true },
    }).pipe(RemovalPolicy.retain());
    return { url: worker.url };
  }),
);
