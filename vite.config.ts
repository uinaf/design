import { defineConfig } from "vite-plus";

const handoffIgnore = [
  "DESIGN.md",
  "dist/**",
  "guide/**",
  "preview/**",
  "templates/**",
  "system/**",
  ".handoff-src/**",
];

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  pack: {
    entry: ["src/cdn.ts"],
    dts: true,
  },
  staged: {
    "*.{js,mjs,cjs,ts,mts,cts}": "vp check --fix",
  },
  fmt: {
    ignorePatterns: handoffIgnore,
  },
  lint: {
    ignorePatterns: handoffIgnore,
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
