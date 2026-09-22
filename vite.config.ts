import { defineConfig } from "vite-plus";

const ignorePatterns = [
  "preview/**",
  "templates/**",
  "guide/**",
  "dist/**",
  ".handoff-src/**",
  "system/assets/**",
  "wrangler.toml",
  ".github/**",
  "pnpm-lock.yaml",
];

export const verifyPureCommands = [
  "wrangler types",
  "vp check",
  "pnpm run guide:sync",
  "node scripts/check.ts",
  "vp test run",
  "pnpm run design:check",
];

export default defineConfig({
  run: {
    tasks: {
      verifyPure: {
        command: verifyPureCommands,
      },
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
  },
  staged: {
    "src/**/*.{js,mjs,cjs,ts}": "vp check --fix",
    "scripts/**/*.{js,mjs,cjs,ts}": "vp check --fix",
    "test/**/*.{js,mjs,cjs,ts}": "vp check --fix",
    "vite.config.ts": "vp check --fix",
  },
  fmt: {
    ignorePatterns,
  },
  lint: {
    ignorePatterns,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
