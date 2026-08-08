import { defineConfig } from "vite-plus";

export default defineConfig({
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
    ignorePatterns: [
      "preview/**",
      "templates/**",
      "guide/**",
      "dist/**",
      ".handoff-src/**",
      "system/assets/**",
      "wrangler.toml",
      "pnpm-lock.yaml",
    ],
  },
  lint: {
    ignorePatterns: [
      "preview/**",
      "templates/**",
      "guide/**",
      "dist/**",
      ".handoff-src/**",
      "system/assets/**",
      "wrangler.toml",
      "pnpm-lock.yaml",
      "scripts/**/*.mjs",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
