# LLM Texture Strategy (bbmcp)

Use this guide to keep UVs and textures consistent across parts.

## Primary Workflow
1) `assign_texture`
2) `paint_faces`
3) `render_preview`

Notes:
- Use `ifRevision` for mutations.
- UV tools are internal; UVs are recalculated automatically on cube add/scale.
- Project UV density is controlled by `uvPixelsPerBlock` (default 16). Reused projects infer a median from existing UVs.
- `paint_faces` is strict single-write and accepts exactly one target + one face + one op.
- `paint_faces` defaults to `coordSpace="face"`; omit `width/height` to auto-fit target face UV size.
- Use `coordSpace="texture"` only when needed, with explicit `width`/`height` matching texture size.
- `background` is not part of the `paint_faces` payload.

## Error Recovery (Always)
If `validate` reports `uv_overlap` / `uv_scale_mismatch` or a mutation returns `invalid_state` mentioning overlap/scale:
1) Allow the internal auto-UV pass to complete (automatic on cube add/scale).
2) Repaint with `paint_faces` if needed.

## Common Pitfalls
- All faces mapped to full texture (e.g., [0,0,32,32]) causes scale mismatch.
- Changing textureResolution after painting requires repainting.
- UV overlap is not allowed (all rects must be unique).
- `paint_faces` rejects multi-target, multi-face, and multi-op payload shapes.

## Minimal Examples

Paint faces:
```json
{
  "textureName": "pot_tex",
  "target": { "cubeName": "body", "face": "north" },
  "op": { "op": "fill_rect", "x": 0, "y": 0, "width": 16, "height": 16, "color": "#c96f3b" }
}
```
