# Texture + UV Spec (Summary)

Core rules:
1) Per-face UVs only (managed internally; no manual UV tools).
2) paint_faces maps into each face rect; mapping controls stretch/tile.
3) UV overlaps are errors.
4) UV scale mismatch is an error.
5) Per-face UV density is controlled by project `uvPixelsPerBlock` (default 16).

Workflow:
- assign_texture
- paint_faces
- internal auto-UV runs automatically on cube add/scale

Notes:
- UV tools are internal and not exposed over MCP.
- `ensure_project.uvPixelsPerBlock` sets face density; reused projects infer a median from existing UVs.
- validate reports uv_overlap/uv_scale_mismatch; mutation guards return invalid_state on overlap/scale/usage mismatch.
- internal auto-UV may raise texture resolution for atlas capacity; face size comes from `uvPixelsPerBlock`.
- If you provide both cubeId and cubeName in target, both must match. Use one for broader matching.
- `paint_faces` is strict single-write: one target (`cubeId`/`cubeName` + `face`) and one op.
- `paint_faces` defaults to `coordSpace="face"` and auto-fits source size to target face UV when `width/height` is omitted.
- `coordSpace="texture"` requires explicit `width/height` matching texture size.
- `background` is not part of the `paint_faces` payload.

See full spec in docs/texture-uv-spec.md.
