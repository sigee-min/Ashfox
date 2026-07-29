# ADR-0001: Build a Standalone Web Studio

Status: **Accepted**

Date: 2026-07-28

## Context

Ashfox Studio provides complete asset authoring and delivery in the AI IDE
in-app browser. The Web Studio owns its editor, renderer, project state,
validation, and exporters.

## Decision

Ashfox will build a standalone browser-based authoring environment backed by a standalone command engine and persisted canonical project document.

Blockbench MCP is an optional, separately built compatibility product.

The standalone product includes:

- a WebGL workbench;
- direct scene, texture, UV, and animation editing;
- semantic browser controls and an Ashfox-owned Agent Command Port;
- deterministic preview rendering;
- Ashfox-owned exporters and downloadable artifacts.

## Consequences

- UI and agent workflows can be designed together;
- project state becomes portable and persistent;
- rendering and export behavior can be tested independently;
- the full authoring workflow runs on one local machine.
- Ashfox must own a production editor engine, renderer, asset pipeline, and exporters;
- format compatibility requires fixtures rather than delegation to Blockbench;
- viewport and texture performance become Ashfox responsibilities;
- Web and Blockbench compatibility require separate release gates.
