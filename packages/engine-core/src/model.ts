import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

import type {
  AuthoringProfile
} from './authoring/authoringTypes';

export const PROJECT_DOCUMENT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.projectDocument;

// Delivery-target compatibility version for exported ashfox.generic assets.
// It is intentionally independent from internal persistence contracts.
export const ASHFOX_GENERIC_FORMAT_VERSION = '1' as const;

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
export const SURFACE_PIXEL_DENSITIES = [1, 2, 4] as const;
export type SurfacePixelDensity =
  (typeof SURFACE_PIXEL_DENSITIES)[number];

export const isSurfacePixelDensity = (
  value: unknown
): value is SurfacePixelDensity =>
  typeof value === 'number' &&
  SURFACE_PIXEL_DENSITIES.includes(value as SurfacePixelDensity);

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface MinecraftResourceLocation {
  namespace: string;
  path: string;
}

export interface GenericFormatProfile {
  id: 'ashfox.generic';
  version: typeof ASHFOX_GENERIC_FORMAT_VERSION;
}

export interface MinecraftJavaBlockFormatProfile {
  id: 'minecraft.java_block';
  minecraftVersion: '1.21.5' | '1.21.11' | '26.1' | '26.2';
  resourcePackFormat: 55 | 75 | 84 | 88;
  namespace: string;
  modelPath: string;
  modelKind: 'block';
  parent?: string;
  ambientOcclusion?: boolean;
  guiLight?: 'front' | 'side';
}

export interface MinecraftBedrockFormatProfile {
  id: 'minecraft.bedrock';
  minecraftVersion: '1.21.130' | '1.26.0' | '1.26.30';
  geometryFormatVersion: '1.21.0';
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
  minecraftVersion: '1.21.5' | '1.21.11' | '26.1';
  geometryFormatVersion: '1.12.0';
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
  surfacePixelDensity: SurfacePixelDensity;
  coordinateSystem: {
    up: 'y';
    handedness: 'right';
    unit: 'pixel' | 'block' | 'meter';
    rotationUnit: 'degree';
    rotationOrder: 'xyz';
  };
}

export type ProjectForwardDirection =
  | 'north'
  | 'south'
  | 'east'
  | 'west';

export type ProjectSymmetry =
  | {
      kind: 'bilateral';
      /** Twice the bilateral reflection-plane coordinate on the lattice. */
      planeTwice: number;
    }
  | { kind: 'asymmetric' };

export type ProjectGrounding =
  | 'grounded'
  | 'airborne'
  | 'free';

export type ProjectReferenceKind = 'image' | 'text' | 'model';

export interface ProjectReferenceObservation {
  id: string;
  kind: ProjectReferenceKind;
  description: string;
  cues: readonly string[];
  contentHash?: string;
}

export interface ProjectIntent {
  subject: string;
  forward: ProjectForwardDirection;
  grounding: ProjectGrounding;
  symmetry: ProjectSymmetry;
  /** Human/agent review criteria. Their meaning is not machine-validated. */
  features: readonly string[];
  /** Auditable observations used to route and review authoring authorities. */
  references?: readonly ProjectReferenceObservation[];
}

export interface Transform {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  pivot: Vec3;
}

export const MODEL_PART_KINDS = [
  'mass',
  'segment',
  'plate',
  'radial',
  'feature'
] as const;
export const MODEL_GEOMETRY_PRIMITIVES = [
  'mass',
  'segment',
  'plate',
  'radial'
] as const;
export type ModelPartKind = (typeof MODEL_PART_KINDS)[number];
export type ModelGeometryPrimitive =
  (typeof MODEL_GEOMETRY_PRIMITIVES)[number];

export type GeneratedPartJoint =
  | { kind: 'fixed' }
  | { kind: 'hinge'; axis: 'x' | 'y' | 'z' }
  | { kind: 'ball' };

export type ModelPartLatticeVec2 = readonly [number, number];
export type ModelPartLatticeVec3 = readonly [number, number, number];
export type ModelPartFace =
  | 'north'
  | 'south'
  | 'east'
  | 'west'
  | 'up'
  | 'down';
export type ModelPartProfile = 'soft' | 'balanced' | 'hard';
export type ModelMassProfile = 'block' | ModelPartProfile;
export type ModelFeatureMotif = 'eye' | 'nose' | 'mouth' | 'patch';
export type ModelEyeGlyph = 'square' | 'slit';
export type ModelNoseGlyph = 'dot' | 'snout';
export type ModelMouthGlyph = 'neutral' | 'fang' | 'beak';
export type ModelFeatureGlyph =
  | ModelEyeGlyph
  | ModelNoseGlyph
  | ModelMouthGlyph;

export interface ModelPartAttachment {
  parentAnchor: ModelPartLatticeVec3;
  partAnchor: ModelPartLatticeVec3;
}

interface ModelPartSpecBase {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  joint: GeneratedPartJoint;
  attachment: ModelPartAttachment | null;
}

export interface ModelMassPartSpec extends ModelPartSpecBase {
  kind: 'mass';
  center: ModelPartLatticeVec3;
  radii: ModelPartLatticeVec3;
  profile: ModelMassProfile;
}

export interface ModelSegmentPartSpec extends ModelPartSpecBase {
  kind: 'segment';
  points: readonly ModelPartLatticeVec3[];
  radii: readonly ModelPartLatticeVec3[];
  profile: ModelPartProfile;
}

export interface ModelPlatePartSpec extends ModelPartSpecBase {
  kind: 'plate';
  plane: 'xy' | 'xz' | 'yz';
  origin: ModelPartLatticeVec3;
  outline: readonly ModelPartLatticeVec2[];
  thickness: number;
}

export interface ModelRadialPartSpec extends ModelPartSpecBase {
  kind: 'radial';
  axis: 'x' | 'y' | 'z';
  center: ModelPartLatticeVec3;
  outerRadius: number;
  innerRadius: number;
  depth: number;
}

export interface ModelFeaturePartSpec
  extends Omit<ModelPartSpecBase, 'joint' | 'attachment'> {
  kind: 'feature';
  joint: { kind: 'fixed' };
  attachment: null;
  motif: ModelFeatureMotif;
  glyph?: ModelFeatureGlyph;
  face: ModelPartFace;
  anchor: ModelPartLatticeVec3;
  size: ModelPartLatticeVec2;
}

export type ModelPartSpec =
  | ModelMassPartSpec
  | ModelSegmentPartSpec
  | ModelPlatePartSpec
  | ModelRadialPartSpec
  | ModelFeaturePartSpec;

export interface ModelPartMaterial {
  id: string;
  baseColor: string;
}

export interface ConstrainedModelRecipe {
  authority: 'ashfox.part-compiler';
  parts: readonly ModelPartSpec[];
  materials: readonly ModelPartMaterial[];
}

export interface GeneratedNodeProvenance {
  authority: 'ashfox.part-compiler';
  role: 'bone' | 'geometry';
  partId: string;
  parentPartId: string | null;
  materialId: string;
  primitive: ModelGeometryPrimitive;
  joint: GeneratedPartJoint;
}

export interface NodeBase {
  id: EntityId;
  name: string;
  parentId: EntityId | null;
  transform: Transform;
  visible: boolean;
  tags?: readonly string[];
  generation?: GeneratedNodeProvenance;
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
  baseColor: string;
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

export interface TextureCanvasDetail {
  id: EntityId;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureRaster {
  background: string;
  canvasDetails: readonly TextureCanvasDetail[];
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
  intent?: ProjectIntent;
  authoringProfile?: AuthoringProfile;
  modeling?: ConstrainedModelRecipe;
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
