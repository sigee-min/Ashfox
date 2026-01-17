import { FormatKind, RenderPreviewPayload, RenderPreviewResult, ToolError } from '../types';

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

export type TextureSource = {
  id?: string;
  name: string;
  width?: number;
  height?: number;
  path?: string;
  dataUri?: string;
  image?: CanvasImageSource;
};

export type TextureStat = {
  id?: string | null;
  name: string;
  width: number;
  height: number;
  path?: string;
};

export type ImportTextureCommand = {
  id?: string;
  name: string;
  dataUri?: string;
  path?: string;
};

export type UpdateTextureCommand = {
  id?: string;
  name?: string;
  newName?: string;
  dataUri?: string;
  path?: string;
};

export type DeleteTextureCommand = {
  id?: string;
  name?: string;
};

export type ReadTextureCommand = {
  id?: string;
  name?: string;
};

export type BoneCommand = {
  id?: string;
  name: string;
  parent?: string;
  pivot: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

export type UpdateBoneCommand = {
  id?: string;
  name?: string;
  newName?: string;
  parent?: string | null;
  parentRoot?: boolean;
  pivot?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

export type DeleteBoneCommand = {
  id?: string;
  name?: string;
};

export type CubeCommand = {
  id?: string;
  name: string;
  from: Vec3;
  to: Vec3;
  bone?: string;
  uv?: Vec2;
  inflate?: number;
  mirror?: boolean;
};

export type UpdateCubeCommand = {
  id?: string;
  name?: string;
  newName?: string;
  bone?: string | null;
  boneRoot?: boolean;
  from?: Vec3;
  to?: Vec3;
  uv?: Vec2;
  inflate?: number;
  mirror?: boolean;
};

export type DeleteCubeCommand = {
  id?: string;
  name?: string;
};

export type AnimationCommand = {
  id?: string;
  name: string;
  length: number;
  loop: boolean;
  fps: number;
};

export type UpdateAnimationCommand = {
  id?: string;
  name?: string;
  newName?: string;
  length?: number;
  loop?: boolean;
  fps?: number;
};

export type DeleteAnimationCommand = {
  id?: string;
  name?: string;
};

export type KeyframeCommand = {
  clip: string;
  clipId?: string;
  bone: string;
  channel: 'rot' | 'pos' | 'scale';
  keys: { time: number; value: Vec3; interp?: 'linear' | 'step' | 'catmullrom' }[];
};

export interface EditorPort {
  createProject: (
    name: string,
    formatId: string,
    kind: FormatKind,
    options?: { confirmDiscard?: boolean; dialog?: Record<string, unknown>; confirmDialog?: boolean }
  ) => ToolError | null;
  importTexture: (params: ImportTextureCommand) => ToolError | null;
  updateTexture: (params: UpdateTextureCommand) => ToolError | null;
  deleteTexture: (params: DeleteTextureCommand) => ToolError | null;
  readTexture: (params: ReadTextureCommand) => { result?: TextureSource; error?: ToolError };
  addBone: (params: BoneCommand) => ToolError | null;
  updateBone: (params: UpdateBoneCommand) => ToolError | null;
  deleteBone: (params: DeleteBoneCommand) => ToolError | null;
  addCube: (params: CubeCommand) => ToolError | null;
  updateCube: (params: UpdateCubeCommand) => ToolError | null;
  deleteCube: (params: DeleteCubeCommand) => ToolError | null;
  createAnimation: (params: AnimationCommand) => ToolError | null;
  updateAnimation: (params: UpdateAnimationCommand) => ToolError | null;
  deleteAnimation: (params: DeleteAnimationCommand) => ToolError | null;
  setKeyframes: (params: KeyframeCommand) => ToolError | null;
  renderPreview: (params: RenderPreviewPayload) => { result?: RenderPreviewResult; error?: ToolError };
  writeFile: (path: string, contents: string) => ToolError | null;
  listTextures: () => TextureStat[];
}
