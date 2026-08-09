import type {
  AssetId,
  EntityId,
  UvRect,
  Vec2,
  Vec3
} from './identity';
import type { GeneratedNodeProvenance } from './part';

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

export const IDENTITY_TRANSFORM: Transform = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  pivot: [0, 0, 0]
};
