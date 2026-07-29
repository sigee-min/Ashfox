# Ashfox Studio Planning

This directory defines Ashfox as two physically separated product tracks:

- a zero-install Web Studio;
- an optional Blockbench MCP compatibility integration.

Each document distinguishes implemented contracts from planned runtime work. Current implementation evidence remains in source code and tests.

## Navigation

### Product

- [Vision and scope](product/vision-and-scope.md)

### Research

- [Single-agent quality per token](research/single-agent-quality.md)

### Architecture

- [System overview](architecture/overview.md)
- [Authority boundaries](architecture/authority-boundaries.md)
- [Web state management](architecture/web-state-management.md)
- [Canonical project document](architecture/project-document.md)
- [Canonical Asset IR](architecture/asset-ir.md)
- [Commands and results](architecture/commands-and-results.md)
- [AI-native authoring](architecture/ai-native-authoring.md)
- [Agent Command Port](architecture/agent-command-port.md)
- [Rendering, assets, and export](architecture/rendering-assets-export.md)
- [Export target architecture](architecture/export-targets.md)

### Experience

- [Web workbench UX](ux/workbench.md)

### Migration

- [Roadmap and delivery gates](migration/roadmap.md)
- [Capability parity matrix](migration/parity-matrix.md)

### Decisions

- [ADR-0001: Build a standalone web studio](decisions/0001-standalone-web-studio.md)
- [ADR-0002: Separate Web and Blockbench product tracks](decisions/0002-product-tracks.md)
- [ADR-0003: Single-agent authoring](decisions/0003-single-agent-authoring.md)

## Document status vocabulary

- **Proposed**: design is open for revision.
- **Accepted**: design direction is approved.
- **In progress**: implementation has started but the delivery gate is not met.
- **Implemented**: the documented gate has passing evidence.

## Working rules

1. `engine-core` owns canonical web model, validation, and exporters.
2. Web Studio imports browser and `engine-core` packages.
3. Blockbench compatibility packages serve the Blockbench product track.
4. `ProjectDocument` contains canonical asset state.
5. The two tracks share format contracts and deterministic snapshots.
6. A delivery gate passes only when Web and Blockbench compatibility tests run independently.
7. Codex writes through validated canonical commands.
8. Integrity and target checks run locally and never require another AI turn.
9. A schema change updates every reader, writer, validator, fixture, and test
   in the same change.
10. Agent context is bounded and loaded on demand.
11. Documentation describes current product authority and active delivery
    gates.
