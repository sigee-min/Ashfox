export const TEXTURE_WORKFLOW_INSTRUCTIONS =
  'Prefer high-level tools (texture_pipeline, generate_block_pipeline, apply_model_spec, apply_texture_spec, generate_texture_preset). Use low-level tools (add_bone/add_cube/set_face_uv) only when high-level tools cannot express the change; avoid mixing high- and low-level edits in the same task. Lock invariants before painting: textureResolution, UV policy (manual per-face), and texture count (single atlas vs per-material). For <=32px textures, set_pixel ops are fine; for 64px+ use generate_texture_preset to avoid large payloads. Build a mapping table first: call preflight_texture without texture filters, then paint only the UV rects it reports (uvPaint enforced); pass its uvUsageId to apply_texture_spec or generate_texture_preset. Full-texture painting is not supported; map UVs to the full texture if you want whole-texture coverage. If UV usage changes, apply_texture_spec/generate_texture_preset will fail with invalid_state and you must preflight again. UV rects must not overlap unless identical; overlapping rects block apply_texture_spec and are reported by preflight/validate. Start with a checker/label texture to verify orientation before final paint. If UVs change, repaint using the new mapping. Prefer splitting textures by material groups (e.g., pot/soil/plant) and assign by cubeNames. After assign_texture, use set_face_uv to map per-face UVs explicitly. Low opaque coverage is rejected to avoid transparent results; fill a larger area or tighten UVs. If UVs exceed the current textureResolution, increase project resolution (width >= 2*(w+d), height >= 2*(h+d), round up to 32/64/128) or split textures per material. Use set_project_texture_resolution before creating larger textures. apply_texture_spec uses ops-only; omit ops to create a blank texture (background can still fill). For visual inspection, render_preview/read_texture return image content; use saveToTmp to snapshot into .bbmcp/tmp when images cannot be attached. For entity workflows, prefer apply_entity_spec (geckolib v3/v4) and see bbmcp://guide/entity-workflow via resources/read.';

export const SERVER_TOOL_INSTRUCTIONS = [
  'Tool paths can be session-bound (e.g., /bbmcp/link_...).',
  'Tool schemas are strict (extra fields are rejected).',
  'Use get_project_state (or includeState/includeDiff) before and after edits.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'For animation-ready rigs, always provide a root bone and parent every non-root part (avoid flat bone lists); prefer apply_model_spec/apply_rig_template.',
  'Prefer id fields when updating or deleting items.',
  'Pass ifRevision on mutations to guard against stale state.',
  'Texture creation does not bind textures to cubes; call assign_texture explicitly, then set_face_uv for per-face UVs.',
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');

export const SIDECAR_TOOL_INSTRUCTIONS = [
  'Use get_project_state (or includeState/includeDiff) before mutations and include ifRevision.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'For animation-ready rigs, always provide a root bone and parent every non-root part (avoid flat bone lists); prefer apply_model_spec/apply_rig_template.',
  'Prefer id-based updates.',
  'Texture creation does not bind textures to cubes; call assign_texture explicitly, then set_face_uv for manual per-face UVs.',
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');
