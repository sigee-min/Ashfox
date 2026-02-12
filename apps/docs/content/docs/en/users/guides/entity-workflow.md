---
title: "Entity Workflow"
description: "End-to-end guide for stable entity asset production."
summary: "End-to-end guide for stable entity asset production."
---

# Entity Workflow

This guide describes a full entity production loop where rig conventions, animation intent, and export expectations stay aligned.

Use this flow when the deliverable is an animated entity asset, not an isolated model fragment. The objective is to avoid late-stage surprises by validating each stage in order.

## Recommended sequence

1. Start the project with `ensure_project`.
2. Build hierarchy and geometry with `add_bone` and `add_cube`.
3. Attach and paint textures with `assign_texture` and `paint_faces`.
4. Create clips and timeline data with `create_animation_clip`, `set_frame_pose`, and optional trigger keys.
5. Run `render_preview` and `validate` before final export.

The sequence matters. If you animate before geometry and texture intent is stable, retiming and repainting costs rise quickly.

## Authoring notes

- UV behavior is handled internally, including auto-UV and reprojection during geometry changes.
- `uvPixelsPerBlock` controls the base density and should be chosen early for consistency.
- Pose and trigger data are authored incrementally, one frame or one trigger key at a time.

When used as a pipeline, this workflow keeps authoring, review, and export behavior predictable for both human and automated clients.
