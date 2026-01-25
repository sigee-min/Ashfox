export const RIGGING_WORKFLOW_INSTRUCTIONS = [
  'For animation-ready rigs, always include a root bone named "root".',
  'Every non-root part must set parent to an existing part id (no flat bone lists).',
  'Prefer apply_model_spec/apply_rig_template; use low-level tools (add_bone/add_cube/update_*) only for surgical edits.',
  'Prefer stable ids; renaming ids can break animation channels.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  'If unsure about hierarchy rules, read bbmcp://guide/rigging via resources/read.'
].join(' ');

export const TEXTURE_WORKFLOW_INSTRUCTIONS = [
  'Prefer high-level tools: texture_pipeline, apply_texture_spec, apply_uv_spec, generate_texture_preset, preflight_texture.',
  'Use low-level tools (assign_texture, set_face_uv, set_pixel ops) only when high-level tools cannot express the change; avoid mixing high- and low-level edits in the same task.',
  'Before painting, lock invariants: project textureResolution, manual per-face UV policy, and intended texture count (single atlas vs per-material).',
  'Always build a mapping table first: call preflight_texture without texture filters to get a stable uvUsageId and UV mapping.',
  'Paint only inside UV rects (uvPaint enforced). Whole-texture painting is not supported; map UVs to the full texture if you need full coverage.',
  'uvUsageId is a guard. If any UVs change, call preflight_texture again and repaint. If you hit invalid_state due to UV usage mismatch, refresh preflight and retry with the new uvUsageId.',
  'UV overlaps are errors unless the rects are identical. UV scale mismatches are errors. Recovery loop: auto_uv_atlas(apply=true) -> preflight_texture -> repaint.',
  'Payload sizing: for <=32px textures, small ops are fine; for 64px+ prefer generate_texture_preset to avoid large payloads.',
  'Texture creation does not bind textures to cubes. After painting, call assign_texture explicitly, then set_face_uv for manual per-face mapping when needed.',
  'For visual verification, use render_preview/read_texture. If images cannot be attached, set saveToTmp=true and read bbmcp://guide/vision-fallback via resources/read.',
  'If unsure about the workflow or recovery, read bbmcp://guide/llm-texture-strategy via resources/read.'
].join(' ');

export const SERVER_TOOL_INSTRUCTIONS = [
  'Tool paths can be session-bound (e.g., /bbmcp/link_...).',
  'Tool schemas are strict (extra fields are rejected).',
  'Use get_project_state (or includeState/includeDiff) before and after edits.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'Prefer id fields when updating or deleting items.',
  'Pass ifRevision on mutations to guard against stale state.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  RIGGING_WORKFLOW_INSTRUCTIONS,
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');

export const SIDECAR_TOOL_INSTRUCTIONS = [
  'Use get_project_state (or includeState/includeDiff) before mutations and include ifRevision.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'Prefer id-based updates.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  RIGGING_WORKFLOW_INSTRUCTIONS,
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');
