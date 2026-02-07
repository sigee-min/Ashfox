# LLM Texture Strategy (Summary)

Primary flow:
1) assign_texture
2) paint_faces
3) render_preview

Recovery loop:
- validate reports uv_scale_mismatch / uv_overlap, or a mutation returns invalid_state about overlap/scale:
  - wait for internal auto-UV recovery (automatic on cube add and geometry-changing cube updates)
  - repaint

Notes:
- Project UV density is controlled by `uvPixelsPerBlock` (default 16). Reused projects infer a median from existing UVs.
- `paint_faces` is strict single-write and allows one target + one op; `target.face` is optional.
- `paint_faces` schema is strict; legacy `targets`, `ops`, and `background` fields are rejected.
- Omit `target.face` when the same op should apply to all mapped faces on that cube.
- Default `coordSpace` is `face`; omitting `width/height` auto-fits target face UV size.
- Use `coordSpace="texture"` only with explicit `width`/`height` that matches texture size.
- `fill_rect` shading is enabled by default; set `shade: false` for flat fills.
- `shade` can be an object (`enabled`, `intensity`, `edge`, `noise`, `seed`, `lightDir`) for deterministic tuning.
- `background` is not part of the `paint_faces` payload.

Failure examples:

1) UV overlap / UV scale mismatch (invalid_state):
- Allow internal auto-UV recovery to finish (triggered by cube changes).
- Repaint if needed.

2) Payload shape violation (invalid_payload):
- Reduce payload to one target and one op (`target.face` is optional).

This document is the active LLM texture strategy guide exposed via MCP resources.
