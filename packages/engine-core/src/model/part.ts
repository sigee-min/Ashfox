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
