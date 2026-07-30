import type {
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
  | 'geckolib5';

export interface ProjectCreateInput {
  id: ProjectId;
  name: string;
  target: ExportPreset;
  namespace: string;
  modelPath: string;
  createdAt: string;
}

export interface BoneCreateInput {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform?: Partial<Transform>;
}

export interface LocatorCreateInput {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform?: Partial<Transform>;
  ignoreInheritedScale?: boolean;
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
  baseColor?: string;
  inflate?: number;
}

export interface CubeDuplicateInput {
  sourceId: EntityId;
  id: EntityId;
  name?: string;
  offset?: Vec3;
}

export interface CubeGeometryUpdateInput {
  nodeId: EntityId;
  bounds?: {
    from: Vec3;
    to: Vec3;
  };
  inflate?: number;
}

export interface NodeRenameInput {
  nodeId: EntityId;
  name: string;
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
  'project.create': ProjectCreateInput;
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
  'scene.locators.create': {
    locators: readonly LocatorCreateInput[];
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
  'scene.cubes.geometry.update': {
    updates: readonly CubeGeometryUpdateInput[];
  };
  'scene.nodes.rename': {
    renames: readonly NodeRenameInput[];
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
  'scene.cubes.material': {
    nodeIds: readonly EntityId[];
    baseColor: string;
  };
  'textures.sync': Record<string, never>;
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
  'animation.tracks.delete': {
    clipId: string;
    tracks: readonly {
      kind: 'channel' | 'trigger';
      id: string;
    }[];
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
