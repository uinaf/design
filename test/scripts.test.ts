import { describe, expect, it } from "vite-plus/test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { invokedPackageScripts, invokedScripts, reachableFrom } from "./reachability.ts";

const root = resolve(import.meta.dirname, "..");
const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
  scripts?: Record<string, string>;
};
const packageScripts = pkg.scripts ?? {};

/**
 * Scripts deliberately left out of `verify`, each with the reason. The reason is
 * enforced below: an exemption nobody had to justify is how the thing being
 * exempted stops being noticed.
 */
const MANUAL: Record<string, string> = {};

describe("every script has a reader", () => {
  const readScript = (file: string): string | null => {
    const source = resolve(root, "scripts", file);
    return existsSync(source) ? readFileSync(source, "utf8") : null;
  };

  it("runs every script in scripts/ from verify, or exempts it with a reason", () => {
    const reached = reachableFrom("verify", packageScripts, readScript);
    const orphaned = readdirSync(resolve(root, "scripts"))
      .filter((file) => /\.(?:ts|sh|mjs|js)$/.test(file))
      .filter((file) => !reached.has(file) && !(file in MANUAL));
    expect(
      orphaned.sort(),
      "wire it into verify, or add it to MANUAL in this file with a reason",
    ).toEqual([]);
  });

  it("makes every MANUAL exemption carry a reason", () => {
    const unexplained = Object.entries(MANUAL)
      .filter(([, reason]) => reason.trim() === "")
      .map(([file]) => file);
    expect(unexplained).toEqual([]);
  });

  it("keeps MANUAL free of scripts that no longer exist", () => {
    const missing = Object.keys(MANUAL).filter(
      (file) => !existsSync(resolve(root, "scripts", file)),
    );
    expect(missing).toEqual([]);
  });
});

describe("invokedScripts", () => {
  it("reads a script the command actually runs", () => {
    expect(invokedScripts("node scripts/build.ts")).toEqual(["build.ts"]);
    expect(invokedScripts("./scripts/smoke.sh")).toEqual(["smoke.sh"]);
    expect(invokedScripts("bash scripts/smoke.sh")).toEqual(["smoke.sh"]);
    expect(invokedScripts("node --enable-source-maps scripts/build.ts")).toEqual(["build.ts"]);
    expect(invokedScripts("SMOKE_PORT=8801 node scripts/smoke-mcp.ts http://x")).toEqual([
      "smoke-mcp.ts",
    ]);
  });

  it("reads each command in a chain", () => {
    expect(invokedScripts("node scripts/build.ts && node scripts/check.ts")).toEqual([
      "build.ts",
      "check.ts",
    ]);
  });

  // The whole point of the gate. Every form below names a script without
  // running it, and each one satisfied an earlier version of this guard.
  it("does not treat a mention as an invocation", () => {
    expect(invokedScripts("echo scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts("echo node scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts("printf ./scripts/orphan.sh")).toEqual([]);
    expect(invokedScripts("# node scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts(";# node scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts("// node scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts('echo "a; node scripts/orphan.ts"')).toEqual([]);
  });

  it("does not read a command out of a comment or string that spans lines", () => {
    // A line comment is already handled by the head check. These are not: the
    // interpreter lands at the start of its own line, so without stripping the
    // span first, a paragraph of prose marks a script reachable.
    expect(invokedScripts("/*\nnode scripts/orphan.ts\n*/")).toEqual([]);
    expect(invokedScripts("const usage = `\nnode scripts/orphan.ts\n`;")).toEqual([]);
    expect(invokedScripts("/* a */ node scripts/build.ts")).toEqual(["build.ts"]);
  });

  it("does not match a path that merely ends in a script name", () => {
    expect(invokedScripts("node vendor/scripts/build.ts")).toEqual([]);
    expect(invokedScripts("node scripts/build.ts.bak")).toEqual([]);
  });

  it("does not read an interpreter that is not in command position", () => {
    // `sh` inside `smoke.sh scripts/smoke-mcp.ts` is the trap a left boundary
    // on the interpreter alone does not close.
    expect(invokedScripts("echo scripts/smoke.sh scripts/smoke-mcp.ts")).toEqual([]);
  });
});

describe("invokedPackageScripts", () => {
  it("reads a package script the command runs", () => {
    expect(invokedPackageScripts("vp check && pnpm run smoke")).toEqual(["smoke"]);
  });

  it("does not read one that is only mentioned", () => {
    expect(invokedPackageScripts("# pnpm run smoke")).toEqual([]);
    expect(invokedPackageScripts(";# pnpm run smoke")).toEqual([]);
    expect(invokedPackageScripts("echo pnpm run smoke")).toEqual([]);
  });
});
