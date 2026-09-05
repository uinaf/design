// Fixed recovery for the tag created before npm rejected the self-hosted runner.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

const tag = "v1.14.5";
const sha = "c2a9bf32df62783d44ef2422fefbb73d42e5b2a8";
const version = "1.14.5";
const repo = "uinaf/design";

function record(value: unknown): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), "Expected object");
  return Object.fromEntries(Object.entries(value));
}

export async function lookup(url: string, token?: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 404) return null;
  assert(response.ok, `Lookup failed: HTTP ${response.status} at ${url}`);
  return record(await response.json());
}

export function checkInputs(files: string[]): void {
  const recoveryFiles = new Set([
    ".github/workflows/release.yml",
    "docs/releasing.md",
    "scripts/recover-1.14.5.ts",
    "test/recovery.test.ts",
  ]);
  for (const file of files) assert(recoveryFiles.has(file), `Package input changed: ${file}`);
}

export function checkPackage(
  pkg: Record<string, unknown>,
  integrity?: string,
  buildSha?: string,
): void {
  assert.equal(pkg.name, "@uinaf/design");
  assert.equal(pkg.version, version);
  if (buildSha) assert.equal(pkg.gitHead, buildSha, "npm gitHead differs from the recovery build");
  const dist = record(pkg.dist);
  assert.equal(typeof dist.integrity, "string");
  if (integrity)
    assert.equal(dist.integrity, integrity, "Published tarball differs from verified build");
  const attestations = record(dist.attestations);
  assert.equal(record(attestations.provenance).predicateType, "https://slsa.dev/provenance/v1");
}

// npm validates the signed bundle at ingestion; check its registry-served claims here.
export function checkProvenance(
  response: Record<string, unknown>,
  integrity: string,
  buildSha: string,
): void {
  assert(Array.isArray(response.attestations), "Missing npm attestations");
  const entries = response.attestations
    .map(record)
    .filter((entry) => entry.predicateType === "https://slsa.dev/provenance/v1");
  assert.equal(entries.length, 1, "Expected one npm provenance statement");
  const envelope = record(record(entries[0]?.bundle).dsseEnvelope);
  assert.equal(envelope.payloadType, "application/vnd.in-toto+json");
  assert.equal(typeof envelope.payload, "string");
  const statement = record(
    JSON.parse(Buffer.from(String(envelope.payload), "base64").toString("utf8")),
  );
  assert.equal(statement._type, "https://in-toto.io/Statement/v1");
  assert.equal(statement.predicateType, "https://slsa.dev/provenance/v1");
  assert.match(integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert.deepEqual(
    statement.subject,
    [
      {
        name: "pkg:npm/%40uinaf/design@1.14.5",
        digest: { sha512: Buffer.from(integrity.slice(7), "base64").toString("hex") },
      },
    ],
    "Provenance subject differs from the npm artifact",
  );
  const predicate = record(statement.predicate);
  const definition = record(predicate.buildDefinition);
  assert.equal(
    definition.buildType,
    "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
  );
  assert.deepEqual(
    record(definition.externalParameters).workflow,
    {
      ref: "refs/heads/main",
      repository: `https://github.com/${repo}`,
      path: ".github/workflows/release.yml",
    },
    "Provenance workflow differs from recovery",
  );
  assert.equal(
    record(record(definition.internalParameters).github).event_name,
    "workflow_dispatch",
  );
  assert.deepEqual(
    definition.resolvedDependencies,
    [
      {
        uri: `git+https://github.com/${repo}@refs/heads/main`,
        digest: { gitCommit: buildSha },
      },
    ],
    "Provenance commit differs from the event commit",
  );
  assert.equal(
    record(record(predicate.runDetails).builder).id,
    "https://github.com/actions/runner/github-hosted",
  );
}

export function checkRelease(release: Record<string, unknown>): void {
  assert.equal(release.tag_name, tag);
  assert.equal(release.draft, false);
  assert.equal(release.prerelease, false);
  assert.equal(release.immutable, true);
}

async function main(): Promise<void> {
  assert.equal(process.env.GITHUB_REPOSITORY, repo);
  assert.equal(process.env.GITHUB_REF, "refs/heads/main");
  const buildSha = process.env.GITHUB_SHA;
  assert(buildSha && /^[a-f0-9]{40}$/.test(buildSha), "Expected event commit SHA");
  const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8" }).trim();
  assert.equal(git("rev-parse", "HEAD"), buildSha, "Checkout differs from the event commit");
  git("merge-base", "--is-ancestor", sha, buildSha);
  checkInputs(git("diff", "--name-only", "-z", sha, buildSha).split("\0").filter(Boolean));
  git("diff", "--exit-code", "HEAD", "--");
  const token = process.env.GH_TOKEN;
  assert(token, "Read token required for exact GitHub lookups");
  const github = (path: string) => lookup(`https://api.github.com/repos/${repo}/${path}`, token);
  const ref = await github(`git/ref/tags/${tag}`);
  assert(ref, "Release tag missing");
  assert.equal(record(ref.object).sha, sha);
  assert.equal(record(ref.object).type, "commit");
  const commit = await github(`commits/${sha}`);
  assert(commit);
  assert.equal(record(record(commit.commit).verification).verified, true);
  const comparison = await github(`compare/${buildSha}...main`);
  assert(comparison);
  assert(
    ["ahead", "identical"].includes(String(comparison.status)),
    "Recovery commit is not an ancestor of main",
  );
  const file = await github(`contents/package.json?ref=${sha}`);
  assert(file && typeof file.content === "string");
  const manifest = record(JSON.parse(Buffer.from(file.content, "base64").toString("utf8")));
  assert.equal(manifest.name, "@uinaf/design");
  assert.equal(manifest.version, version);

  const pkg = await lookup("https://registry.npmjs.org/@uinaf%2fdesign/1.14.5");
  const release = await github(`releases/tags/${tag}`);
  const mode = process.argv[2];
  assert(mode === "preflight" || mode === "published" || mode === "complete");
  if (pkg) {
    checkPackage(pkg, undefined, buildSha);
    const attestation = await lookup(
      "https://registry.npmjs.org/-/npm/v1/attestations/@uinaf%2fdesign@1.14.5",
    );
    assert(attestation, "npm provenance bundle is missing");
    checkProvenance(attestation, String(record(pkg.dist).integrity), buildSha);
  }
  if (release) checkRelease(release);
  if (mode === "preflight") {
    assert(process.env.GITHUB_OUTPUT);
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `publish=${pkg === null}\nrelease=${release === null}\n`,
    );
    return;
  }
  assert(pkg, "npm package is still missing");
  const tarball = readFileSync("uinaf-design-1.14.5.tgz");
  checkPackage(pkg, `sha512-${createHash("sha512").update(tarball).digest("base64")}`, buildSha);
  if (mode === "complete") {
    assert(release, "GitHub release is still missing");
    checkRelease(release);
    console.log(
      "v1.14.5: unchanged package inputs, recovery build integrity and immutable release verified",
    );
  }
}

if (import.meta.main) await main();
