# Codebase map

ashfox has one authored asset authority: the AI-compiled Intent Program. The
AI authors and diagnoses the source, stages it, decides whether to revise or
compile, and reviews the result. The compiler reads, resolves, plans,
materializes, and validates one canonical project as an atomic operation. Geometry, textures,
hierarchy, rig, animation, and delivery artifacts are derived from it.

## Runtime paths

Canonical asset creation follows this path:

~~~text
human prompt
  → agent-authored complete Intent Program
  → V1 parse, resolution, capability validation, and immutable planning
  → staged candidate materialization + SHA-256 compilation receipt
  → agent decision: revise or compile
  → receipt-checked lowering and canonical materialization
  → canonical validation, readiness, and output-digest verification
  → atomic reducer commit
  → agent-owned visual review
~~~

The workbench may project the staged candidate automatically while the agent
decides. That projection is ephemeral visual feedback only: it is not persisted
as a second asset, exposed as an editing surface, or governed by a human
compilation decision.

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
| V1 language, Semantic AST, and constraint resolution | [Intent Program 1](intent-program-v1.md) and packages/engine-core/src/project/program/ |
| Canonical Model IR planning and lowering | packages/engine-core/src/compiler/program/ |
| Source-only `.ashfox` open and save boundary | packages/engine-core/src/projectFile/ |
| Source/compiler/output provenance | packages/engine-core/src/provenance/program/ |
| Canonical project shape | packages/engine-core/src/model/ (`model.ts` is the public compatibility facade) |
| Exact source-to-output validation | packages/engine-core/src/validation/project/authority.ts |
| Derived geometry and surface ownership | packages/engine-core/src/modeling/ |
| Derived pixel surfaces | packages/engine-core/src/textures/ |
| Surface appearance language, synthesis, and raster provenance | [Surface Appearance V1](surface-appearance-v1.md), packages/engine-core/src/project/appearance, and packages/engine-core/src/textures/appearance |
| Supported-surface silhouette and planform lowering | [Surface Shape V1](surface-shape-v1.md), packages/engine-core/src/project/program/shape.ts, and packages/engine-core/src/compiler/program/lower/surface/ |
| Structural and production findings | packages/engine-core/src/authoring/ and productionReadiness/ |
| Export adapter normalization | packages/engine-core/src/export/adapter/ |
| Target compatibility and bytes | packages/engine-core/src/export/ |
| Workbench observation, project, capture, and export UI | apps/web/src/features/workbench/ and features/files/ |
| Agent proposal, compilation decision, and review transport | apps/web/src/features/agent/ |
| Closed visual-review receipt and ledger | apps/web/src/application/review/ |
| Blockbench HTTP protocol and connection lifetime | packages/blockbench-runtime/src/transport/mcp/netProtocol.ts and netConnection.ts |
| Blockbench public project contract | packages/blockbench-contracts/src/types/project/ |

The public engine facade exposes the compiler and export adapter flows. Target
builders are implementation details; callers must not construct a delivery
artifact directly from an unchecked document.

Intent Program boundaries are interface-first:

- readers return a closed, immutable Semantic AST and never import generation;
- constraint resolution owns references, typed relation matrices, capacity,
  and source diagnostics;
- the planner returns an immutable coordinate-free Canonical Model IR and
  geometry never rereads source declarations;
- lowerers receive a mutation port whose indexes and collections remain
  private to the implementation;
- materialization consumes a compiler plan and returns one atomic result;
- web components receive presentation view-models and emit only project, view,
  playback, capture, and delivery actions; they never interpret provenance or
  decide compilation themselves;
- canonical output and presentation view-model interfaces expose readonly
  fields and collections; mutable form drafts stay inside their owning
  controller and never become authority snapshots;
- persisted review data passes through a closed receipt reader before immutable
  ledger operations can see it;
- Blockbench request parsing, per-socket state, and server lifetime are separate
  boundaries, so transport state never leaks into MCP routing or domain code.

## Dependency direction

~~~text
intent source
  ↓
closed reader and Semantic AST
  ↓
constraint resolution and canonical coordinate-free Model IR
  ↓
geometry/rig/motion lowerers and canonical materializer
  ↓
receipt verification, readiness, and export adapters
  ↓
web observation, playback, capture, and file delivery
~~~

Global symmetry and local pair topology are separate authorities. A bilateral
intent owns one project-wide plane. An asymmetric intent has no centered slots,
but may carry one compiler-owned local plane when the source explicitly names
paired modules, surfaces, or eyes; quality checks apply that plane only to
paired slots.

- Engine code does not import React, browser APIs, persistence, or workbench
  features.
- The agent surface can propose a complete source, run only the exact staged
  compilation operation returned by inspection, and present review results;
  it cannot mutate canonical derived state directly.
- The workbench does not expose human semantic editing or a compilation
  decision. It automatically presents ephemeral candidate feedback while the
  agent owns the staged decision.
- `.ashfox` and durable browser persistence store Intent Program 1 source
  only. Loading parses and materializes a fresh canonical document atomically;
  any compiled browser cache is discardable and keyed by source provenance.
- Export adapters operate on a transient view and never mutate canonical data.
- Relative and workspace-alias TypeScript dependency cycles are rejected by
  the architecture gate.
- Project and authoring contracts cannot depend on compiler, command, or
  validation orchestration; compiler code cannot depend on commands or
  document validation.
- Blockbench domain and adapter layers cannot depend upward on use cases,
  transport, or plugin lifecycle code.
- Web application and rendering modules cannot depend on feature controllers.

## Make a change

### Extend the Intent Program

1. Add a closed source declaration and diagnostic in project/program.
2. Add it to the V1 language specification and immutable compilation plan.
3. Lower only the planned construct to canonical derived output.
4. Make document validation reproduce and compare the output digest exactly.
5. Add readiness, source-span, permutation, frame, and atomicity coverage for
   both accepted and rejected source.

Appearance changes must additionally follow the closed semantic language,
object-space synthesis, seed independence, and raw-raster provenance gates in
[Surface Appearance V1](surface-appearance-v1.md). Do not expose UVs,
procedural noise parameters, or derived pixel edits as an alternate authoring
surface.

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

1. Keep project, camera, environment, playback, capture, and export-adapter
   state in their owning controller or hook.
2. Route canonical asset changes through Agent proposal, Agent decision, and
   compiler execution only; do not add a human semantic mutation path.
3. Keep presentation components responsible for passive status, viewport
   rendering, and the narrow human delivery controls.

## Structural guardrails

npm run quality:check enforces:

- every TypeScript source root under `packages/*/src` and `apps/*/src` is
  included, rather than a hand-picked engine/web subset;
- source files at or below 600 lines, with new files capped at 500 lines and
  existing files above 500 prevented from growing beyond the committed
  `scripts/quality/source-size-baseline.json` ratchet; each baseline must equal
  the current line count, so every reduction is captured immediately, and the
  value must never increase or reappear relative to its full Git history;
- functions at or below 200 lines;
- implementation, contract, and test files grouped by owner: contracts use
  `owner/contract.ts`; tests live below a manifest-declared workspace owner,
  use one lowercase word in a `.test.ts` file, keep that stem at or below 18
  characters, and never repeat the owner prefix; test fixtures, runners, and
  support modules use the same lowercase one-word stem rule;
- recursively discovered tests execute in stable code-unit order, and an empty
  workspace suite is a hard failure;
- no explicit `any` or `as unknown as`/`as any as` type escape in source;
- no relative or workspace-alias TypeScript dependency cycles;
- every cross-workspace import is declared in its package manifest;
- valid project → compiler → command/validation dependency direction;
- engine, web, and product-boundary rules.

The release coverage baseline currently measures
`@ashfox/blockbench-runtime` only. Engine, web, and site tests run in the
release workflow but do not yet contribute to that coverage percentage; the
gate and its output are deliberately named for the measured workspace.

The size-history check requires a non-shallow Git checkout. CI fetches full
history; a shallow local clone must fetch its history before running the
architecture gate.

Run npm test, npm run build:public, and npm run quality:check before publishing
changes.
