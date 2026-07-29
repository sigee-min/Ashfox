# Authoring and Review

Ashfox gives one AI IDE deterministic low-poly modeling, texturing, and
animation operations. The most reliable workflow alternates one meaningful
edit with one bounded viewport review.

## Start with the whole asset

Describe the result before listing individual parts:

```text
Build an arcane field tractor with a readable cab, large rear wheels,
an articulated drivetrain, and a slow mechanical idle.
```

This gives the first batch enough context to establish hierarchy, silhouette,
materials, and animation intent together.

## Refine one visible problem

Follow-up prompts should identify the evidence and the desired change:

```text
The tractor reads too small in the current camera.
Reframe it to fill the viewport without changing model scale.
```

```text
The kirin eyes disappear at three-quarter view.
Raise the eye placement and preserve a clear forward gaze.
```

Do not ask the agent to restate the project or dump raw JSON. It can inspect the
current revision, the affected entities, and one relevant command schema.

## Prefer deterministic tools

Use the product operation when the request is exact:

- align, mirror, repeat, reparent, and pivot for structure;
- numeric transforms for measured changes;
- Minecraft texture generation and UV atlas commands for consistent pixels;
- phase, mirror, and loop closure for animation;
- target validation before export.

Related edits belong in one atomic batch. Separate batches are useful only when
the rendered result can change the next decision.

## Review at the right scale

1. Check the full silhouette and camera framing.
2. Check high-information details such as eyes, face, wheels, or engines.
3. Play the selected clip and watch its loop boundary.
4. Read the latest Activity receipt.
5. Undo the batch when its direction is wrong; prompt a correction when it is
   close.

Stop when target validation has no blocking finding and another agent turn
cannot name a concrete visible improvement.
