---
name: uinaf-design
description: "Route explicitly authorized uinaf interface, brand-asset, and repository-copy work through the live design.uinaf.dev contract. Use only when explicitly invoked for a uinaf-owned repository or surface; never use for put.io, OpenClaw, or unrelated projects. The skill carries workflow, not design rules."
disable-model-invocation: true
---

# uinaf design

This is a manual skill. Its presence never authorizes uinaf styling outside
explicitly scoped uinaf work.

## Workflow

1. **Keep implementation with its owner.** This package supplies the design
   system and general brand guidance. Product-specific UI and copy belong in
   that product's repository.
2. **Fetch one live source before writing.** Prefer the MCP server at
   `https://design.uinaf.dev/mcp` when it is connected:
   - Whole product screen → `get_page`
   - uinaf.dev surface or export artboard → `get_template`
   - Component → `list_patterns`, then `get_pattern`
   - Token value → `get_tokens`
   - Voice or general rule → `search_guidelines` with one exact topic such as
     `voice`, `type`, `color`, `layout`, or `motion`
3. **Fall back to Markdown, not memory.** When MCP is unavailable, read
   `https://design.uinaf.dev/llms.txt`, choose the one relevant link, and fetch
   it. Use `/design.md` for voice and general guidance and `/readme.md` for
   package setup. Do not load the whole catalog. If neither route is reachable,
   stop and report the missing design context.
4. **Reuse the shipped system.** Import `@uinaf/design/css`, copy the fetched
   structure, and adapt content. Do not recreate a component from prose.
5. **Finish through the owning repo's gate.** Run its existing
   `npm run design:check`. If the script is missing, consult `/readme.md`; do not
   install dependencies, create a ratchet, or widen the task without approval.
