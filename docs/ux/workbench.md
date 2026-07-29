# Web Workbench UX

Status: **Proposed**

## Experience goal

The workbench gives creators a complete visual understanding of the canonical project while making AI IDE operations easy to review, correct, and continue.

It is desktop-first and designed to run in the AI IDE in-app browser as well as a regular browser.

## Primary route structure

- `/projects`: project library and creation.
- `/projects/:projectId`: authoring workbench.
- `/projects/:projectId/history`: revision and command history.
- `/projects/:projectId/exports`: export jobs and artifacts.

## Workbench layout

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Project / local save / target                         Preview / Revision   │
├────────────────────────────────────────────────────────────────────────────┤
│ [Scene]                                                        [Inspect]   │
│                                                                            │
│                           3D Viewport                                      │
│                                                                            │
│ Scene and inspector open as temporary overlays above the viewport.         │
├────────────────────────────────────────────────────────────────────────────┤
│ Animate | Activity             Timeline or persisted command receipts      │
└────────────────────────────────────────────────────────────────────────────┘
```

The viewport is the permanent workspace. Scene and inspector are closed by
default and toggle from fixed top-corner buttons; neither consumes persistent
horizontal space. The top bar holds global status and tools, while animation and
command activity share the compact bottom workspace.

At narrow widths the 3D canvas always takes the complete remaining workspace.
The renderer observes its container and updates both pixel size and camera
aspect. Tool groups scroll inside their own strip, overlays fit the available
width, and the bottom workspace changes from columns to stacked rows rather
than forcing a minimum page width.

## AI IDE activity

The Agent Command Port submits one batch automatically. A read-only viewport
status shows `AI IDE Connected` or `AI IDE Working`. After commit, the viewport
focuses affected entities and Activity shows the receipt and Undo action.
Validation surfaces show failures.

The workbench root exposes command-port status and revision as semantic state.
This gives AI IDE a discoverable entry point without changing the viewport
layout.

## Deterministic tools

Small, exact operations remain visible. They are placed where their result is
immediately understandable:

- the top toolbar owns add, duplicate, mirror, repeat, undo, redo, validate,
  and export;
- the Scene overlay owns reparent, align, distribute, pivot, and delete;
- the Inspector owns numeric transforms and pivot;
- the top toolbar exposes deterministic Minecraft UV atlas and shade generation;
- the animation workspace owns clip, multi-key, mirrored-key, phase, and loop
  actions.

Only actions valid for the current selection and target are enabled. Each
action has a stable accessible name and canonical command ID. React and AI IDE
submit the same command definition.

Creative judgment stays with AI IDE and the creator.

## Global header

The header shows:

- project name and format profile;
- saved, saving, offline, or conflicted state;
- current revision in a copyable form;
- validation error and warning counts;
- preview and export actions;
- undo and redo actions.

The current revision remains present in saved-state and activity DOM even when
the compact header hides its label.

## Scene panel

The scene overlay provides:

- hierarchical bones and child objects;
- type icons and visibility toggles;
- search by name, ID, or tag;
- multi-selection;
- create, duplicate, rename, reparent, and delete actions;
- texture and animation asset sections;
- badges for validation findings and recent changes.

Drag reparenting has an equivalent menu or keyboard action. No required operation is drag-only.

## Viewport

The viewport supports:

- orbit, pan, zoom, front, side, top, and isometric views;
- click and box selection;
- object, face, pivot, and bone modes;
- move, rotate, and scale gizmos;
- grid and snapping controls;
- texture, wireframe, normal, UV, and validation overlays;
- isolated selection and visibility control;
- animation playback and frame stepping.

Selection is mirrored in the scene panel and inspector. The current selection and transform values remain available as semantic DOM text and controls outside the canvas.

## Inspector

The inspector overlay uses explicit numeric inputs with units and constraints.

Sections depend on selection:

- Common: name, ID, visibility, parent, tags.
- Transform: position, rotation, scale, pivot.
- Cube: bounds, inflate, mirror, face texture, UV.
- Mesh: vertices, faces, UV policy, material assignment.
- Bone: hierarchy and pivot.
- Texture: dimensions, sampling, render mode, animation metadata.
- Animation: duration, FPS, loop, channels, interpolation.

An input draft is local until committed. Multi-field edits should commit as one command where possible.

## Texture and UV workflow

`Generate Minecraft texture` applies one canonical command to all textured cube
faces. The result is visible immediately in the permanent 3D viewport, appears
as one Activity receipt, and can be reverted with Undo. AI IDE can invoke the
same command through the Agent Command Port without a product-side JSON panel.

## Animation workspace

Animation mode shows:

- clip selector, duration, FPS, and loop;
- play, pause, frame step, and time input;
- channels grouped by target node;
- keyframe markers and interpolation;
- trigger tracks for sound, particle, and timeline events;
- viewport pose at the selected time.

Creating or moving keys commits stable keyframe IDs. Playback itself is browser-local presentation state.

## Activity and diff panel

Every command creates a receipt containing:

- actor and source, such as user, AI IDE, import, or system;
- readable action summary;
- completion state and duration;
- before and after revisions;
- created, changed, and removed entities;
- findings introduced or resolved;
- preview or export artifacts;
- undo action when valid.

Selecting a changed entity focuses it in the scene and viewport. Removed entities remain inspectable in the diff view without returning to project state.

## Validation UX

Findings appear in:

- header counts;
- scene badges;
- viewport overlays;
- inspector messages;
- a filterable findings list.

Selecting a finding focuses its entity, face, texture, channel, or document path. Suggested fixes are displayed as reviewable commands.

Export is blocked only by target-specific error findings. Warnings require acknowledgement but do not silently prevent export.

## Conflict and recovery UX

When a command returns a revision mismatch:

1. pending local input remains visible;
2. the latest revision and intervening changes are loaded;
3. the UI identifies conflicting fields or entities;
4. the user can discard, reapply, or manually merge the draft;
5. a reapply submits a new command against the latest revision.

The UI never silently overwrites a newer project revision.

## AI IDE browser operability

To make the workbench reliable in the in-app browser:

- all buttons, fields, tabs, and tree rows have accessible names;
- important controls are standard DOM elements;
- entity rows expose stable `data-ashfox-entity-id` attributes;
- command receipts expose `data-ashfox-command-id`;
- loading, error, empty, and conflict states have explicit text;
- canvas-only hover state is mirrored in a DOM status region;
- keyboard alternatives exist for pointer-only interactions;
- destructive actions identify the exact project or entities in the confirmation;
- test selectors describe domain identity rather than layout position.

The in-app browser is sufficient for visual inspection, selection, numeric
editing, playback, and command review. Precise AI-authored mutations enter
through the same command contract and surface in the same activity receipts;
the browser does not maintain a separate project model.

The page-local surface is defined in
[Agent Command Port](../architecture/agent-command-port.md). Port status,
revision, and receipts expose stable semantic DOM attributes and accessible
names.

## Empty and loading states

- Empty project: explain how to create a bone, cube, mesh, or ask AI IDE.
- Empty texture set: offer create, import, or generate actions.
- Empty animation set: offer clip creation and a short explanation.
- Loading project: retain the project shell and display the target project ID.
- Failed artifact: keep the command receipt and provide a retry action.
- Offline: allow inspection of the last committed state but disable mutations.

## Accessibility baseline

- Keyboard access to all non-spatial commands.
- Visible focus and selected states.
- Text alternatives for color and validation-only indicators.
- Sufficient contrast in overlays and panels.
- Reduced-motion mode for turntable previews and transitions.
- Numeric inputs usable without drag gestures.
