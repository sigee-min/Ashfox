# Ashfox Monorepo Target (Incremental)

This document defines the target structure while preserving current behavior.

## Current Executable Boundaries

- Plugin bundle entry: `apps/plugin-desktop/src/index.ts`
- Headless/sidecar entry: `apps/mcp-headless/src/index.ts`
- Shared implementation: `src/`
- Docs app: `apps/docs/`

## Target Layout

```text
apps/
  plugin-desktop/      # Blockbench plugin runtime shell
  mcp-headless/        # UI-less MCP runtime shell
  docs/                # User-facing documentation site
packages/
  contracts/           # MCP tool schemas + contract types (planned)
  conformance/         # Protocol/tool conformance tests (planned)
src/
  ...                  # Existing implementation (migration source)
```

## Migration Rules

1. Runtime compatibility first.
2. Move boundaries before internals.
3. Keep a single source of truth for schemas.
4. Add conformance tests before changing protocol behavior.

## Next Refactor Steps

1. Extract tool contract types from `src/types/*` into `packages/contracts`.
2. Move MCP tool schema definitions from `src/shared/mcpSchemas` into `packages/contracts`.
3. Move protocol-level tests from `scripts/tests` into `packages/conformance`.
4. Keep `src/` as compatibility layer until all imports are switched.
