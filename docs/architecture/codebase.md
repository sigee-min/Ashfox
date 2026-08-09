# Codebase map

ashfox has one authored asset authority: the confirmed Intent Program. The
program is parsed, normalized, compiled, and validated into a canonical project
as one atomic operation. Geometry, textures, hierarchy, rig, animation, and
delivery artifacts are derived from it.

## Runtime paths

Canonical asset creation follows this path:

~~~text
agent proposal
  → Intent Program parse and materialization check
  → user confirmation
  → compiler lowering
  → canonical document validation and readiness
  → atomic reducer commit
~~~

Artifact delivery is separate:

~~~text
canonical project
  → export adapter input
  → adapter compatibility validation
  → transient adapter view
  → target bytes + adaptation receipt
  → browser file materialization
~~~

The adapter input is not part of the canonical document. A target, game
version, namespace, or model path must never recompile, rewrite, or persist in
the Intent Program, canonical texture state, hierarchy, rig, or animation.

## Ownership

| Decision | Authority |
| --- | --- |
| Intent language and normalization | packages/engine-core/src/project/intentProgram.ts |
| Compiler lowering | packages/engine-core/src/compiler/intentProgram/ |
| Canonical project shape | packages/engine-core/src/model.ts |
| Exact source-to-output validation | packages/engine-core/src/validation/documentValidator.ts |
| Derived geometry and surface ownership | packages/engine-core/src/modeling/ |
| Derived pixel surfaces | packages/engine-core/src/textures/ |
| Structural and production findings | packages/engine-core/src/authoring/ and productionReadiness/ |
| Export adapter normalization | packages/engine-core/src/export/adapter.ts |
| Target compatibility and bytes | packages/engine-core/src/export/ |
| Workbench confirmation and export UI | apps/web/src/features/workbench/ and features/files/ |
| Agent proposal and review transport | apps/web/src/features/agent/ |

The public engine facade exposes the compiler and export adapter flows. Target
builders are implementation details; callers must not construct a delivery
artifact directly from an unchecked document.

## Dependency direction

~~~text
intent source
  ↓
parser and compiler
  ↓
canonical model, derived geometry, textures, and validation
  ↓
readiness and export adapters
  ↓
web confirmation, review, and file delivery
~~~

- Engine code does not import React, browser APIs, persistence, or workbench
  features.
- The agent surface can propose source and present review results; it cannot
  mutate canonical derived state.
- The workbench confirms source before compiler materialization.
- Persistence rejects a materialized document that does not exactly reproduce
  from its confirmed source.
- Export adapters operate on a transient view and never mutate canonical data.
- Relative TypeScript dependency cycles are rejected by the architecture gate.

## Make a change

### Extend the Intent Program

1. Add a closed source declaration and diagnostic in project/intentProgram.
2. Lower it in compiler/intentProgram to canonical derived output.
3. Make document validation reproduce and compare the output exactly.
4. Add readiness and atomicity coverage for both accepted and rejected source.

Do not add a raw geometry, material, hierarchy, or animation command as an
alternate asset-authoring path.

### Add a structural rule

1. Put the rule beside the derived authority it evaluates.
2. Return a stable code, canonical path, and actionable source-level cause.
3. Compose it through document validation and production readiness.
4. Reject a compiler result atomically when the rule makes it unusable.

### Add an export adapter

1. Define adapter input and supported compatibility options.
2. Adapt a transient project view without modifying the source document.
3. Validate unsupported semantics at the adapter boundary.
4. Build the target files through the shared export envelope.
5. Record every conversion or omission in the receipt.

### Add workbench behavior

1. Keep project-name, confirmation, and export-adapter state in their owning
   controller or hook.
2. Route canonical asset changes through proposal, confirmation, and compiler
   execution only.
3. Keep presentation components responsible for user events and rendering.

## Structural guardrails

npm run quality:check enforces:

- source files at or below 600 lines;
- functions at or below 200 lines;
- no relative TypeScript dependency cycles;
- engine, web, and product-boundary rules.

Run npm test, npm run build:public, and npm run quality:check before publishing
changes.
