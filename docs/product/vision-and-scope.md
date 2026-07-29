# Vision and Scope

Status: **Accepted**

## Product statement

Ashfox Studio is a zero-install browser 3D workspace where Codex creates the
asset and a creator observes, corrects, validates, and exports the result.

The public product is the web URL. Blockbench MCP is a separate optional
compatibility integration for existing users.

## Product promise

A user can:

1. open Ashfox Studio;
2. start immediately or grant access to an existing asset;
3. let Codex perform structured edits through browser-observable controls;
4. inspect every geometry, texture, UV, and animation result live;
5. export a valid Bedrock, GeckoLib 5, glTF, GLB, or Java artifact.

No account, local service, database, plugin, or Blockbench process is required.

## Experience principles

### Agent authors; the creator supervises

The viewport dominates. Secondary scene, inspector, timeline, validation, and
activity surfaces appear only when relevant.

### Immediate value

A sample or blank project renders before any setup. Existing assets use drag
and drop, file selection, or an explicitly authorized project folder.

### Inspectable results

Every committed mutation has a revision, affected entity IDs, validation
findings, and an undo path.

### Sparse AI context

Codex receives a compact summary tied to one project revision. Entity, texture,
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
are never the only way for Codex to understand or operate the project.

## Web release scope

- project creation, import, persistence, recovery, and revision history;
- bone, cube, mesh, locator, texture, UV, and animation editing;
- responsive full-area viewport and compact overlays;
- browser Agent Command Port over canonical command batches;
- bounded command inspection for Codex;
- visible deterministic scene, UV, animation, validation, and export tools;
- bounded agent inspection and direct canonical command batches;
- linked validation findings and deterministic previews;
- Bedrock, GeckoLib 5, glTF, GLB, and Java export;
- single-file and multi-file delivery;
- optional File System Access workspace integration.

## Blockbench compatibility scope

- preserve existing MCP tool names, schemas, responses, and sidecar behavior;
- preserve current Blockbench adapters and exporter behavior;
- build and test the plugin and sidecar independently;
- accept compatibility fixes;
- keep Web Studio features on the browser track.

## Success criteria

- first scene renders without setup;
- Web Studio builds from browser and `engine-core` packages;
- direct local folder access requires at most one explicit permission action;
- exporters pass deterministic fixtures;
- narrow and desktop layouts preserve the complete viewport and timeline;
- Blockbench MCP compatibility builds and tests on its own track;
- CI has independent Web and Blockbench compatibility jobs.
- accepted artifacts pass canonical, target, and export validation.
