import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { URL } from "node:url";
import { test, vi } from "vite-plus/test";
import { z } from "zod";
import { prepare } from "../scripts/release-commit.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const commit = (cwd: string) => {
  git(cwd, "add", ".");
  git(
    cwd,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "fixture",
  );
  return git(cwd, "rev-parse", "HEAD");
};
const payload = z.object({
  variables: z.object({
    input: z.object({
      expectedHeadOid: z.string(),
      branch: z.object({ repositoryNameWithOwner: z.string(), branchName: z.string() }),
      fileChanges: z.object({
        additions: z.array(z.object({ path: z.string(), contents: z.string() })),
      }),
    }),
  }),
});

for (const mode of [
  "normal",
  "advanced-before",
  "advanced-after",
  "source-edit",
  "manifest-edit",
  "http-error",
  "wrong-parent",
] as const) {
  test(`signed release writeback: ${mode}`, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "design-release-"));
    const remote = path.join(root, "remote");
    const cwd = path.join(root, "checkout");
    fs.mkdirSync(remote);
    git(remote, "init", "-b", "main");
    fs.writeFileSync(path.join(remote, "source.txt"), "verified source\n");
    fs.writeFileSync(
      path.join(remote, "package.json"),
      JSON.stringify({ name: "fixture", version: "1.0.0" }),
    );
    const expected = commit(remote);
    git(root, "clone", remote, cwd);
    const content = JSON.stringify({ name: "fixture", version: "1.0.1" });
    fs.writeFileSync(path.join(cwd, "package.json"), content);
    const context = {
      cwd,
      env: { GITHUB_SHA: expected, GITHUB_REPOSITORY: "uinaf/design", GITHUB_TOKEN: "fixture" },
      nextRelease: { version: "1.0.1", gitHead: expected },
    };
    let created = "";
    if (mode === "advanced-before") {
      fs.writeFileSync(
        path.join(remote, "package.json"),
        JSON.stringify({ name: "fixture", version: "1.0.0", newDependency: true }),
      );
      commit(remote);
    }
    if (mode === "source-edit") fs.writeFileSync(path.join(cwd, "source.txt"), "unverified\n");
    if (mode === "manifest-edit")
      fs.writeFileSync(
        path.join(cwd, "package.json"),
        JSON.stringify({ name: "other", version: "1.0.1" }),
      );
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (url, options) => {
      assert.equal(url, "https://api.github.com/graphql");
      assert.equal(typeof options?.body, "string");
      const {
        variables: { input },
      } = payload.parse(JSON.parse(z.string().parse(options?.body)));
      assert.equal(input.expectedHeadOid, expected);
      assert.deepEqual(input.branch, {
        repositoryNameWithOwner: "uinaf/design",
        branchName: "main",
      });
      assert.deepEqual(input.fileChanges.additions, [
        { path: "package.json", contents: Buffer.from(content).toString("base64") },
      ]);
      if (mode === "http-error") return new Response("denied", { status: 403 });
      if (mode === "advanced-before")
        return Response.json({
          data: null,
          errors: [{ message: "expectedHeadOid does not match branch head" }],
        });
      if (mode === "wrong-parent") {
        fs.writeFileSync(path.join(remote, "source.txt"), "raced\n");
        commit(remote);
      }
      fs.writeFileSync(path.join(remote, "package.json"), content);
      created = commit(remote);
      if (mode === "advanced-after") {
        fs.writeFileSync(path.join(remote, "source.txt"), "newer source\n");
        commit(remote);
      }
      return Response.json({ data: { createCommitOnBranch: { commit: { oid: created } } } });
    });
    try {
      if (mode === "normal" || mode === "advanced-after") {
        await prepare({}, context);
        assert.equal(git(cwd, "rev-parse", "HEAD"), created);
        assert.equal(context.nextRelease.gitHead, created);
        assert.equal(git(cwd, "show", "-s", "--format=%P", "HEAD"), expected);
        assert.equal(fs.readFileSync(path.join(cwd, "source.txt"), "utf8"), "verified source\n");
        assert.equal(fs.readFileSync(path.join(cwd, "package.json"), "utf8"), content);
        if (mode === "advanced-after") assert.notEqual(git(remote, "rev-parse", "HEAD"), created);
      } else {
        await assert.rejects(
          prepare({}, context),
          /changed files|only the package version|expectedHeadOid|HTTP 403|unexpected parent/,
        );
        assert.equal(context.nextRelease.gitHead, expected);
        assert.equal(git(cwd, "rev-parse", "HEAD"), expected);
        if (mode === "advanced-before")
          assert.match(fs.readFileSync(path.join(remote, "package.json"), "utf8"), /newDependency/);
        if (mode === "source-edit" || mode === "manifest-edit")
          assert.equal(fetchMock.mock.calls.length, 0);
      }
      assert.equal(git(remote, "tag", "--list"), "");
    } finally {
      fetchMock.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
}

test("release prepares npm before signed writeback, then publishes GitHub", () => {
  const config = z
    .object({ plugins: z.array(z.unknown()) })
    .parse(JSON.parse(fs.readFileSync(new URL("../.releaserc.json", import.meta.url), "utf8")));
  assert.equal(config.plugins[2], "@semantic-release/npm");
  assert.equal(config.plugins[3], "./scripts/release-commit.ts");
});
