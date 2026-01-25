# bbmcp 배포 기준 (Release Gate) v1

This document defines the bbmcp release bar. A change is "deployable" only if it passes all MUST gates below.

## One Command

- Local / CI gate: `npm run quality`

## MUST Gates (CI hard fail)

### Gate A: Type Safety

- `npm run typecheck`
- Threshold: TypeScript errors = 0

### Gate B: Tests (including contracts)

- `npm test`
- Threshold: exit code 0
- Contracts are enforced via tests (examples):
  - Tool schema registry hash/count is stable unless intentionally changed.
  - Router ToolResponse -> MCP call result formatting stays stable.

### Gate C: Build

- `npm run build`
- Threshold: exit code 0
- Output bundles must be produced (esbuild):
  - `dist/bbmcp.js`, `dist/bbmcp.js.map`
  - `dist/bbmcp-sidecar.js`, `dist/bbmcp-sidecar.js.map`

### Gate D: Static Quality Checks

- `npm run quality:check`
- Threshold: 0 violations

This gate is intentionally lightweight and enforced via a Node script (no heavy toolchain).

#### D1. Forbidden patterns (default)

- `@ts-ignore`, `@ts-expect-error`
- `as any`
- `as unknown as`
- `console.*` in `src/**` (allowed only in `src/logging.ts`)
- `catch {}` (catch blocks must bind an error: `catch (err) { ... }`)
- TODO/FIXME comments in `src/**`

#### D2. DOM access safety

- Bare `document` / `window` identifiers are forbidden.
- Allowed forms:
  - `globalThis.document` / `globalThis.window` (must be guarded)
  - `readGlobals().document` / `readBlockbenchGlobals().document` (adapter boundary)

Additional rule:

- `src/proxy/**` must not access `globalThis.document` directly. Proxy must use `DomPort`.

#### D3. Exceptions policy (phased)

- Phase 1 (current): allow `throw` in adapters and specific runtime boundaries.
- Phase 2: disallow `throw` in `src/proxy/**`.
- Phase 3: target `throw` = 0 in `src/domain/**` (prefer Result-based errors).

### Gate E: Version Consistency

- `package.json#version` must match `src/config.ts#PLUGIN_VERSION`.

### Gate F: Dependency Vulnerabilities

- `npm run quality:audit`
- Threshold: `npm audit --omit=dev --audit-level=high` must return exit code 0

### Gate G: Coverage Regression (baseline)

- `npm run test:cov` must generate `coverage/coverage-summary.json`
- `npm run quality:coverage` compares totals against `docs/coverage-baseline.json`
- Threshold:
  - no regression vs baseline (lines/statements/functions/branches)
  - AND must meet absolute floors (release bar)

Current absolute floors (v1):

- lines >= 65%
- statements >= 65%
- functions >= 42%
- branches >= 50%

Ratchet policy (strict):

- Floors only move up.
- Increase floors by 1-2 percentage points periodically (e.g., every 2 weeks) or when adding a new feature area.

Baseline update (intentional only):

```
npm run test:cov
node scripts/quality/coverage.js --update-baseline
```

## SHOULD Gates (Phase 2+ hardening)

- `npm audit --omit=dev --audit-level=high` must have 0 vulnerabilities (high+)
- Enforce no TODO/FIXME in `src/**` (except tool help strings / docs)

## Changing Tool Surface

If MCP tool schemas/tool registry change intentionally:

- Update `TOOL_SCHEMA_VERSION` (date string)
- Update `TOOL_REGISTRY_HASH` (contract test will force this)
- Update docs/examples for the changed tool(s)

## Notes

- The goal of this standard is strictness + low operational burden.
- Prefer small, mechanical refactors that reduce footguns (throw in Undo blocks, console spam, unsafe globals).
