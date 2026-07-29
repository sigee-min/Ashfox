# Agent Command Port

Status: **Implemented**

## Purpose

The open Ashfox page gives Codex one local, automatic command port:

```text
inspect bounded state
→ submit one canonical batch
→ receive the canonical reducer outcome
```

The user reviews normal modeling changes through the live viewport, Activity
receipt, and Undo.

## Page API

```ts
interface AgentCommandPortApi {
  inspect(request?: InspectRequest): InspectResult;
  run(batch: CommandBatch): Promise<RunResult>;
}

declare global {
  interface Window {
    ashfox: AgentCommandPortApi;
  }
}
```

`inspect()` without arguments returns only the compact current context:

- project ID, name, revision, and target;
- selected entity;
- node, texture, and clip counts;
- deterministic commands valid for the current context;
- one blocking validation path when present.

The default result is capped at 2 KB.

## Bounded inspection

```ts
type InspectRequest =
  | { kind: 'command'; name: CommandName }
  | { kind: 'entity'; ids: readonly string[] }
  | { kind: 'texture'; ids: readonly string[] }
  | { kind: 'clip'; ids: readonly string[] }
  | { kind: 'target' }
  | { kind: 'finding'; path: string };
```

- `command` returns one runtime command schema.
- entity, texture, and clip reads return only requested IDs.
- `target` returns active capabilities and numeric limits.
- `finding` returns one validation detail.

Detailed results are capped at 4 KB and ten IDs. References are not expanded
recursively.

## Automatic submission

`run()` accepts one atomic `CommandBatch`:

```ts
interface CommandBatch {
  batchId: string;
  baseRevision: string;
  operations: readonly {
    name: CommandName;
    payload: unknown;
  }[];
}
```

The port validates the envelope, enforces one active batch, forwards it to the
canonical command reducer, and returns that reducer's committed or rejected
outcome. It contains no project mutation implementation.

The page binds actor, source, and completion time. Registered canonical
commands execute immediately without a confirmation step.

## Atomic termination

- invalid input is rejected before reducer submission;
- a stale base revision returns the reducer's current revision;
- repeated batch IDs reuse the first terminal result and submit once;
- a batch ID reused for different content is invalid;
- cancellation, timeout, and delivery exceptions return terminal failures;
- every execution path returns the port status to `connected`;
- rejected batches leave the document, Activity, and Undo history unchanged.

## Product surface

The viewport shows a read-only `Codex Connected` or `Codex Working` status.
Applied work is reviewed in existing product surfaces:

- the viewport renders the committed revision and focuses the first affected
  entity;
- Activity shows the canonical receipt;
- validation shows blocking findings;
- Undo reverses the committed batch.

The workbench root exposes `data-agent-command-port` and the active revision as
semantic state.

## Authority

```text
window.ashfox.run
  → AgentCommandPort
  → historyReducer execute action
  → engine-core command registry
  → ProjectDocument + CommandReceipt
```

React actions enter the same reducer and command registry. There is no second
project mutation path.

```text
packages/engine-core/src/commands/
  definition.ts
  registry.ts
  executeBatch.ts

apps/web/src/features/agent/
  AgentCommandPort.ts
  inspect.ts
  parseCommandBatch.ts
  parseInspectRequest.ts
  useAgentCommandPort.ts
```

## Acceptance criteria

- Codex discovers `inspect` and `run` from the open page;
- one submitted batch is applied automatically;
- reducer rejection and receipt data are returned without reconstruction;
- deterministic operations are discoverable through bounded inspection;
- every committed batch renders, creates one Activity receipt, and is
  undoable;
- every terminal path clears working state;
- Blockbench MCP remains independent.
