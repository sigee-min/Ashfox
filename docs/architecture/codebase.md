# Codebase map

ashfox keeps one authority for each kind of decision. A module may read an
authority or adapt its result, but it must not recreate the decision.

## The two runtime paths

Project changes follow one path:

```text
UI or agent request
  → command definition
  → executeCommandBatch
  → deterministic derivation
  → project validation
  → atomic reducer commit
```

Artifact delivery follows another:

```text
canonical project
  → production readiness
  → target validation
  → target compiler
  → bundle envelope + adaptation receipt
  → browser file materialization
```

Changing a delivery target never rewrites authored scene or animation data.
Target compilers convert or omit target-only semantics and report each change
in the adaptation receipt.

## Ownership

| Decision | Authority |
| --- | --- |
| Canonical project shape | `packages/engine-core/src/model.ts` |
| Project mutation | `packages/engine-core/src/commands/` |
| Derived textures and geometry | `packages/engine-core/src/textures/` and `modeling/` |
| Structural findings | `packages/engine-core/src/validation/` |
| Delivery completeness | `packages/engine-core/src/productionReadiness/` |
| Supported target/version pairs | `packages/engine-core/src/export/compatibility/` |
| Target lowering and bundle metadata | `packages/engine-core/src/export/pipeline/` |
| Format-specific bytes | `packages/engine-core/src/export/targets/` |
| Project history and Undo | `apps/web/src/application/` |
| Workbench composition | `apps/web/src/features/workbench/controller/` |
| Agent transport | `apps/web/src/features/agent/` |
| Browser file materialization | `apps/web/src/features/files/` |

The root files `validation.ts`, `productionReadiness.ts`, and the export facade
files are public entry points. Implementations live in the matching directory;
callers should not reconstruct their results.

## Dependency direction

```text
model
  ↑
domain algorithms
  ↑
commands and validation
  ↑
export pipeline
  ↑
web application adapters
  ↑
React composition
```

- Engine code does not import React, browser APIs, persistence, or workbench
  features.
- Web application and rendering layers do not import feature implementations.
- Agent and file adapters never mutate a `ProjectDocument` directly.
- Target exporters never alter the canonical source document.
- Relative TypeScript dependency cycles are rejected by the architecture gate.

## Make a change

### Add a project command

1. Add one definition under `commands/definitions/`.
2. Register it in the canonical command registry.
3. Express all document changes in its returned candidate document.
4. Test accepted, rejected, stale-revision, and atomic-batch behavior.

Do not add a second UI or agent mutation path.

### Add a validation rule

1. Put the rule in the validator matching its domain.
2. Return a stable code, path, entity IDs, and actionable fix.
3. Compose it through the document or target validator.
4. Test finding order as well as presence when order is user-visible.

### Add an export target

1. Register its supported version and capabilities in compatibility.
2. Implement target validation without changing the source project.
3. Compile target files under `export/targets/`.
4. Return the bundle through the shared pipeline envelope.
5. Record every safe conversion or omission in the adaptation receipt.

### Add workbench behavior

1. Keep state in the existing reducer or owning hook.
2. Put cross-feature wiring in a focused workbench controller.
3. Keep components responsible for rendering and user events.
4. Dispatch canonical commands for every project change.

## Structural guardrails

`npm run quality:check` enforces:

- source files at or below 600 lines;
- functions at or below 200 lines;
- no relative TypeScript dependency cycles;
- existing engine, web, and product boundary rules.

The limits are drift alarms, not substitutes for naming and cohesion. Split a
module by ownership before it approaches a limit; do not move unrelated code
into helper files merely to satisfy the count.

Run `npm test`, `npm run build:public`, and `npm run quality:check` before
publishing changes.
