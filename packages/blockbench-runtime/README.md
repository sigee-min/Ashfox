# @ashfox/blockbench-runtime

Blockbench-only execution runtime.

Owns the editor adapters, project session, MCP transport, plugin lifecycle, and
sidecar communication used by the optional compatibility product.

Forbidden consumers:

- `apps/web`
- `packages/engine-core`
