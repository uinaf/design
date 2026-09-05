import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  checkInputs,
  checkPackage,
  checkProvenance,
  checkRelease,
  lookup,
} from "../scripts/recover-1.14.5.ts";

afterEach(() => vi.unstubAllGlobals());

describe("fixed release recovery", () => {
  it("allows only the four recovery files to differ from the tag", () => {
    expect(() =>
      checkInputs([
        ".github/workflows/release.yml",
        "docs/releasing.md",
        "scripts/recover-1.14.5.ts",
        "test/recovery.test.ts",
      ]),
    ).not.toThrow();
    for (const file of [
      "package.json",
      "pnpm-lock.yaml",
      "src/lint/index.ts",
      "scripts/build.ts",
      "assets/logo.svg",
      "test/other.test.ts",
      "scripts/../package.json",
    ]) {
      expect(() => checkInputs([file])).toThrow("Package input changed");
    }
  });

  it("accepts only a confirmed 404 as absence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(lookup("https://registry.npmjs.org/fixture")).resolves.toBeNull();
  });

  for (const status of [401, 403, 429, 500, 503]) {
    it(`stops on HTTP ${status} instead of republishing`, async () => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
      await expect(lookup("https://registry.npmjs.org/fixture")).rejects.toThrow(`HTTP ${status}`);
    });
  }

  it("preserves network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unavailable")));
    await expect(lookup("https://registry.npmjs.org/fixture")).rejects.toThrow(
      "network unavailable",
    );
  });

  it("rejects malformed successful responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json([])));
    await expect(lookup("https://registry.npmjs.org/fixture")).rejects.toThrow("Expected object");
  });

  it("requires matching version, artifact integrity and provenance", () => {
    const pkg = {
      name: "@uinaf/design",
      version: "1.14.5",
      gitHead: "recovery-sha",
      dist: {
        integrity: "sha512-fixture",
        attestations: { provenance: { predicateType: "https://slsa.dev/provenance/v1" } },
      },
    };
    expect(() => checkPackage(pkg, "sha512-fixture", "recovery-sha")).not.toThrow();
    expect(() => checkPackage(pkg, "sha512-fixture", "different-sha")).toThrow(
      "npm gitHead differs",
    );
    expect(() => checkPackage(pkg, "sha512-other")).toThrow("Published tarball differs");
    expect(() => checkPackage({ ...pkg, version: "1.14.6" })).toThrow();
    expect(() => checkPackage({ ...pkg, dist: { integrity: "sha512-fixture" } })).toThrow();
  });

  it("requires the exact immutable published release", () => {
    const release = { tag_name: "v1.14.5", draft: false, prerelease: false, immutable: true };
    expect(() => checkRelease(release)).not.toThrow();
    expect(() => checkRelease({ ...release, tag_name: "v1.14.4" })).toThrow();
    expect(() => checkRelease({ ...release, draft: true })).toThrow();
    expect(() => checkRelease({ ...release, immutable: false })).toThrow();
  });
});

// Payload shape from npm's published @uinaf/design@1.14.3 bundle, adapted for recovery.
const statement = {
  _type: "https://in-toto.io/Statement/v1",
  subject: [
    {
      name: "pkg:npm/%40uinaf/design@1.14.5",
      digest: {
        sha512:
          "5474f59e4b3a709c5f527edcd6114770bf5951bfa0df62bc4636fc1d783af77d9568bb106825e758c4af5574bbebf794a52177bc5a387fe7bc51c4fe3a9ee47b",
      },
    },
  ],
  predicateType: "https://slsa.dev/provenance/v1",
  predicate: {
    buildDefinition: {
      buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
      externalParameters: {
        workflow: {
          ref: "refs/heads/main",
          repository: "https://github.com/uinaf/design",
          path: ".github/workflows/release.yml",
        },
      },
      internalParameters: {
        github: {
          event_name: "workflow_dispatch",
          repository_id: "1327747420",
          repository_owner_id: "261665463",
        },
      },
      resolvedDependencies: [
        {
          uri: "git+https://github.com/uinaf/design@refs/heads/main",
          digest: {
            gitCommit: "b0b149290e443c0c11ea69d6e084b545e94ddc5d",
          },
        },
      ],
    },
    runDetails: {
      builder: {
        id: "https://github.com/actions/runner/github-hosted",
      },
      metadata: {
        invocationId: "https://github.com/uinaf/design/actions/runs/32478126334/attempts/1",
      },
    },
  },
};
const integrity = `sha512-${Buffer.from(statement.subject[0].digest.sha512, "hex").toString("base64")}`;
const buildSha = "b0b149290e443c0c11ea69d6e084b545e94ddc5d";
function bundle(payload: unknown) {
  return {
    attestations: [
      {
        predicateType: "https://slsa.dev/provenance/v1",
        bundle: {
          dsseEnvelope: {
            payloadType: "application/vnd.in-toto+json",
            payload: Buffer.from(JSON.stringify(payload)).toString("base64"),
          },
        },
      },
    ],
  };
}
it("checks the actual npm provenance payload", () => {
  expect(() => checkProvenance(bundle(statement), integrity, buildSha)).not.toThrow();
  expect(() => checkProvenance({ attestations: [] }, integrity, buildSha)).toThrow();
  expect(() => checkProvenance(bundle(statement), integrity, "different-sha")).toThrow(
    "event commit",
  );
});
it.each([
  [
    "subject digest",
    (s: typeof statement) => {
      s.subject[0].digest.sha512 = "0".repeat(128);
    },
  ],
  [
    "subject name",
    (s: typeof statement) => {
      s.subject[0].name = "pkg:npm/other@1.14.5";
    },
  ],
  [
    "repository",
    (s: typeof statement) => {
      s.predicate.buildDefinition.externalParameters.workflow.repository =
        "https://github.com/other/design";
    },
  ],
  [
    "workflow",
    (s: typeof statement) => {
      s.predicate.buildDefinition.externalParameters.workflow.path = ".github/workflows/other.yml";
    },
  ],
  [
    "ref",
    (s: typeof statement) => {
      s.predicate.buildDefinition.externalParameters.workflow.ref = "refs/tags/v1.14.5";
    },
  ],
  [
    "event",
    (s: typeof statement) => {
      s.predicate.buildDefinition.internalParameters.github.event_name = "push";
    },
  ],
  [
    "runner",
    (s: typeof statement) => {
      s.predicate.runDetails.builder.id = "https://github.com/actions/runner/self-hosted";
    },
  ],
])("rejects a mismatched provenance %s", (_label, mutate) => {
  const changed = structuredClone(statement);
  mutate(changed);
  expect(() => checkProvenance(bundle(changed), integrity, buildSha)).toThrow();
});
