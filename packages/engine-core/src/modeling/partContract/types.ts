import type {
  GeneratedPartJoint,
  ModelEyeGlyph,
  ModelFeatureGlyph,
  ModelFeaturePartSpec,
  ModelFeatureMotif,
  ModelMouthGlyph,
  ModelNoseGlyph,
  ModelMassProfile,
  ModelMassPartSpec,
  ModelPartAttachment,
  ModelPartFace,
  ModelPartKind,
  ModelPartLatticeVec2,
  ModelPartLatticeVec3,
  ModelPartMaterial,
  ModelPartProfile,
  ModelPartSpec,
  ModelPlatePartSpec,
  ModelRadialPartSpec,
  ModelSegmentPartSpec
} from '../../model';
import type { Axis } from '../types';

export type PartKind = ModelPartKind;
export type LatticeCoordinate = number;
export type LatticeVec2 = ModelPartLatticeVec2;
export type LatticeVec3 = ModelPartLatticeVec3;
export type PartAxis = Axis;
export type PartFace = ModelPartFace;
export type PartProfile = ModelPartProfile;
export type MassPartProfile = ModelMassProfile;
export type FeatureMotif = ModelFeatureMotif;
export type EyeGlyph = ModelEyeGlyph;
export type NoseGlyph = ModelNoseGlyph;
export type MouthGlyph = ModelMouthGlyph;
export type FeatureGlyph = ModelFeatureGlyph;

export type FixedPartJoint =
  Extract<GeneratedPartJoint, { kind: 'fixed' }>;
export type HingePartJoint =
  Extract<GeneratedPartJoint, { kind: 'hinge' }>;
export type BallPartJoint =
  Extract<GeneratedPartJoint, { kind: 'ball' }>;
export type PartJoint = GeneratedPartJoint;

export type PartAttachment = ModelPartAttachment;
export type MassPartSpec = ModelMassPartSpec;
export type SegmentPartSpec = ModelSegmentPartSpec;
export type PlatePartSpec = ModelPlatePartSpec;
export type RadialPartSpec = ModelRadialPartSpec;
export type FeaturePartSpec = ModelFeaturePartSpec;
export type EyeFeaturePartSpec = FeaturePartSpec & {
  motif: 'eye';
  glyph?: EyeGlyph;
};
export type NoseFeaturePartSpec = FeaturePartSpec & {
  motif: 'nose';
  glyph?: NoseGlyph;
};
export type MouthFeaturePartSpec = FeaturePartSpec & {
  motif: 'mouth';
  glyph?: MouthGlyph;
};
export type PartSpec = ModelPartSpec;
export type PartMaterialDefinition = ModelPartMaterial;

interface PartAuthoringBase {
  partId: string;
  parentPartId?: string | null;
  materialId?: string;
  joint?: PartJoint;
}

export interface MassPartAuthoringSpec extends PartAuthoringBase {
  kind: 'mass';
  center?: LatticeVec3;
  radii?: LatticeVec3;
  profile?: MassPartProfile;
}

export interface SegmentPartAuthoringSpec extends PartAuthoringBase {
  kind: 'segment';
  points?: readonly LatticeVec3[];
  radii?: LatticeVec3 | readonly LatticeVec3[];
  profile?: PartProfile;
}

export interface PlatePartAuthoringSpec extends PartAuthoringBase {
  kind: 'plate';
  plane?: PlatePartSpec['plane'];
  origin?: LatticeVec3;
  outline?: readonly LatticeVec2[];
  size?: LatticeVec2;
  thickness?: number;
}

export interface RadialPartAuthoringSpec extends PartAuthoringBase {
  kind: 'radial';
  axis?: PartAxis;
  center?: LatticeVec3;
  outerRadius?: number;
  innerRadius?: number;
  depth?: number;
}

export interface FeaturePartAuthoringSpec
  extends Omit<PartAuthoringBase, 'parentPartId' | 'joint'> {
  kind: 'feature';
  parentPartId?: string | null;
  joint?: FixedPartJoint;
  motif?: FeatureMotif;
  glyph?: FeatureGlyph;
  face?: PartFace;
  anchor?: LatticeVec3;
  size?: LatticeVec2;
}

export type PartAuthoringSpec =
  | MassPartAuthoringSpec
  | SegmentPartAuthoringSpec
  | PlatePartAuthoringSpec
  | RadialPartAuthoringSpec
  | FeaturePartAuthoringSpec;

export type GeometryPartSpec = Exclude<PartSpec, { kind: 'feature' }>;

export type PartContractIssueCode =
  | 'type'
  | 'required'
  | 'unknown-key'
  | 'enum'
  | 'id'
  | 'integer'
  | 'range'
  | 'length'
  | 'duplicate'
  | 'relationship'
  | 'geometry'
  | 'budget';

export interface PartContractIssue {
  path: string;
  code: PartContractIssueCode;
  message: string;
}

export type PartContractResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: readonly PartContractIssue[] };

export type UnknownRecord = Readonly<Record<string, unknown>>;

export interface ParsedCommon {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  joint: PartJoint;
  attachment: PartAttachment | null;
}

export interface ParsedPart {
  value: PartSpec | null;
  estimatedCells: number;
}
