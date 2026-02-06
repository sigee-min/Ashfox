import type { ToolResponse } from './shared';
import type { RenderPreviewPayload } from './preview';
import type { ToolName } from '../shared/toolConstants';
import type {
  AddBonePayload,
  AddCubePayload,
  AssignTexturePayload,
  CreateAnimationClipPayload,
  DeleteAnimationClipPayload,
  DeleteBonePayload,
  DeleteCubePayload,
  DeleteTexturePayload,
  EnsureProjectPayload,
  ExportPayload,
  ExportTraceLogPayload,
  GetProjectStatePayload,
  PaintFacesPayload,
  ReadTexturePayload,
  ReloadPluginsPayload,
  SetFramePosePayload,
  SetTriggerKeyframesPayload,
  UpdateBonePayload,
  UpdateCubePayload,
  UpdateAnimationClipPayload,
  ValidatePayload
} from './tools/payloads';
import type { ToolResultMap } from './tools/results';

export type { ToolName, EnsureProjectMatch, EnsureProjectOnMismatch, EnsureProjectOnMissing, EnsureProjectAction } from '../shared/toolConstants';
export type { UvPaintMapping, UvPaintScope, UvPaintSource, UvPaintSpec, UvPaintTarget } from '../domain/uv/paintSpec';
export type { CubeFaceDirection } from '../domain/model';

export type {
  AddBonePayload,
  AddCubePayload,
  AssignTexturePayload,
  AutoUvAtlasPayload,
  CreateAnimationClipPayload,
  DeleteAnimationClipPayload,
  DeleteBonePayload,
  DeleteCubePayload,
  DeleteTexturePayload,
  EnsureProjectPayload,
  ExportPayload,
  ExportTraceLogPayload,
  ExportTraceLogMode,
  GetProjectStatePayload,
  PaintTexturePayload,
  PaintFacesPayload,
  PreflightTexturePayload,
  ReadTexturePayload,
  ReloadPluginsPayload,
  SetFramePosePayload,
  SetFaceUvPayload,
  SetProjectTextureResolutionPayload,
  SetTriggerKeyframesPayload,
  UpdateBonePayload,
  UpdateCubePayload,
  UpdateAnimationClipPayload,
  ValidatePayload
} from './tools/payloads';

export type {
  AutoUvAtlasResult,
  EnsureProjectResult,
  ExportResult,
  ExportTraceLogResult,
  GetProjectStateResult,
  PaintTextureResult,
  PaintFacesResult,
  PreflightUvBounds,
  PreflightUsageSummary,
  PreflightTextureResult,
  ReadTextureResult,
  ReloadPluginsResult,
  SetProjectTextureResolutionResult,
  ToolResultMap,
  ValidateFinding,
  ValidateResult
} from './tools/results';

export interface ToolPayloadMap {
  list_capabilities: Record<string, never>;
  get_project_state: GetProjectStatePayload;
  read_texture: ReadTexturePayload;
  export_trace_log: ExportTraceLogPayload;
  reload_plugins: ReloadPluginsPayload;
  paint_faces: PaintFacesPayload;
  ensure_project: EnsureProjectPayload;
  delete_texture: DeleteTexturePayload;
  assign_texture: AssignTexturePayload;
  add_bone: AddBonePayload;
  update_bone: UpdateBonePayload;
  delete_bone: DeleteBonePayload;
  add_cube: AddCubePayload;
  update_cube: UpdateCubePayload;
  delete_cube: DeleteCubePayload;
  create_animation_clip: CreateAnimationClipPayload;
  update_animation_clip: UpdateAnimationClipPayload;
  delete_animation_clip: DeleteAnimationClipPayload;
  set_frame_pose: SetFramePosePayload;
  set_trigger_keyframes: SetTriggerKeyframesPayload;
  export: ExportPayload;
  render_preview: RenderPreviewPayload;
  validate: ValidatePayload;
}

export interface Dispatcher {
  handle<TName extends ToolName>(
    name: TName,
    payload: ToolPayloadMap[TName]
  ): ToolResponse<ToolResultMap[TName]>;
}

