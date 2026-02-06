# Texture Workflow (Auto UV)

Goal: paint textures without managing UVs manually.

Steps:
1) ensure_project / get_project_state (capture revision)
2) assign_texture (bind texture to cubes)
3) paint_faces (direct ops)
4) render_preview to validate

Notes:
- UVs are managed internally; UV tools are not exposed to clients.
- `ensure_project.uvPixelsPerBlock` sets the per-face UV density (default 16).
- When reusing an existing project, bbmcp infers UV density from existing UVs using the median face density.
- ensure_project auto-creates a texture named after the project when none exists.
- Cube add/scale triggers an automatic internal UV atlas pass; existing pixels are reprojected to the new UV layout.
- paint_faces may return a recovery summary when auto-UV fixes were applied.
- paint_faces is strict single-write: exactly one `target` (`cubeId`/`cubeName` + one `face`) and one `op`.
- Default `coordSpace` is `face`; if `width/height` is omitted, source size follows the target face UV size.
- Use `coordSpace: "texture"` only for texture-space coordinates; this requires explicit `width`/`height` matching texture size.
- `background` is not part of the paint_faces payload.
- For >=64px textures, keep ops minimal and use tiling patterns.
- When specifying both cubeId and cubeName in target, both must match. Use only one to avoid overly narrow matches.
- Support limit: models that still exceed atlas capacity after auto density reduction are not supported.

Example (paint_faces):
```json
{
  "textureName": "pot_tex",
  "target": { "cubeName": "body", "face": "north" },
  "op": { "op": "fill_rect", "x": 0, "y": 0, "width": 16, "height": 16, "color": "#c96f3b" }
}
```

Failure example (invalid multi-write payload):
```json
{
  "textureName": "pot_tex",
  "targets": [{ "cubeName": "body", "faces": ["north", "south"] }],
  "ops": [
    { "op": "fill_rect", "x": 0, "y": 0, "width": 16, "height": 16, "color": "#c96f3b" },
    { "op": "fill_rect", "x": 2, "y": 2, "width": 2, "height": 2, "color": "#8b4a22" }
  ]
}
```
