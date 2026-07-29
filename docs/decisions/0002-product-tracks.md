# ADR-0002: Separate Web and Blockbench Product Tracks

Status: **Accepted**

Date: 2026-07-28

## Context

Web Studio and Blockbench MCP have different runtime authorities. Web Studio
owns a browser-local `ProjectDocument`. Blockbench owns the live project in the
compatibility integration.

## Decision

Ashfox ships two independent runtime tracks.

### Web Studio

- runs in the browser;
- stores project state through browser adapters;
- uses `engine-core` directly;
- exposes semantic browser controls and the Agent Command Port.

### Blockbench MCP compatibility

- preserves the MCP contracts and Blockbench runtime;
- builds a plugin and sidecar;
- treats Blockbench as the live project authority.

Shared code is limited to host-independent asset types, pure asset algorithms,
exporters, validation, and fixtures.

## Consequences

- Web Studio opens directly from a URL.
- Blockbench compatibility can evolve on its own release gate.
- CI, builds, packages, and fixtures identify their product track.
- File import and export are the compatibility boundary.
