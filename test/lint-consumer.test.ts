import { expect, it } from "vite-plus/test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

// TypeScript 7 ships no JavaScript compiler API, so the consumer program is
// checked by the native `tsc` it ships instead of an in-memory host.
const tsc = join(
  dirname(createRequire(import.meta.url).resolve("typescript/package.json")),
  "bin/tsc",
);

it("exposes scoped lint options through the built package export", () => {
  const root = resolve(import.meta.dirname, "..");
  // Inside the package so `@uinaf/design/lint` resolves through its own exports.
  const dir = mkdtempSync(join(import.meta.dirname, ".lint-consumer-"));
  const file = join(dir, "lint-consumer.mts");
  writeFileSync(
    file,
    `import { check, collectFiles, type CheckOptions, type RuleException } from '@uinaf/design/lint';
const exception: RuleException = { path: 'export-', rules: ['type-scale-only'] };
const options: CheckOptions = { paths: ['src'], except: [exception], relativeTo: process.cwd() };
check(options);
check({ except: [exception] });
check({ relativeTo: process.cwd() });
const files: string[] = collectFiles(['src'], [], process.cwd());
`,
  );
  try {
    const result = spawnSync(
      process.execPath,
      [
        tsc,
        "--ignoreConfig",
        "--noEmit",
        "--strict",
        "--skipLibCheck",
        "--target",
        "es2022",
        "--module",
        "nodenext",
        "--moduleResolution",
        "nodenext",
        "--types",
        "node",
        "--pretty",
        "false",
        file,
      ],
      { cwd: root, encoding: "utf8" },
    );
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({
      status: 0,
      output: "",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
