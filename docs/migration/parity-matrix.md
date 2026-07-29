# Track Capability Matrix

Status: **In progress**

Parity means both tracks can deliver compatible target assets. It does not mean
they share live projects, UI, transports, or storage.

## Product ownership

| Capability | Web Studio | Blockbench MCP |
| --- | --- | --- |
| Primary user entry | URL | Blockbench plugin |
| Project authority | `ProjectDocument` in browser | Active Blockbench project |
| Agent interaction | Semantic browser controls / Agent Command Port | MCP tools |
| Persistence | IndexedDB, OPFS, file handles | Blockbench project lifecycle |
| Viewport | Ashfox Three.js renderer | Blockbench viewport |
| MCP | None | Preserved |
| Install required | No | Yes |
| Backend service | None | Local sidecar only |

## Blockbench MCP compatibility

The Blockbench track provides:

- capability, project state, validation, trace, preview, and export;
- texture read, paint, assignment, and deletion;
- bone, cube, and mesh CRUD;
- animation clip, pose, and trigger operations;
- plugin reload.

Their schemas and result shapes remain protected by
`packages/blockbench-contracts` and `packages/blockbench-conformance`.

## Web outcome parity

Web Studio must provide the user outcomes without reproducing MCP:

| Outcome | Web surface |
| --- | --- |
| Understand structure | Scene overlay and semantic project summary |
| Inspect geometry | Responsive WebGL viewport and selection |
| Correct values | Inspector overlay and canonical commands |
| Review AI IDE work | Receipts, affected entities, findings, undo |
| Edit textures and UVs | Texture/UV workspace |
| Inspect motion | Timeline and live playback |
| Deliver assets | Target validation and browser materializer |

## Export checkpoint

| Target | Current core status |
| --- | --- |
| `.ashfox` project | Single archive with canonical document and texture bytes |
| Minecraft Java | Validator, exporter, golden fixture |
| Minecraft Bedrock | Geometry and animation exporter with fixtures |
| GeckoLib 5 | Geometry, animation, layout, and fixtures |
| glTF/GLB | Scene compiler, binary writer, GLB packer, validator tests |
| Self-contained GLB | Image buffer-view embedding implemented |

## Track-specific behavior

- Web Studio has no plugin reload or Blockbench settings.
- Web revision IDs do not synchronize with Blockbench sessions.
- Web uses stable IDs even when a target exports names.
- Blockbench MCP keeps compatibility selectors and responses.
- Web UX is optimized for agent-authored review, not Blockbench panel parity.
