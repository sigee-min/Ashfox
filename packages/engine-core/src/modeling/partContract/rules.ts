import { MODEL_PART_KINDS } from '../../model';
import type {
  GeometryPartSpec,
  PartKind,
  PartSpec
} from './types';

export const PART_KINDS = MODEL_PART_KINDS;

export const PART_CONTRACT_LIMITS = Object.freeze({
  maxIdLength: 64,
  maxPartsPerBatch: 64,
  maxPartsPerDocument: 1_024,
  maxSegmentPoints: 8,
  maxAbsoluteCoordinate: 16_384,
  maxAxisSpan: 256,
  maxExtent: 128,
  maxOccupancyCellsPerPart: 131_072,
  maxOccupancyCellsPerBatch: 524_288,
  maxOccupancyCellsPerDocument: 2_097_152
});

export const PART_ID_PATTERN_SOURCE =
  '^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$';

const ID_PATTERN = new RegExp(PART_ID_PATTERN_SOURCE);
const BASE_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const EYE_GEOMETRY_TOKENS = new Set([
  'eye',
  'eyes',
  'eyeball',
  'eyeballs',
  'iris',
  'irises',
  'pupil',
  'pupils',
  'glint',
  'glints'
]);

export const PART_AXES = ['x', 'y', 'z'] as const;
export const PART_FACES = [
  'north',
  'south',
  'east',
  'west',
  'up',
  'down'
] as const;
export const PART_PROFILES = ['soft', 'balanced', 'hard'] as const;
export const FEATURE_MOTIFS = ['eye'] as const;
export const PLATE_PLANES = ['xy', 'xz', 'yz'] as const;
export const COMMON_PART_KEYS = [
  'kind',
  'partId',
  'parentPartId',
  'materialId',
  'joint',
  'attachment'
] as const;
export const PART_KIND_KEYS: Readonly<
  Record<PartKind, readonly string[]>
> = {
  mass: ['center', 'radii', 'profile'],
  segment: ['points', 'radii', 'profile'],
  plate: ['plane', 'origin', 'outline', 'thickness'],
  radial: ['axis', 'center', 'outerRadius', 'innerRadius', 'depth'],
  feature: ['motif', 'face', 'anchor', 'size']
};

export const isPartId = (value: unknown): value is string =>
  typeof value === 'string' &&
  value.length > 0 &&
  value.length <= PART_CONTRACT_LIMITS.maxIdLength &&
  ID_PATTERN.test(value);

export const isPartBaseColor = (value: unknown): value is string =>
  typeof value === 'string' && BASE_COLOR_PATTERN.test(value);

export const describesEyeGeometry = (partId: string): boolean =>
  partId
    .split(/[._-]/u)
    .some((token) => EYE_GEOMETRY_TOKENS.has(token));

export const isGeometryPartSpec = (
  part: PartSpec
): part is GeometryPartSpec => part.kind !== 'feature';
