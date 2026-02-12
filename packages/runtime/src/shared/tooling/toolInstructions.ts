export const RIGGING_WORKFLOW_INSTRUCTIONS = [
  'For animation-ready rigs, ensure a root bone exists (explicit for most projects).',
  'Every non-root part must set parent to an existing part id (no flat bone lists).',
  'Modeling is low-level only: use add_bone/add_cube/update_cube one item per call.',
  'If cube bone is omitted, the server auto-creates/uses a root bone.',
  'Prefer stable ids; renaming ids can break animation channels.',
  'LLM guidance: iterate step-by-step and re-check get_project_state after each add/update.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  'If unsure about hierarchy rules, read ashfox://guide/rigging via resources/read.',
  'For low-level modeling steps, read ashfox://guide/modeling-workflow via resources/read.'
].join(' ');

export const TEXTURE_WORKFLOW_INSTRUCTIONS = [
  'Textures are low-level only: assign_texture -> paint_faces for cubes. UVs are managed internally (no manual UV tools).',
  'ensure_project auto-creates a texture named after the project when none exists.',
  'paint_faces is strict single-write: send exactly one target (cubeId/cubeName, optional face) and one op.',
  'fill_rect shading defaults to on for Minecraft-like tone variation; set shade=false to disable, or use a shade object to tune.',
  'paint_faces defaults to coordSpace=face; omit width/height to auto-match the target face UV size.',
  'Use coordSpace=texture only when you need texture-space coordinates, and always send width/height.',
  'UV overlaps or scale mismatches trigger automatic recovery; retry paint_faces after fixes.',
  'Cube add/scale triggers an internal UV atlas pass when textures exist.',
  'Internal UV recovery reprojects existing texture pixels so face colors follow the new UV layout.',
  'Payload sizing: for <=32px textures, small ops are fine; for 64px+ keep ops minimal and reuse tiles.',
  'Texture creation does not bind textures to cubes. Ensure textures are assigned via assign_texture.',
  'For visual verification, use render_preview. If images cannot be attached, set saveToTmp=true and read ashfox://guide/vision-fallback via resources/read.',
  'If unsure about the workflow or recovery, read ashfox://guide/llm-texture-strategy via resources/read.'
].join(' ');

export const SERVER_TOOL_INSTRUCTIONS = [
  'Tool paths can be session-bound (e.g., /ashfox/link_...).',
  'toolRegistry.hash is the authoritative schema change signal; toolSchemaVersion is coarse.',
  'Tool schemas are strict (extra fields are rejected).',
  'Use get_project_state (or includeState/includeDiff) before and after edits.',
  'Modeling is low-level only: add_bone/add_cube/update_cube.',
  'Animations are low-level only: create_animation_clip -> set_frame_pose -> set_trigger_keyframes.',
  'Animation poses are one frame per call: set_frame_pose can include multiple bones at the same frame.',
  'bones[].interp overrides the top-level interp; if clip fps is missing, the server defaults to 20.',
  'Trigger keys are one-per-call: set_trigger_keyframes accepts exactly one key.',
  'LLM guidance: use small iterative edits and confirm state between steps.',
  'Textures are low-level only: assign_texture -> paint_faces (UVs are internal).',
  'paint_faces requires one target (cubeId/cubeName, optional face) and one op; default coordSpace is face.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'ensure_project supports action="delete" to close the active project. Provide target.name to match the open project; set force=true to discard unsaved changes (no auto-save).',
  'ensure_project auto-confirms the Blockbench project dialog. Provide ensure_project.dialog values for required fields (e.g., parent) so creation can proceed without UI input.',
  'Project creation uses the engine authoring format automatically; override only dialog-level fields (such as formatId/parent) when needed.',
  'Prefer id fields when updating or deleting items.',
  'Pass ifRevision on mutations to guard against stale state.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  RIGGING_WORKFLOW_INSTRUCTIONS,
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');

export const SIDECAR_TOOL_INSTRUCTIONS = [
  'Use get_project_state (or includeState/includeDiff) before mutations and include ifRevision.',
  'toolRegistry.hash is the authoritative schema change signal; toolSchemaVersion is coarse.',
  'Modeling is low-level only: add_bone/add_cube/update_cube.',
  'Animations are low-level only: create_animation_clip -> set_frame_pose -> set_trigger_keyframes.',
  'Animation poses are one frame per call: set_frame_pose can include multiple bones at the same frame.',
  'bones[].interp overrides the top-level interp; if clip fps is missing, the server defaults to 20.',
  'Trigger keys are one-per-call: set_trigger_keyframes accepts exactly one key.',
  'Textures are low-level only: assign_texture -> paint_faces (UVs are internal).',
  'paint_faces requires one target (cubeId/cubeName, optional face) and one op; default coordSpace is face.',
  'Prefer ensure_project to create or reuse projects; use match/onMismatch/onMissing to control when a fresh project is created.',
  'ensure_project supports action="delete" to close the active project. Provide target.name to match the open project; set force=true to discard unsaved changes (no auto-save).',
  'ensure_project auto-confirms the Blockbench project dialog. Provide ensure_project.dialog values for required fields (e.g., parent) so creation can proceed without UI input.',
  'Project creation uses the engine authoring format automatically; override only dialog-level fields (such as formatId/parent) when needed.',
  'Prefer id-based updates.',
  'If you get invalid_state_revision_mismatch, call get_project_state and retry with the latest ifRevision.',
  RIGGING_WORKFLOW_INSTRUCTIONS,
  TEXTURE_WORKFLOW_INSTRUCTIONS
].join(' ');


