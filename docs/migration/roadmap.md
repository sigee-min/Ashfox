# Web Product Roadmap

Status: **Accepted**

The Web Studio is the primary product. Blockbench MCP is maintained as an
isolated compatibility track.

## Phase 1: Browser project foundation

Progress: **In progress**

- complete canonical command coverage;
- move command orchestration behind one Web Studio boundary;
- preserve revision history, undo, receipts, and validation;
- define storage adapters for IndexedDB, OPFS, and user file handles;
- prevent multiple writable stores in one project session.

Gate:

- reload preserves IDs and revision;
- stale writes are rejected or reconciled;
- a corrupted draft recovers without losing the last valid revision.

## Phase 2: Zero-friction file workflow

Progress: **In progress**

- drag-and-drop and file picker import;
- self-contained `.ashfox` open/save;
- format and target-profile auto-detection;
- download fallback for unsupported browser capabilities.

Gate:

- blank work requires no permission;
- an existing project requires one explicit access action;
- export can write to a selected target or download deterministically.

## Phase 3: Deterministic authoring core

Progress: **In progress**

- one command-definition registry shared by runtime validation, React actions,
  and AI IDE;
- schema validation and atomic apply;
- multi-entity create, transform, mirror, repeat, align, pivot, and hierarchy
  commands;
- UV fit and deterministic Minecraft atlas/shading commands;
- bulk animation keys, mirroring, phase, timing, and loop commands;
- context-valid tools in the workbench;
- canonical receipts and undo.

Gate:

- React interactions use the canonical command executor;
- deterministic tools preserve stable IDs and relationships;
- invalid batches are rejected atomically.

## Phase 4: Single-agent authoring

Progress: **In progress**

- page-local `inspect` and `run` surface;
- command-port status and revision in semantic DOM state;
- compact project inspection capped independently of project size;
- on-demand entity, texture, clip, target, command, and finding detail;
- bounded canonical `CommandBatch` input;
- one compact machine-readable result;
- focus and undo review in the viewport;
- deterministic fixed and user-requested turntable previews;
- responsive and performance budgets for narrow in-app panes.

Gate:

- normal edits serialize only bounded requested context;
- local validation consumes zero AI turns;
- ordinary modeling uses at most one screenshot when a visual decision is
  required;
- AI IDE discovers the needed command directly from the open page;
- browser QA covers inspection, run, rendering, failure, and undo.

## Phase 5: Production delivery

Progress: **In progress**

- target presets for Bedrock, GeckoLib 5, glTF/GLB, and Java;
- self-contained GLB and deterministic multi-file bundles;
- target path previews and overwrite confirmation;
- golden fixtures and target-schema validation.

Gate:

- each exported fixture passes its target schema and deterministic snapshot;
- output names, references, textures, hierarchy, and animation validate;
- failed delivery preserves the current artifact.

## Compatibility maintenance

Blockbench MCP remains on its own release gate:

1. runtime unit tests;
2. MCP schema and protocol conformance;
3. plugin bundle;
4. sidecar bundle;
5. current public artifact names.

The Blockbench compatibility surface follows its public contract.
