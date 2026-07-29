# Web State Management

Status: **Implemented**

## Authorities

- `historyReducer.present` is the only writable project state.
- canonical commands are the only project mutation path;
- IndexedDB stores revisioned snapshots and never overwrites a newer revision;
- project texture bytes persist with their document snapshot;
- Three.js, form drafts, overlays, playback, and file operations are
  presentation state.

Persistence may hydrate the initial session. A file opened or dropped by the
user starts a new authoritative project generation, including when its project
ID matches the current project. Existing local data may advance the imported
document's local revision but cannot replace its content.

The file boundary accepts only a self-contained `.ashfox` archive. Open and
drop validate the complete document and texture set atomically. Save
materializes current procedural rasters or retained imported bytes into the
same archive format.

## Async operation rule

Every async UI operation has an identity and a terminal result:

```ts
type OperationPhase =
  | 'running'
  | 'succeeded'
  | 'cancelled'
  | 'failed';
```

The current operation ID owns completion. Older completion events are ignored.
Cancellation is a normal terminal state, not an exception or an unresolved
promise. File selection, parsing, download preparation, and export share one
exclusive controller.

## Persistence rule

Persistence work is scoped by project ID and project generation.

- project changes invalidate older load and save callbacks;
- an initial restore cannot overwrite edits made while it was loading;
- compare-and-write occurs in one IndexedDB transaction;
- stale and equal-revision divergent writes are rejected;
- external revisions apply only when newer than the active revision;
- a conflicting authoritative import is rebased and retried without changing
  its content.

## UI invariants

- one viewport overlay is active: Scene, Inspect, or none;
- selected node and active clip IDs are reconciled after every document
  replacement;
- missing clips stop playback and reset the playhead;
- numeric fields keep local draft text and commit once on blur or Enter;
- shortcuts do not run while an interactive control owns focus;
- the Agent Command Port returns the reducer's actual batch outcome.

## Test boundary

Pure reducers and the Agent Command Port have direct Web state tests. Browser
QA covers file-picker cancellation, retry, export, render updates, status, and
draft-input cancellation.
