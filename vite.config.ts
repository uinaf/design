import { defineConfig } from "vite-plus";

// One list, two consumers: `vp fmt` and `vp lint` skip the same set of handoff
// surfaces adopted content-verbatim, build output, and files another tool owns.
// Declared twice, a new path had to be added in both places, and a formatter
// that rewrites a file it must not touch reports nothing.
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
