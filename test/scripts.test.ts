import { describe, expect, it } from "vite-plus/test";
import { importedScripts, invokedPackageScripts, invokedScripts } from "../scripts/reachability.ts";

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

  it("strips an inline comment before splitting on separators", () => {
    // The tail of an inline comment is not a command, but splitting first makes
    // it look like one with a real interpreter at its head.
    expect(invokedScripts("echo ok # node scripts/orphan.ts; node scripts/orphan.ts")).toEqual([]);
    expect(invokedScripts("echo ok // node scripts/orphan.ts | node scripts/orphan.ts")).toEqual(
      [],
    );
    expect(invokedScripts("node scripts/build.ts # then the rest")).toEqual(["build.ts"]);
    // A URL is not a comment: `//` and `#` only open one at a token boundary.
    expect(invokedScripts("node scripts/smoke-mcp.ts https://x.dev/a#b")).toEqual(["smoke-mcp.ts"]);
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

describe("importedScripts", () => {
  it("follows a helper into the file that imports it", () => {
    expect(importedScripts('import { reachableFrom } from "./reachability.ts";')).toEqual([
      "reachability.ts",
    ]);
    expect(importedScripts('const m = await import("./reachability.ts");')).toEqual([
      "reachability.ts",
    ]);
  });

  it("does not treat a package import as a sibling script", () => {
    expect(importedScripts('import fs from "node:fs";')).toEqual([]);
    expect(importedScripts('import { parse } from "yaml";')).toEqual([]);
  });
});
