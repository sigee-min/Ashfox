# Vision and Scope

Status: **Accepted**

## Product statement

Ashfox is an AI-native low-poly workbench where an AI IDE creates consistent
modeling, texture, and animation results while the creator observes, corrects,
validates, and exports the asset.

The public product is the web URL. Blockbench MCP is a separate optional
compatibility integration for existing users.

## Product promise

A user can:

1. ask an AI IDE to open `https://ashfox.io` in its in-app browser;
2. start immediately or grant access to an existing asset;
3. let AI IDE perform structured edits through browser-observable controls;
4. inspect every geometry, texture, UV, and animation result live;
5. export a valid Bedrock, GeckoLib 5, glTF, GLB, or Java artifact.

No account, local service, database, plugin, or Blockbench process is required.

## Experience principles

### Agent authors; the creator supervises

The viewport dominates. Secondary scene, inspector, timeline, validation, and
activity surfaces appear only when relevant.

### Immediate value

A sample or blank project renders before any setup. Existing assets use drag
and drop or file selection.

### Inspectable results

Every committed mutation has a revision, affected entity IDs, validation
findings, and an undo path.

### Sparse AI context

AI IDE receives a compact summary tied to one project revision. Entity, texture,
clip, or validation detail is loaded only when it is needed for the next
command. Integrity and target checks execute locally without another model
turn. The viewport is observed only when the next decision is genuinely visual.

### One web project authority

`ProjectDocument` is the browser project state consumed by the workbench,
renderer, validation, and exporters. Three.js objects are disposable.

### Deterministic delivery

Target profiles and exporters produce stable, fixture-tested artifacts.

### Semantic browser operation

Important state and actions have accessible DOM representations. Canvas pixels
are never the only way for AI IDE to understand or operate the project.

### AI-native delivery

Ashfox workbench prepares one persistent browser artifact. AI IDE host delivery is
defined by the [Agent Command Port](../architecture/agent-command-port.md).

## Web release scope

- project creation, import, persistence, recovery, and revision history;
- bone, cube, mesh, locator, texture, UV, and animation editing;
- responsive full-area viewport and compact overlays;
- browser Agent Command Port over canonical command batches;
- bounded command inspection for AI IDE;
- visible deterministic scene, UV, animation, validation, and export tools;
- bounded agent inspection and direct canonical command batches;
- linked validation findings and deterministic previews;
- Bedrock, GeckoLib 5, glTF, GLB, and Java export;
- single-file download and ZIP delivery for multi-file targets.

## Blockbench compatibility scope

- preserve existing MCP tool names, schemas, responses, and sidecar behavior;
- preserve current Blockbench adapters and exporter behavior;
- build and test the plugin and sidecar independently;
- accept compatibility fixes;
- keep Ashfox workbench features on the browser track.

## Success criteria

- first scene renders without setup;
- Ashfox workbench builds from browser and `engine-core` packages;
- every save, export, and capture ends as one deterministic artifact handoff;
- AI IDE delivery satisfies the published agent manifest;
- exporters pass deterministic fixtures;
- narrow and desktop layouts preserve the complete viewport and timeline;
- Blockbench MCP compatibility builds and tests on its own track;
- CI has independent Web and Blockbench compatibility jobs.
- accepted artifacts pass canonical, target, and export validation.
