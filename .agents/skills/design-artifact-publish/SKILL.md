---
name: design-artifact-publish
description: Republish the uinaf design artifact from `scripts/artifact.ts` output. Use after a merge to `main` that changes tokens, patterns, screens, or `artifact/`, in a Claude session with the Artifact tool.
---

# Design artifact publish

The [uinaf design](https://claude.ai/artifact/6EmfdC7t7eMkc46RYVVH1x) artifact is generated. Never edit it by hand.

1. `pnpm run artifact`.
2. Read the artifact's `project/design-system.json`. The tool refuses to publish to an artifact the session has not read.
3. Publish once to the artifact's URL:
   - `root`: `artifact/out`
   - `file_path`: its `project/README.md`
   - `files`: every other path in `artifact/out/files.json`

Done when the artifact's Components view renders the changed cards.

- A new mark or icon is an asset upload plus an index record.
- A new CDN image in markup needs its blob URL in `notes.images`.
