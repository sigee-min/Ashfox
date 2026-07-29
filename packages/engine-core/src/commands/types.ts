import type {
  AssetId,
  AnimationEffect,
  AnimationLoopMode,
  AnimationVec3,
  EntityId,
  KeyframeInterpolation,
  ProjectDocument,
  ProjectId,
  Revision,
  TransformChannelProperty,
  Transform,
  UvRect,
  Vec2,
  Vec3
} from '../model';
import type { InvariantFinding } from '../validation';

export type CommandSource = 'web' | 'agent' | 'import' | 'system';
export type SceneAxis = 'x' | 'y' | 'z';
export type AlignmentMode = 'minimum' | 'center' | 'maximum';
export type ExportPreset =
  | 'gltf'
  | 'glb'
  | 'bedrock'
  | 'geckolib5'
  | 'java';

export interface BoneCreateInput {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform?: Partial<Transform>;
}

export interface CubeCreateInput {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  bounds: {
    from: Vec3;
    to: Vec3;
  };
  transform?: Partial<Transform>;
  textureId?: AssetId | null;
  faceUv?: UvRect;
  inflate?: number;
  mirror?: boolean;
  boxUv?: boolean;
  uvOffset?: Vec2;
  shade?: boolean;
}

export interface CubeDuplicateInput {
  sourceId: EntityId;
  id: EntityId;
  name?: string;
  offset?: Vec3;
}

export interface TransformKeyInput {
  id: string;
  timeSeconds: number;
  value: AnimationVec3;
  interpolation?: KeyframeInterpolation;
}

export interface TransformChannelInput {
  id: string;
  targetNodeId: EntityId;
  property: TransformChannelProperty;
  keys: readonly TransformKeyInput[];
}

export interface AnimationEffectTriggerInput {
  id: string;
  type: 'sound' | 'particle';
  keys: readonly {
    id: string;
    timeSeconds: number;
    value: AnimationEffect;
  }[];
}

export interface AnimationTimelineTriggerInput {
  id: string;
  type: 'timeline';
  keys: readonly {
    id: string;
    timeSeconds: number;
    value: string;
  }[];
}

export type AnimationTriggerInput =
  | AnimationEffectTriggerInput
  | AnimationTimelineTriggerInput;

export interface CommandPayloadMap {
  'project.rename': {
    name: string;
  };
  'project.target.set': {
    target: ExportPreset;
    namespace: string;
    modelPath: string;
  };
  'scene.bones.create': {
    bones: readonly BoneCreateInput[];
  };
  'scene.nodes.transform': {
    nodeIds: readonly EntityId[];
    transform: Partial<Transform>;
  };
  'scene.nodes.visibility': {
    nodeIds: readonly EntityId[];
    visible: boolean;
  };
  'scene.cubes.create': {
    cubes: readonly CubeCreateInput[];
  };
  'scene.nodes.delete': {
    nodeIds: readonly EntityId[];
  };
  'scene.cubes.duplicate': {
    copies: readonly CubeDuplicateInput[];
  };
  'scene.cubes.mirror': {
    nodeIds: readonly EntityId[];
    axis: SceneAxis;
  };
  'scene.cubes.repeat': {
    nodeIds: readonly EntityId[];
    count: number;
    step: Vec3;
    idPrefix: string;
  };
  'scene.nodes.align': {
    nodeIds: readonly EntityId[];
    axis: SceneAxis;
    mode: AlignmentMode;
  };
  'scene.nodes.pivot': {
    nodeIds: readonly EntityId[];
    pivot: Vec3;
  };
  'scene.nodes.reparent': {
    nodeIds: readonly EntityId[];
    parentId: EntityId | null;
  };
  'scene.cubes.uv.fit': {
    nodeIds: readonly EntityId[];
    padding: number;
  };
  'scene.cubes.material': {
    nodeIds: readonly EntityId[];
    textureId: AssetId | null;
    shade?: boolean;
    lightEmission?: number;
  };
  'textures.preview.set': {
    textureId: AssetId;
    color: string;
  };
  'textures.rename': {
    textureId: AssetId;
    name: string;
  };
  'textures.raster.set': {
    textureId: AssetId;
    background: string;
    atlasMode?: 'generate' | 'preserve';
    rectangles: readonly {
      x: number;
      y: number;
      width: number;
      height: number;
      color: string;
    }[];
  };
  'textures.uvAtlas.generate': {
    target:
      | { scope: 'all' }
      | { nodeIds: readonly EntityId[] };
    pixelsPerBlock: number;
    padding: number;
    maxResolution: number;
    seed: number;
    intensity: number;
    edge: number;
    noise: number;
    lightDir: 'tl_br' | 'tr_bl' | 'top_bottom' | 'left_right';
  };
  'animation.clip.upsert': {
    id: string;
    name: string;
    durationSeconds: number;
    fps: number;
    loop: AnimationLoopMode;
  };
  'animation.channels.upsert': {
    clipId: string;
    channels: readonly TransformChannelInput[];
  };
  'animation.triggers.upsert': {
    clipId: string;
    triggers: readonly AnimationTriggerInput[];
  };
  'animation.channels.phase': {
    clipId: string;
    channelIds: readonly string[];
    offsetSeconds: number;
    wrap: boolean;
  };
  'animation.channels.mirror': {
    clipId: string;
    channelIds: readonly string[];
    axis: SceneAxis;
  };
  'animation.clip.closeLoop': {
    clipId: string;
    channelIds: readonly string[];
  };
  'animation.clip.delete': {
    clipId: string;
  };
}

export type CommandName = keyof CommandPayloadMap;

export type ProjectCommandOperation = {
  [TName in CommandName]: {
    name: TName;
    payload: CommandPayloadMap[TName];
  };
}[CommandName];

export interface CommandEnvelope<TName extends CommandName> {
  commandId: string;
  idempotencyKey: string;
  projectId: ProjectId;
  actorId: string;
  source: CommandSource;
  baseRevision: Revision;
  name: TName;
  payload: CommandPayloadMap[TName];
  traceId?: string;
}

export type ProjectCommand = {
  [TName in CommandName]: CommandEnvelope<TName>;
}[CommandName];

export interface CommandBatch {
  batchId: string;
  baseRevision: Revision;
  operations: readonly ProjectCommandOperation[];
}

export type InvalidatedArea =
  | 'scene'
  | 'textures'
  | 'uv'
  | 'animations'
  | 'validation'
  | 'preview';

export interface CommandEffects {
  createdEntityIds: readonly EntityId[];
  changedEntityIds: readonly EntityId[];
  removedEntityIds: readonly EntityId[];
  invalidated: readonly InvalidatedArea[];
}

export interface CommandReceipt {
  schemaVersion: 1;
  commandId: string;
  projectId: ProjectId;
  actorId: string;
  source: CommandSource;
  summary: string;
  beforeRevision: Revision;
  revision: Revision;
  completedAt: string;
  durationMs: number;
  effects: CommandEffects;
  findings: readonly InvariantFinding[];
}

export type CommandErrorCode =
  | 'invalid_batch'
  | 'invalid_payload'
  | 'invalid_state'
  | 'revision_mismatch'
  | 'no_change';

export interface CommandError {
  code: CommandErrorCode;
  message: string;
  path?: string;
  expected?: string;
}

export interface CommandBatchSuccess {
  ok: true;
  document: ProjectDocument;
  summary: string;
  effects: CommandEffects;
  findings: readonly InvariantFinding[];
}

export interface CommandBatchFailure {
  ok: false;
  currentRevision: Revision;
  error: CommandError;
  findings?: readonly InvariantFinding[];
}

export type CommandBatchResult =
  | CommandBatchSuccess
  | CommandBatchFailure;
