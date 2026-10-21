---
name: uinaf-design
description: "Route uinaf interface, brand-asset, and repository-copy work through the live design.uinaf.dev contract. For uinaf-owned repositories and surfaces only; put.io, OpenClaw, and other projects have their own design. Carries workflow, not design rules."
disable-model-invocation: true
---

# uinaf design

## Workflow

1. **Keep implementation with its owner.** This package supplies the design
   system and general brand guidance. Product-specific UI and copy belong in
   that product's repository.
2. **Fetch one live source before writing, not memory.** Read
   `https://design.uinaf.dev/llms.txt`, choose the one relevant link, and fetch
   it. Use `/design.md` for voice and general guidance and `/readme.md` for
   package setup. If the guide is unreachable, stop and report the missing
   design context.
3. **Reuse the shipped system.** Import `@uinaf/design/css`, copy the fetched
   structure, and adapt content.
4. **Finish through the owning repo's gate.** Run its existing
   `design:check` script through the repo's declared package manager. If the
   script is missing, follow `/readme.md` and ask before adding dependencies or
   a ratchet baseline.
