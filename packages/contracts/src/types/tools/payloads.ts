import type {
  CubeFaceDirection,
  EnsureProjectAction,
  EnsureProjectMatch,
  EnsureProjectOnMismatch,
  EnsureProjectOnMissing,
  IfRevisionOption,
  IncludeDiffOption,
  IncludeStateOption,
  ProjectStateDetail
} from '../shared';

export type FaceUvRect = [number, number, number, number];

export type FaceUvMap = Partial<Record<CubeFaceDirection, FaceUvRect>>;

export type UvPaintScope = 'faces' | 'rects' | 'bounds';

export type UvPaintMapping = 'stretch' | 'tile';

export type UvPaintTarget = {
  cubeIds?: string[];
  cubeNames?: string[];
  faces?: CubeFaceDirection[];
};

export type UvPaintSource = {
  width?: number;
  height?: number;
};

export type UvPaintSpec = {
  scope?: UvPaintScope;
  mapping?: UvPaintMapping;
  target?: UvPaintTarget;
  source?: UvPaintSource;
  padding?: number;
  anchor?: [number, number];
};

export type FillShadeDirection = 'tl_br' | 'tr_bl' | 'top_bottom' | 'left_right';

export type FillRectShadeLike =
  | boolean
  | {
      enabled?: boolean;
      intensity?: number;
      edge?: number;
      noise?: number;
      seed?: number;
      lightDir?: FillShadeDirection;
    };

export type TextureOpLike =
  | { op: 'set_pixel'; x: number; y: number; color: string }
  | { op: 'fill_rect'; x: number; y: number; width: number; height: number; color: string; shade?: FillRectShadeLike }
  | { op: 'draw_rect'; x: number; y: number; width: number; height: number; color: string; lineWidth?: number }
  | { op: 'draw_line'; x1: number; y1: number; x2: number; y2: number; color: string; lineWidth?: number };

export interface EnsureProjectPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  action?: EnsureProjectAction;
  target?: { name?: string };
  name?: string;
  match?: EnsureProjectMatch;
  onMismatch?: EnsureProjectOnMismatch;
  onMissing?: EnsureProjectOnMissing;
  confirmDiscard?: boolean;
  force?: boolean;
  uvPixelsPerBlock?: number;
  dialog?: Record<string, unknown>;
}

export interface PaintTexturePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  width: number;
  height: number;
  name?: string;
  targetId?: string;
  targetName?: string;
  mode?: 'create' | 'update';
  background?: string;
  ops?: TextureOpLike[];
  uvPaint?: UvPaintSpec;
  uvUsageId?: string;
}

export interface PaintFaceTarget {
  cubeId?: string;
  cubeName?: string;
  face?: CubeFaceDirection;
}

export interface PaintFacesPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  textureId?: string;
  textureName?: string;
  target: PaintFaceTarget;
  coordSpace?: 'face' | 'texture';
  width?: number;
  height?: number;
  op: TextureOpLike;
  mapping?: 'stretch' | 'tile';
}

export interface AutoUvAtlasPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  padding?: number;
  apply?: boolean;
}

export interface ReadTexturePayload {
  id?: string;
  name?: string;
  saveToTmp?: boolean;
  tmpName?: string;
  tmpPrefix?: string;
}

export type ExportTraceLogMode = 'auto' | 'writeFile' | 'export';

export interface ExportTraceLogPayload {
  mode?: ExportTraceLogMode;
  destPath?: string;
  fileName?: string;
}

export interface ReloadPluginsPayload {
  confirm?: boolean;
  delayMs?: number;
}

export interface GetProjectStatePayload {
  detail?: ProjectStateDetail;
  includeUsage?: boolean;
}

export interface SetProjectTextureResolutionPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  width: number;
  height: number;
  modifyUv?: boolean;
}

export interface PreflightTexturePayload {
  textureId?: string;
  textureName?: string;
  includeUsage?: boolean;
}

export interface DeleteTexturePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
}

export interface AssignTexturePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  textureId?: string;
  textureName?: string;
  cubeIds?: string[];
  cubeNames?: string[];
  faces?: CubeFaceDirection[];
}

export interface SetFaceUvPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  cubeId?: string;
  cubeName?: string;
  faces: FaceUvMap;
}

export interface AddBonePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name: string;
  parent?: string;
  parentId?: string;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  visibility?: boolean;
}

export interface UpdateBonePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  newName?: string;
  parent?: string;
  parentId?: string;
  parentRoot?: boolean;
  pivot?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  visibility?: boolean;
}

export interface DeleteBonePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  ids?: string[];
  names?: string[];
}

export interface AddCubePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name: string;
  from: [number, number, number];
  to: [number, number, number];
  bone?: string;
  boneId?: string;
  origin?: [number, number, number];
  rotation?: [number, number, number];
  inflate?: number;
  mirror?: boolean;
  visibility?: boolean;
  boxUv?: boolean;
  uvOffset?: [number, number];
}

export interface UpdateCubePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  newName?: string;
  bone?: string;
  boneId?: string;
  boneRoot?: boolean;
  from?: [number, number, number];
  to?: [number, number, number];
  origin?: [number, number, number];
  rotation?: [number, number, number];
  inflate?: number;
  mirror?: boolean;
  visibility?: boolean;
  boxUv?: boolean;
  uvOffset?: [number, number];
}

export interface DeleteCubePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  ids?: string[];
  names?: string[];
}

export interface CreateAnimationClipPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name: string;
  length: number;
  loop: boolean;
  fps: number;
}

export interface UpdateAnimationClipPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  newName?: string;
  length?: number;
  loop?: boolean;
  fps?: number;
}

export interface DeleteAnimationClipPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  id?: string;
  name?: string;
  ids?: string[];
  names?: string[];
}

export interface SetFramePosePayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  clipId?: string;
  clip: string;
  frame: number;
  bones: Array<{
    name: string;
    rot?: [number, number, number];
    pos?: [number, number, number];
    scale?: [number, number, number];
    interp?: 'linear' | 'step' | 'catmullrom';
  }>;
  interp?: 'linear' | 'step' | 'catmullrom';
}

export interface SetTriggerKeyframesPayload extends IncludeStateOption, IncludeDiffOption, IfRevisionOption {
  clipId?: string;
  clip: string;
  channel: 'sound' | 'particle' | 'timeline';
  keys: [{ time: number; value: string | string[] | Record<string, unknown> }];
}

export interface ExportPayload extends IncludeStateOption, IfRevisionOption {
  format:
    | 'gecko_geo_anim'
    | 'gltf'
    | 'native_codec';
  codecId?: string;
  destPath: string;
  options?: {
    fallback?: 'strict' | 'best_effort';
    includeDiagnostics?: boolean;
  };
}

export interface ValidatePayload extends IncludeStateOption, IfRevisionOption {}
