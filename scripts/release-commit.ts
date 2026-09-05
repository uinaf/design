import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";

interface Context {
  cwd: string;
  env: NodeJS.ProcessEnv;
  nextRelease: { version: string; gitHead: string };
}

const oid = z.string().regex(/^[a-f0-9]{40}$/);
const manifest = z.record(z.string(), z.unknown());
const responseSchema = z.object({
  data: z.object({ createCommitOnBranch: z.object({ commit: z.object({ oid }) }) }).nullish(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

// npm's prepare runs first. Only its version edit may enter the signed commit.
export async function prepare(_config: unknown, context: Context): Promise<void> {
  const { cwd, env, nextRelease } = context;
  const expected = oid.parse(env.GITHUB_SHA);
  const repository = z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .parse(env.GITHUB_REPOSITORY);
  const token = z
    .string()
    .min(1)
    .parse(env.GITHUB_TOKEN ?? env.GH_TOKEN);
  const git = (...args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  if (git("rev-parse", "HEAD") !== expected || nextRelease.gitHead !== expected)
    throw new Error("release checkout must match the verified event commit");
  if (git("diff", "--name-only", expected, "--", ".", ":(exclude)package.json"))
    throw new Error("release preparation changed files other than package.json");
  const before = manifest.parse(JSON.parse(git("show", `${expected}:package.json`)));
  const content = fs.readFileSync(path.join(cwd, "package.json"));
  const prepared = manifest.parse(JSON.parse(content.toString("utf8")));
  if (!isDeepStrictEqual(prepared, { ...before, version: nextRelease.version }))
    throw new Error("release preparation must change only the package version");

  // GitHub signs this commit and rejects a moved branch atomically. A preflight
  // against main would leave a race between reading its head and writing it.
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) { commit { oid } }
      }`,
      variables: {
        input: {
          branch: { repositoryNameWithOwner: repository, branchName: "main" },
          expectedHeadOid: expected,
          message: { headline: `chore(release): ${nextRelease.version} [skip ci]` },
          fileChanges: {
            additions: [{ path: "package.json", contents: content.toString("base64") }],
          },
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`release writeback failed: GitHub HTTP ${response.status}`);
  const result = responseSchema.parse(await response.json());
  if (result.errors?.length)
    throw new Error(
      `release writeback rejected: ${result.errors.map((e) => e.message).join("; ")}`,
    );
  if (!result.data) throw new Error("release writeback returned no commit");
  const committed = result.data.createCommitOnBranch.commit.oid;

  // main may advance after the mutation. Fetch and tag the returned commit,
  // never the moving branch. A failure here leaves writeback without a release.
  git("fetch", "origin", committed);
  if (git("show", "-s", "--format=%P", committed) !== expected)
    throw new Error("release writeback has an unexpected parent");
  if (git("diff", "--name-only", expected, committed, "--", ".", ":(exclude)package.json"))
    throw new Error("release writeback changed source outside package.json");
  if (git("show", `${committed}:package.json`) !== content.toString("utf8").trim())
    throw new Error("release writeback does not match the prepared package");
  git("reset", "--hard", committed);
  nextRelease.gitHead = committed;
}
