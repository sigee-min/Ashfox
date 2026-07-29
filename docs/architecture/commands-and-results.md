# Commands and Results

Status: **Implemented**

## Purpose

The Web UI and Agent Command Port use one canonical mutation contract.
MCP is not an Ashfox workbench command source; it belongs to the independent
Blockbench compatibility track.

## Command source

```ts
type CommandSource = 'web' | 'agent' | 'import' | 'system';
```

- `web`: a direct workbench interaction;
- `agent`: a validated batch submitted through the Agent Command Port;
- `import`: project or asset ingestion;
- `system`: recovery, migration, or deterministic maintenance.

Transport and host names cannot appear in this type.

## Command envelope

```ts
interface CommandEnvelope<TName extends string, TPayload> {
  commandId: string;
  idempotencyKey: string;
  projectId: string;
  actorId: string;
  source: CommandSource;
  baseRevision: string;
  name: TName;
  payload: TPayload;
  traceId?: string;
}
```

Rules:

- mutations identify their base revision;
- repeated idempotency keys return the same committed result;
- stale or invalid batches apply nothing;
- payloads use stable IDs;
- commands express domain intent, not DOM events;
- one gesture may preview locally and commits one bounded command.

## Current command families

- project rename and target selection;
- scene create, delete, transform, visibility, duplicate, mirror, repeat,
  align, pivot, and reparent;
- cube UV fitting and material assignment;
- deterministic texture-preview color and Minecraft UV atlas generation;
- animation clip and channel upsert, phase, mirror, loop closure, and delete.

The registry contains 25 runtime-defined commands. Each definition owns its
input schema, validator, executor, effects, and tests.

## Command receipt

Every successful mutation returns one canonical `CommandReceipt` containing:

- command and project IDs;
- source and actor;
- before and after revisions;
- created, changed, and removed entity IDs;
- invalidated presentation areas;
- validation findings;
- a short human-readable summary.

The UI uses effects to focus affected entities. Receipts never contain React,
Three.js, file-handle, or Blockbench objects.

## Atomic failure

A failed command or batch:

- leaves the current document unchanged;
- returns a stable error code and correction hint;
- identifies the current revision when a conflict occurred;
- may return findings but cannot partially commit entities.

## Direct batch boundary

The AI path submits the same canonical engine commands in one bounded
`CommandBatch`:

- the batch carries the base revision and coarse canonical operations;
- the browser binds project, actor, and source metadata instead of repeating it
  in every prompt;
- the engine validates the full batch before applying it;
- commit is atomic and returns one compact receipt.

The agent protocol contains bounded inspection, a command batch, and a receipt.
See
[AI-native low-poly authoring](ai-native-authoring.md) and
[Agent Command Port](agent-command-port.md).

## Command definition authority

Every command has one runtime definition containing its name, short purpose,
input schema, validator, executor, and affected-area metadata. TypeScript
payloads, React actions, schema inspection, and batch execution use that
definition.

The public command surface favors coarse deterministic operations such as
multi-node transform, duplicate, mirror, align, UV fit, and multi-key animation
edits. These shared product commands replace repetitive field mutations.

## Web execution boundary

`historyReducer.ts` submits canonical `CommandBatch` values to the
`engine-core` executor, stamps one local revision, and stores the resulting
receipt. IndexedDB stores the active project record.

Undo and redo create new local revisions and receipts. They do not rewind
browser presentation state independently of the document.

## Blockbench compatibility

`packages/blockbench-contracts` owns `ToolResponse<T>`, tool payloads, MCP
schemas, and name-based selectors for the Blockbench track.

Format parity is verified with shared fixtures. Import converts a Blockbench
snapshot into a new `ProjectDocument` at the file boundary.
