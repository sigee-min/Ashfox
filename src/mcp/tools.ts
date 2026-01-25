import { JsonSchema, McpToolDefinition } from './types';
import { toolSchemas } from './toolSchemas';

export const MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'list_capabilities',
    title: 'List Capabilities',
    description: 'Returns plugin capabilities and limits. Tool schemas are strict (extra fields are rejected).',
    inputSchema: toolSchemas.list_capabilities
  },
  {
    name: 'get_project_state',
    title: 'Get Project State',
    description:
      'Returns the current project state (summary by default). Summary includes texture metadata and textureResolution. Full detail includes textureUsage (per-face mappings) when available.',
    inputSchema: toolSchemas.get_project_state
  },
  {
    name: 'read_texture',
    title: 'Read Texture',
    description:
      'Developer tool: reads a texture image (PNG) by id or name. Returns MCP image content plus structured metadata. Set saveToTmp=true to write a snapshot into .bbmcp/tmp for manual upload fallback. See bbmcp://guide/vision-fallback via resources/read. Requires an active project.',
    inputSchema: toolSchemas.read_texture
  },
  {
    name: 'reload_plugins',
    title: 'Reload Plugins',
    description:
      'Schedules a Blockbench plugin reload using Plugins.devReload (developer-only). Requires confirm=true. Optional delayMs (default 100) to allow the MCP response to flush before reload.',
    inputSchema: toolSchemas.reload_plugins
  },
  {
    name: 'generate_texture_preset',
    title: 'Generate Texture Preset',
    description:
      'High-level: generates a procedural texture preset without local files (preferred for 64x64+). Requires ifRevision and uvUsageId from preflight_texture (call without texture filters). The preset is generated as a source canvas and painted into UV rects (uvPaint enforced, defaults to scope=rects). If UV usage changes, the call fails with invalid_state and you must preflight again. UV overlaps or UV scale mismatches also block the call. mode=create needs name; mode=update needs targetId/targetName. For block-scale patterns map full textures; for small parts use dedicated/tileable presets or atlas regions. See bbmcp://guide/texture-workflow via resources/read.',
    inputSchema: toolSchemas.generate_texture_preset
  },
  {
    name: 'auto_uv_atlas',
    title: 'Auto UV Atlas',
    description:
      'Auto-packs UVs into a texture atlas using current textureResolution. Groups share rects only when the texture and face size match; all other faces are placed into non-overlapping atlas regions. If packing overflows, the resolution is doubled and packing is retried until it fits (up to limits). Rect sizes are computed from the starting resolution, so increasing resolution creates more space instead of scaling every rect. When apply=true (default), updates face UVs and adjusts textureResolution; otherwise returns a plan only. Repaint textures after resizing. See bbmcp://guide/uv-atlas via resources/read.',
    inputSchema: toolSchemas.auto_uv_atlas
  },
  {
    name: 'ensure_project',
    title: 'Ensure Project',
    description:
      'Ensures a usable project. Reuses the active project by default and can create a new one when missing or on mismatch (per options). Use match/onMismatch/onMissing to control behavior.',
    inputSchema: toolSchemas.ensure_project
  },
  {
    name: 'generate_block_pipeline',
    title: 'Generate Block Pipeline',
    description:
      'High-level: generates block assets (blockstates/models/item models) using vanilla parents. Returns JSON and stores MCP resources. mode=with_blockbench creates a Java Block/Item project with a base cube (requires ifRevision).',
    inputSchema: toolSchemas.generate_block_pipeline
  },
  {
    name: 'set_project_texture_resolution',
    title: 'Set Project Texture Resolution',
    description:
      'Sets the project texture resolution (width/height). Requires ifRevision; call get_project_state first. Set modifyUv=true to scale existing UVs to the new resolution (if supported). This does not resize existing textures; use it before creating textures. If you change resolution after painting, repaint using the new UV mapping. If UVs exceed the current resolution, increase it (width >= 2*(w+d), height >= 2*(h+d), round up to 32/64/128) or split textures per material.',
    inputSchema: toolSchemas.set_project_texture_resolution
  },
  {
    name: 'preflight_texture',
    title: 'Preflight Texture',
    description:
      'Returns UV bounds, usage summary, and a recommended texture resolution based on current face UVs. Use this before painting to avoid out-of-bounds UVs and to decide whether a face should use full-texture mapping (block-scale) or a dedicated/tileable texture. Includes uvUsageId for apply_texture_spec/uvPaint; uvUsageId is computed from full texture usage (not just the filtered texture), so call without texture filters for a stable id. Set includeUsage=true to include the full textureUsage mapping table. Preflight warns on UV overlaps; only identical rects may overlap.',
    inputSchema: toolSchemas.preflight_texture
  },
  {
    name: 'delete_texture',
    title: 'Delete Texture',
    description: 'Deletes a texture by id or name. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.delete_texture
  },
  {
    name: 'assign_texture',
    title: 'Assign Texture',
    description:
      'Low-level: binds a texture to cubes/faces without changing UVs (forces per-face UV mode; auto UV disabled). Required after apply_texture_spec or generate_texture_preset. Requires ifRevision; call get_project_state first. Omit cubeIds/cubeNames to apply to all cubes. Use set_face_uv to define per-face UVs explicitly. If UVs change after painting, repaint using the updated mapping. Prefer material-group textures (pot/soil/plant) and assign by cubeNames for stability. For block assets, map full textures to preserve pattern scale; for small parts or partial UVs, use dedicated/tileable textures or atlas regions. If UVs exceed the current textureResolution, increase it or split textures per material. After assigning, run preflight_texture before painting to catch UV scale mismatches.',
    inputSchema: toolSchemas.assign_texture
  },
  {
    name: 'set_face_uv',
    title: 'Set Face UV',
    description:
      'Low-level: sets per-face UVs for a cube (manual UV only; auto UV disabled). Requires ifRevision; call get_project_state first. Provide cubeId or cubeName plus a faces map (e.g., {north:[x1,y1,x2,y2], up:[x1,y1,x2,y2]}). UVs are in texture pixels and must fit within the project textureResolution; if they exceed it, increase resolution or split textures. If you change UVs after painting, repaint using the new mapping. Run preflight_texture before painting to catch UV scale mismatches.',
    inputSchema: toolSchemas.set_face_uv
  },
  {
    name: 'add_bone',
    title: 'Add Bone',
    description:
      'Low-level: adds a bone to the current project. Prefer apply_model_spec or apply_rig_template when possible. For animation-ready rigs, always build a root-based hierarchy (set parent for every non-root bone; avoid flat bone lists). Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.add_bone
  },
  {
    name: 'update_bone',
    title: 'Update Bone',
    description:
      'Low-level: updates a bone (rename, transform, or reparent). Use only when high-level tools cannot express the change. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.update_bone
  },
  {
    name: 'delete_bone',
    title: 'Delete Bone',
    description:
      'Low-level: deletes a bone (and its descendants). Use only when high-level tools cannot express the change. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.delete_bone
  },
  {
    name: 'add_cube',
    title: 'Add Cube',
    description:
      'Low-level: adds a cube to the given bone. Prefer apply_model_spec for new models. Requires ifRevision; call get_project_state first. Texture binding is separate; use assign_texture and set_face_uv for per-face UVs.',
    inputSchema: toolSchemas.add_cube
  },
  {
    name: 'update_cube',
    title: 'Update Cube',
    description:
      'Low-level: updates a cube (rename, transform, or reparent). Use only when high-level tools cannot express the change. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.update_cube
  },
  {
    name: 'delete_cube',
    title: 'Delete Cube',
    description:
      'Low-level: deletes a cube. Use only when high-level tools cannot express the change. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.delete_cube
  },
  {
    name: 'apply_rig_template',
    title: 'Apply Rig Template',
    description:
      'High-level: applies a rig template for additive rigging; avoid combining with apply_model_spec unless you intend to add more bones/cubes. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.apply_rig_template
  },
  {
    name: 'export',
    title: 'Export',
    description: 'Exports the current model to a file path. Requires ifRevision; call get_project_state first.',
    inputSchema: toolSchemas.export
  },
  {
    name: 'render_preview',
    title: 'Render Preview',
    description:
      'Renders a preview image. fixed -> single (optional angle). turntable -> sequence. Returns MCP image content blocks (base64 PNG) plus structured metadata without dataUri. Set saveToTmp=true to write snapshots into .bbmcp/tmp for manual upload fallback. See bbmcp://guide/vision-fallback via resources/read. Single returns result.image; sequence returns result.frames[]. Example(single): {"mode":"fixed","output":"single","angle":[30,45,0]} Example(sequence): {"mode":"turntable","output":"sequence","durationSeconds":2,"fps":12}',
    inputSchema: toolSchemas.render_preview
  },
  {
    name: 'validate',
    title: 'Validate',
    description: 'Validates the current project.',
    inputSchema: toolSchemas.validate
  },
  {
    name: 'apply_model_spec',
    title: 'Apply Model Spec',
    description:
      'High-level: applies a structured model specification (rigTemplate + parts) to the active project (does not create a new project). Prefer over add_bone/add_cube for new models. Requires ifRevision; call get_project_state first. For animation-ready rigs, include a root bone and set parent for every non-root part (avoid flat bone lists). Example: {"model":{"rigTemplate":"empty","parts":[{"id":"root","size":[0,0,0],"offset":[0,0,0]},{"id":"body","parent":"root","size":[8,12,4],"offset":[-4,0,-2]},{"id":"head","parent":"body","size":[8,8,8],"offset":[-4,12,-4]}]}}. Textures are handled separately via apply_texture_spec + assign_texture. See bbmcp://guide/rigging via resources/read.',
    inputSchema: toolSchemas.apply_model_spec
  },
  {
    name: 'apply_texture_spec',
    title: 'Apply Texture Spec',
    description:
      'High-level: applies a structured texture specification. Requires ifRevision and uvUsageId from preflight_texture (call without texture filters). If uvUsageId does not match current UV usage, the call fails with invalid_state and you must preflight again. uvPaint is always enforced: ops/background are drawn into a source canvas, then stretched/tiled into UV rects (optionally filtered by cubeIds/cubeNames/faces, with padding/anchor). Full-texture painting is not supported; map UVs to the full texture if you want whole-texture coverage. UV rects must not overlap unless identical; overlaps block apply_texture_spec. UV scale mismatches also block apply_texture_spec. This creates/updates texture data only; call assign_texture to bind it to cubes, then set_face_uv for manual per-face UVs. Before painting, call preflight_texture to build a UV mapping table and verify with a checker/label texture. Block-scale patterns should map full textures; small parts should use dedicated/tileable textures or atlas regions to avoid cropped patterns. If UVs change, repaint using the new mapping. Low opaque coverage is rejected to avoid transparent results; fill a larger area or tighten UVs. width/height are required and must match the intended project textureResolution. Prefer separate textures per material group (pot/soil/plant) rather than one mega-texture. If UVs exceed the current textureResolution, increase it (width >= 2*(w+d), height >= 2*(h+d), round up to 32/64/128) or split textures per material. Use set_project_texture_resolution before creating textures when increasing size. ops are optional; background fills within UV rects when set. Success responses include report.textureCoverage (opaque ratio + bounds) for each rendered texture. If autoRecover=true, the server may run auto_uv_atlas + preflight_texture once on UV overlap/scale mismatch or uvUsageId mismatch and return the refreshed uvUsageId. See bbmcp://guide/texture-workflow via resources/read.',
    inputSchema: toolSchemas.apply_texture_spec
  },
  {
    name: 'apply_uv_spec',
    title: 'Apply UV Spec',
    description:
      'High-level: applies structured UV updates with uvUsageId guard and UV overlap/scale validation. Uses the same preflight_texture uvUsageId as apply_texture_spec; fails if UV usage changed. The tool only updates per-face UVs (no texture painting). It requires faces to be bound to textures (assign_texture) so overlaps/scale can be validated. After changes, repaint textures using the new mapping if needed. See bbmcp://guide/texture-spec via resources/read.',
    inputSchema: toolSchemas.apply_uv_spec
  },
  {
    name: 'texture_pipeline',
    title: 'Texture Pipeline',
    description:
      'Macro: runs the standard texture workflow in one call (assign_texture → preflight_texture → apply_uv_spec → preflight_texture → apply_texture_spec/generate_texture_preset → render_preview). Use assign/uv/textures/presets/preview to select steps. If autoRecover=true, the pipeline will attempt auto_uv_atlas + preflight_texture once when UV overlap/scale mismatches or uvUsageId mismatches are detected.',
    inputSchema: toolSchemas.texture_pipeline
  },
  {
    name: 'apply_entity_spec',
    title: 'Apply Entity Spec',
    description:
      'High-level: orchestrates entity workflows (model + textures + animations + triggers) for supported formats. Currently implemented: geckolib (targetVersion v3/v4). Modded/OptiFine are TODO and will return not_implemented. Provide ensureProject to auto-create/reuse a geckolib project, then model/textures/animations/triggers as needed. For textures, autoRecover=true can retry UV recovery once. See bbmcp://guide/entity-workflow via resources/read.',
    inputSchema: toolSchemas.apply_entity_spec
  },
];

const hashText = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const toolRegistrySignature = () =>
  JSON.stringify(MCP_TOOLS.map((tool) => ({ name: tool.name, inputSchema: tool.inputSchema })));

export const TOOL_REGISTRY_HASH = hashText(toolRegistrySignature());
export const TOOL_REGISTRY_COUNT = MCP_TOOLS.length;

export const getToolSchema = (name: string): JsonSchema | null => toolSchemas[name] ?? null;

export const isKnownTool = (name: string) => Boolean(toolSchemas[name]);

