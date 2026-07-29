# Authority Boundaries

Status: **Accepted**

## Dependency direction

```text
Web track:
engine-core ← web state / persistence / viewport

Blockbench track:
engine-core pure algorithms → blockbench-runtime
blockbench-contracts ← blockbench-runtime ← plugin / sidecar entries
```

Each track resolves dependencies within its boundary. Host-independent format
logic belongs in `engine-core`.

## Single authorities

| Concern | Authority |
| --- | --- |
| Canonical web document and entity types | `packages/engine-core` |
| Web scene mutation primitives | `packages/engine-core/src/scene.ts` |
| Web command receipts and findings | `packages/engine-core/src/commands/types.ts` |
| Command names, runtime schemas, validation, and execution | `packages/engine-core/src/commands` |
| Host-independent UV packing and deterministic texture shading | `packages/engine-core/src/textures` |
| Web project revision and undo history | `apps/web/.../state/historyReducer.ts` |
| Active web project persistence | `apps/web/.../persistence` |
| Three.js projection | `apps/web/.../viewport` |
| Bounded AI state projection | `apps/web/.../agent` |
| Browser file-operation lifecycle | `apps/web/.../files` |
| Browser selection, camera, panels, playback | `apps/web/.../workbench` |
| Blockbench live project | Blockbench |
| Blockbench adapter behavior | `packages/blockbench-runtime` |
| MCP schemas and response DTOs | `packages/blockbench-contracts` |
| MCP transport | `packages/blockbench-runtime/src/transport/mcp` |

`historyReducer.present` is the active Web Studio project authority. IndexedDB
is a guarded durable snapshot store. A project session selects one writable
storage adapter.

## Cross-track rules

- Web runtime dependencies stay inside `apps/web` and `packages/engine-core`.
- Blockbench runtime may use host-independent `engine-core` algorithms but
  cannot use Web Studio state, presentation, or browser adapters.
- A project session selects exactly one host: Web Studio or Blockbench.
- Format parity is measured with shared fixtures.
- Canonical command sources use host-independent domain names.
- Codex writes project state through canonical commands.
- Agent projections are read-only, capped, and tied to the revision from which
  they were derived.
- A contract change updates its type, reader, writer, validator, fixture, and
  test together.

## File responsibility rules

- A file owns one reason to change.
- Domain types live separately from browser, Blockbench, and transport code.
- React components render one workbench area and receive explicit props.
- Hooks coordinate one lifecycle.
- Infrastructure modules perform I/O; domain modules own decisions.
- Barrel files expose modules only.
