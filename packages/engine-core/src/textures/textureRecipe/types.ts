import type {
  CubeFaceDirection,
  ProjectDocument,
  TextureCanvasDetail
} from '../../model';
import type {
  GeneratedSurfaceMarking,
  GeneratedSurfacePattern
} from '../appearance/authority';
import type {
  GeneratedSurfaceTonePolicy
} from '../appearance';
import type { UvAtlasPlacement } from '../uvAtlas';

export interface TextureDerivationSuccess {
  ok: true;
  document: ProjectDocument;
  width: number;
  height: number;
  pixelsPerBlock: number;
  texelsPerModelUnit: number;
  changedSettings: boolean;
  changedNodeIds: readonly string[];
  changedTextureIds: readonly string[];
}

export interface TextureDerivationFailure {
  ok: false;
  message: string;
  path: string;
  expected?: string;
}

export type TextureDerivationResult =
  | TextureDerivationSuccess
  | TextureDerivationFailure;

export interface FaceTarget {
  nodeId: string;
  direction: CubeFaceDirection;
  textureId: string;
  pattern?: GeneratedSurfacePattern;
  markings?: readonly GeneratedSurfaceMarking[];
}

export interface AtlasPlan {
  width: number;
  height: number;
  placementsByTexture: Map<string, UvAtlasPlacement<FaceTarget>[]>;
}

export interface TextureCompositionRegion {
  nodeId: string;
  face: CubeFaceDirection;
  tonePolicy: GeneratedSurfaceTonePolicy;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  pattern?: GeneratedSurfacePattern;
  markings?: readonly GeneratedSurfaceMarking[];
}

export interface TextureComposition {
  background: string;
  generated: boolean;
  gutter: number;
  regions: readonly TextureCompositionRegion[];
  canvasDetails: readonly TextureCanvasDetail[];
}
