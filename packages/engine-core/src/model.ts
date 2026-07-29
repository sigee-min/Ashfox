export const PROJECT_DOCUMENT_SCHEMA_VERSION = 1 as const;

export type ProjectId = string;
export type EntityId = string;
export type AssetId = string;
export type ClipId = string;
export type ChannelId = string;
export type KeyframeId = string;
export type Revision = string;
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type UvRect = readonly [number, number, number, number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MinecraftResourceLocation {
  namespace: string;
  path: string;
}

export interface GenericFormatProfile {
  id: 'ashfox.generic';
  version: '1';
}

export interface MinecraftJavaBlockFormatProfile {
  id: 'minecraft.java_block';
  version: string;
  namespace: string;
  modelPath: string;
  modelKind: 'block' | 'item';
  parent?: string;
  ambientOcclusion?: boolean;
  guiLight?: 'front' | 'side';
}

export interface MinecraftBedrockFormatProfile {
  id: 'minecraft.bedrock';
  version: string;
  animationFormatVersion: '1.8.0';
  namespace: string;
  modelPath: string;
  animationPath: string;
  geometryKind: 'entity' | 'block';
  geometryIdentifier: string;
  visibleBounds?: {
    width: number;
    height: number;
    offset: Vec3;
  };
}

export interface MinecraftJavaGeckoLib5FormatProfile {
  id: 'minecraft.java.geckolib5';
  version: '5';
  minecraftVersion: string;
  geometryFormatVersion: string;
  animationFormatVersion: '1.8.0';
  namespace: string;
  assetKind: 'entity' | 'block' | 'item';
  modelPath: string;
  animationPath: string;
  geometryIdentifier: string;
  visibleBounds?: {
    width: number;
    height: number;
    offset: Vec3;
  };
}

export interface Gltf2FormatProfile {
  id: 'gltf.2';
  version: '2.0';
  container: 'gltf' | 'glb';
  imageStorage: 'external' | 'embedded';
  modelPath: string;
  copyright?: string;
}

export type ProjectFormatProfile =
  | GenericFormatProfile
  | MinecraftJavaBlockFormatProfile
  | MinecraftBedrockFormatProfile
  | MinecraftJavaGeckoLib5FormatProfile
  | Gltf2FormatProfile;

export interface ProjectSettings {
  textureResolution: {
    width: number;
    height: number;
  };
  uvPixelsPerUnit?: number;
  coordinateSystem: {
    up: 'y';
    handedness: 'right';
    unit: 'pixel' | 'block' | 'meter';
    rotationUnit: 'degree';
    rotationOrder: 'xyz';
  };
}

export interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  pivot: Vec3;
}

export interface NodeBase {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform: Transform;
  visible: boolean;
  tags?: readonly string[];
}

export interface BoneNode extends NodeBase {
  kind: 'bone';
}

export interface LocatorNode extends NodeBase {
  kind: 'locator';
  ignoreInheritedScale?: boolean;
}

export const CUBE_FACE_DIRECTIONS = [
  'north',
  'south',
  'east',
  'west',
  'up',
  'down'
] as const;

export type CubeFaceDirection = (typeof CUBE_FACE_DIRECTIONS)[number];
export type CubeFaceRotation = 0 | 90 | 180 | 270;

export interface CubeFace {
  enabled: boolean;
  textureId: AssetId | null;
  uv?: UvRect;
  rotation?: CubeFaceRotation;
  cullFace?: CubeFaceDirection;
  tintIndex?: number;
  materialInstance?: string;
}

export type CubeFaces = {
  readonly [TDirection in CubeFaceDirection]: CubeFace;
};

export interface CubeNode extends NodeBase {
  kind: 'cube';
  bounds: {
    from: Vec3;
    to: Vec3;
  };
  inflate: number;
  mirror: boolean;
  boxUv: boolean;
  uvOffset?: Vec2;
  rescale?: boolean;
  shade?: boolean;
  lightEmission?: number;
  faces: CubeFaces;
}

export interface MeshVertex {
  id: EntityId;
  position: Vec3;
}

export interface MeshFace {
  id: EntityId;
  vertexIds: readonly EntityId[];
  uv: Readonly<Partial<Record<EntityId, Vec2>>>;
  textureId: AssetId | null;
}

export interface MeshNode extends NodeBase {
  kind: 'mesh';
  vertices: Readonly<Record<EntityId, MeshVertex>>;
  faces: Readonly<Record<EntityId, MeshFace>>;
  uvPolicy?: {
    symmetryAxis?: 'none' | 'x' | 'y' | 'z';
    texelDensity?: number;
    padding?: number;
  };
}

export type SceneNode = BoneNode | CubeNode | MeshNode | LocatorNode;

export interface SceneGraph {
  roots: readonly EntityId[];
  nodes: Readonly<Record<EntityId, SceneNode>>;
}

export interface BlobRef {
  bucket: string;
  key: string;
  contentType: string;
  contentHash: string;
  byteLength?: number;
}

export interface MinecraftTextureBinding {
  key: string;
  resource: MinecraftResourceLocation;
  extension: 'png';
  particle?: boolean;
}

export interface TextureRasterRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface TextureRaster {
  background: string;
  rectangles: readonly TextureRasterRectangle[];
  pattern?: MinecraftShadedUvPattern;
}

export interface MinecraftShadedUvRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  seed: number;
}

export interface MinecraftShadedUvPattern {
  kind: 'minecraft_shaded_uv';
  intensity: number;
  edge: number;
  noise: number;
  lightDir: 'tl_br' | 'tr_bl' | 'top_bottom' | 'left_right';
  regions: readonly MinecraftShadedUvRegion[];
}

export interface TextureAsset {
  id: AssetId;
  name: string;
  width: number;
  height: number;
  source: BlobRef;
  visible: boolean;
  sampling: 'nearest' | 'linear';
  colorSpace: 'srgb' | 'linear';
  renderMode: 'default' | 'emissive' | 'additive' | 'layered';
  renderSides: 'auto' | 'front' | 'double';
  atlasMode?: 'generate' | 'preserve';
  pbrChannel?: 'color' | 'normal' | 'height' | 'mer';
  minecraft?: MinecraftTextureBinding;
  raster?: TextureRaster;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

export type TransformChannelProperty = 'position' | 'rotation' | 'scale';
export type KeyframeInterpolation = 'linear' | 'step' | 'catmullrom';
export type AnimationLoopMode = 'once' | 'loop' | 'hold_on_last_frame';

export interface MolangExpression {
  kind: 'molang';
  source: string;
}

export type AnimationScalar = number | MolangExpression;
export type AnimationVec3 = readonly [AnimationScalar, AnimationScalar, AnimationScalar];

export interface KeyframeEasing {
  type: string;
  arguments?: readonly AnimationScalar[];
}

export interface TransformKeyframe {
  id: KeyframeId;
  timeSeconds: number;
  value: AnimationVec3;
  preValue?: AnimationVec3;
  postValue?: AnimationVec3;
  interpolation: KeyframeInterpolation;
  easing?: KeyframeEasing;
}

export interface TransformChannel {
  id: ChannelId;
  targetNodeId: EntityId;
  property: TransformChannelProperty;
  rotationSpace?: 'bone' | 'entity';
  keys: readonly TransformKeyframe[];
}

export interface AnimationTriggerKeyframe<TValue> {
  id: KeyframeId;
  timeSeconds: number;
  value: TValue;
}

export interface AnimationEffect {
  effect: string;
  locatorId?: EntityId;
  preEffectScript?: MolangExpression;
  bindToActor?: boolean;
}

export type AnimationEffectValue =
  | AnimationEffect
  | readonly AnimationEffect[];

export interface SoundTriggerTrack {
  id: ChannelId;
  type: 'sound';
  keys: readonly AnimationTriggerKeyframe<AnimationEffectValue>[];
}

export interface ParticleTriggerTrack {
  id: ChannelId;
  type: 'particle';
  keys: readonly AnimationTriggerKeyframe<AnimationEffectValue>[];
}

export interface TimelineTriggerTrack {
  id: ChannelId;
  type: 'timeline';
  keys: readonly AnimationTriggerKeyframe<string | readonly string[]>[];
}

export type AnimationTriggerTrack =
  | SoundTriggerTrack
  | ParticleTriggerTrack
  | TimelineTriggerTrack;

export interface AnimationClip {
  id: ClipId;
  name: string;
  durationSeconds: number;
  fps: number;
  loop: AnimationLoopMode;
  startDelay?: MolangExpression;
  loopDelay?: MolangExpression;
  animationTimeUpdate?: MolangExpression;
  blendWeight?: AnimationScalar;
  overridePreviousAnimation?: boolean;
  channels: Readonly<Record<ChannelId, TransformChannel>>;
  triggers: Readonly<Record<ChannelId, AnimationTriggerTrack>>;
}

export interface ProjectDocument {
  schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  id: ProjectId;
  name: string;
  revision: Revision;
  formatProfile: ProjectFormatProfile;
  settings: ProjectSettings;
  scene: SceneGraph;
  textures: Readonly<Record<AssetId, TextureAsset>>;
  animations: Readonly<Record<ClipId, AnimationClip>>;
  createdAt: string;
  updatedAt: string;
}

export const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  pivot: [0, 0, 0]
};
