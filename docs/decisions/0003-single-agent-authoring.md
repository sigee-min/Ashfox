# ADR-0003: Single-Agent Authoring

Status: **Accepted**

Date: 2026-07-28

## Context

One Codex agent authors the asset in the browser. Quality per token depends on
compact context, expressive deterministic tools, and selective visual
observation.

## Decision

- `ProjectDocument` is the project authority.
- The canonical command registry is the mutation authority.
- Web UI and Codex use the same deterministic commands.
- The Agent Command Port exposes `inspect` and `run`.
- Inspection is bounded to the current task.
- One batch performs one meaningful asset change.
- Local checks enforce integrity and target compatibility.
- The live viewport supplies visual evidence.
- A new Codex step runs only when new state or rendered evidence can change the
  next command.

## Consequences

- Project size does not determine the normal context size.
- Deterministic tools replace repetitive field edits.
- Visual judgment remains with Codex and the creator.
- Every change renders immediately and remains undoable.
