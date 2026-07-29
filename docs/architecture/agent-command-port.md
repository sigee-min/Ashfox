# Agent Command Port

Status: **Implemented**

## Purpose

The open Ashfox page gives AI IDE one local, automatic command port:

```text
inspect bounded state
→ submit one canonical batch
→ receive the canonical reducer outcome
```

The user reviews normal modeling changes through the live viewport, Activity
receipt, and Undo.

## Discovery

The page advertises the
[agent manifest](https://github.com/sigee-min/ashfox/blob/main/apps/web/agent-manifest.json)
at `/agent-manifest.json` through one machine-readable
`alternate` link and the `data-ashfox-agent-manifest` document attribute. The
static manifest defines both supported transports:

- direct page calls through `window.ashfox`;
- selector-based browser automation through the hidden DOM bridge.

The same manifest publishes stable selectors for project creation, archive
input, save, export, capture, and one shared artifact handoff. These selectors address
normal product controls with accessible names; they do not introduce a JSON
console or a second mutation path.

The manifest is part of the CDN build and requires no server, vendor extension,
or Ashfox-specific IDE integration. An AI IDE still needs access to the open
browser tab or to its own browser runtime.

The manifest is also the machine authority for file-operation state and
artifact delivery. Ashfox workbench retains one prepared artifact behind a persistent
download anchor. It directs the AI IDE host to use a requested
workspace-relative directory or `artifacts/`, verify the result, and report the
actual relative path. When a workspace write cannot be verified, the host
reports the artifact as ready for browser download instead.

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

- the canonical protocol manifest and command-schema request shape;
- project ID, name, revision, and target;
- selected entity;
- node, texture, and clip counts;
- names of deterministic commands valid for the current context;
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

Browser tools without page-JavaScript evaluation submit the same request by
setting the manifest-declared input value and dispatching its `input` event.
The result meta attribute returns the matching request ID and the exact port
result. This transport contains no mutation implementation.

## Atomic termination

- invalid input is rejected before reducer submission;
- a stale base revision returns the reducer's current revision;
- repeated batch IDs reuse the first terminal result and submit once;
- a batch ID reused for different content is invalid;
- cancellation, timeout, and delivery exceptions return terminal failures;
- every execution path returns the port status to `connected`;
- rejected batches leave the document, Activity, and Undo history unchanged.

## Product surface

Applied work is reviewed in existing product surfaces:

- the viewport renders the committed revision and focuses the first affected
  entity;
- Activity shows the canonical receipt;
- validation shows blocking findings;
- Undo reverses the committed batch.

The workbench root exposes `data-agent-command-port`, the active revision, and
the terminal file-operation phase as semantic state.

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

- AI IDE discovers `inspect` and `run` from the open page;
- the production build publishes the advertised agent manifest;
- one submitted batch is applied automatically;
- reducer rejection and receipt data are returned without reconstruction;
- deterministic operations are discoverable through bounded inspection;
- every committed batch renders, creates one Activity receipt, and is
  undoable;
- every terminal path clears working state;
- Blockbench MCP remains independent.
