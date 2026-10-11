/**
 * Alchemy pilot: the same Worker `wrangler.toml` deploys, declared as an
 * Alchemy stack. `wrangler deploy` still ships production; this file only
 * plans against the live `uinaf-design` script until the pilot is accepted.
 *
 * The custom domain stays in `uinaf/infra`, so no `domain` here.
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
      compatibility: { date: "2025-08-01", flags: ["nodejs_compat"] },
      workersDev: { enabled: true, previewsEnabled: false },
      assets: {
        directory: "./guide",
        htmlHandling: "none",
        notFoundHandling: "none",
        runWorkerFirst: ["/mcp", "/mcp/", "/", "/*.html", "/patterns/*.html", "/preview/*.html"],
      },
    });
    return { url: worker.url };
  }),
);
