# Texture + UV Spec (bbmcp)

This document defines the canonical rules for UVs and texturing in bbmcp.
UV tools are internal and not exposed over MCP.

## Core Invariants
1) Per-face UVs only (managed internally; no manual UV tools).
   - Blockbench stores per-face UVs; tools read/write them internally.
2) paint_faces maps into per-face rects (internal uvPaint).
   - mapping controls stretch/tile for how the source patch is applied.
3) No UV overlaps.
   - Overlapping UV rects are errors unless they are exactly the same rect.
4) Scale consistency is enforced.
   - UV size per face must match the expected size derived from model dimensions and `uvPolicy`.

## uvUsageId Contract
- Internal preflight computes `uvUsageId` (without texture filters for a stable id).
- Callers do not supply `uvUsageId`; it is used internally for guards and recovery.
- `uvUsageId` includes per-face UVs and per-texture width/height when available; resizing textures changes the id.
- When per-texture sizes are missing, `uvUsageId` also incorporates the project texture resolution, so resolution-only changes refresh the id.
- If UVs or texture sizes change, the internal preflight refreshes `uvUsageId`.

## Tool Responsibilities

### assign_texture
- Binds a texture to cubes/faces.
- Does not paint or change UVs.

### paint_faces
- Face-level painting via ops; UVs are resolved internally.
- Automatically binds the texture to target faces when needed.
- Uses internal uvPaint + uvUsageId guards.
- Blocks on overlap/scale mismatch when UVs are invalid.
- Returns recovery details when auto-UV fixes were applied.
- `paint_faces` is strict single-write by default.
  - Requires exactly one `target` (`cubeId` or `cubeName`, plus one `face`).
  - Requires exactly one `op`.
  - Default `coordSpace` is `face`. If `width/height` is omitted, source size auto-matches the target face UV size.
  - `coordSpace: "texture"` is opt-in. In this mode, `width` and `height` are required and must match texture size.
  - `background` is not part of the `paint_faces` payload.
 
### Internal UV pipeline (not exposed)
- Recomputes UV layout per texture + face size when needed.
- May grow texture resolution (bounded by maxTextureSize).
- If the atlas still overflows, bbmcp automatically lowers `uvPixelsPerBlock` until the layout fits.
- Produces non-overlapping UV rects (one rect per face).
- Reprojects existing texture pixels so painted faces follow the new UVs.
- Internal policy caps auto scaling via `autoMaxResolution` / `autoMaxRetries`.
  - Defaults: `autoMaxResolution=0` (use maxTextureSize), `autoMaxRetries=2`.

## Expected UV Size
Expected UV size is computed from:
- `uvPolicy.modelUnitsPerBlock` (default 16)
- `project.uvPixelsPerBlock` (default 16, project-level UV density)
- texture resolution is used for atlas capacity, not for per-face size when `uvPixelsPerBlock` is set
- face dimensions (from cube size)

`project.uvPixelsPerBlock` can be set at project creation via `ensure_project.uvPixelsPerBlock`.
When a project is reused and `uvPixelsPerBlock` is not set, bbmcp infers it from existing UVs
using the median face density.

If the actual UV size deviates beyond `uvPolicy.scaleTolerance` (default 0.1), the operation fails.

## Recommended Flow
1) `assign_texture` -- bind texture to cubes.
2) Paint using `paint_faces`.
3) `render_preview` to validate.
4) Internal UV atlas runs on cube add/scale; repaint if needed.

## Error Codes
- `validate` may report: `uv_overlap`, `uv_scale_mismatch`, `uv_scale_mismatch_summary`.
- Mutation guards return `invalid_state` on `uv_usage_mismatch`, overlap, or scale mismatch.

## Support Limits
- Extremely large models can exceed atlas capacity even after auto density reduction.
- When face UV size exceeds max texture bounds, bbmcp reports `uv_size_exceeds` and stops.

## Example: Low-level Modeling (Rooted Rig)
```json
{ "name": "root", "pivot": [0, 0, 0], "ifRevision": { "$ref": { "kind": "tool", "tool": "get_project_state", "pointer": "/project/revision" } } }
```
```json
{ "name": "body", "bone": "root", "from": [-4, 0, -2], "to": [4, 12, 2], "ifRevision": { "$ref": { "kind": "tool", "tool": "get_project_state", "pointer": "/project/revision" } } }
```

## Example: Face Paint
```json
{
  "textureName": "pot_tex",
  "target": { "cubeName": "body", "face": "north" },
  "op": { "op": "fill_rect", "x": 0, "y": 0, "width": 16, "height": 16, "color": "#c96f3b" }
}
```

## Example: Texture Coord Opt-in
```json
{
  "textureName": "pot_tex",
  "coordSpace": "texture",
  "width": 64,
  "height": 64,
  "target": { "cubeName": "body", "face": "north" },
  "op": { "op": "fill_rect", "x": 20, "y": 10, "width": 8, "height": 8, "color": "#2f4b38" }
}
```

## Example: Invalid Multi-Write Payload
```json
{
  "textureName": "pot_tex",
  "targets": [{ "cubeName": "body", "faces": ["north", "south"] }],
  "ops": [
    { "op": "fill_rect", "x": 0, "y": 0, "width": 16, "height": 16, "color": "#c96f3b" },
    { "op": "fill_rect", "x": 4, "y": 4, "width": 4, "height": 4, "color": "#8b4a22" }
  ]
}
```
Expected: rejected as `invalid_payload` because `paint_faces` only accepts singular `target` + singular `op`.
