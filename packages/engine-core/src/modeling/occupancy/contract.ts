import type {
  GeometryPartSpec,
  PartSpec
} from '../part';
import type {
  Cuboid,
  LatticePoint,
  OccupancyGrid
} from '../contract';

export const PART_OCCUPANCY_POLICY = {
  minimumRetainedNumerator: 1,
  minimumRetainedDenominator: 5,
  maximumAttachmentSnapDistanceBlocks: 2
} as const;

export interface PartOccupancyCanonicalizationMetric {
  partId: string;
  authoredCellCount: number;
  canonicalCellCount: number;
  trimmedCellCount: number;
  retainedFraction: number;
  maximumTrimDepthCells: number;
  canonicalAttachmentAnchor:
    | readonly [number, number, number]
    | null;
  attachmentSnapDistanceCells: number;
  trimmedByPartIds: readonly string[];
}

export interface CanonicalPartOccupancy {
  spec: GeometryPartSpec;
  /** Compiler-selected form before cross-part seam ownership. */
  authoredCuboids: readonly Cuboid[];
  /** Final emitted form after bounded parent/seam adjustment. */
  cuboids: readonly Cuboid[];
  authored: OccupancyGrid;
  canonical: OccupancyGrid;
  canonicalAttachmentAnchor: LatticePoint | null;
  metric: PartOccupancyCanonicalizationMetric;
}

export type CanonicalizePartOccupanciesResult =
  | {
      ok: true;
      parts: readonly CanonicalPartOccupancy[];
      features: readonly Extract<PartSpec, { kind: 'feature' }>[];
    }
  | { ok: false; path: string; message: string };

export type CanonicalizationFailure = Extract<
  CanonicalizePartOccupanciesResult,
  { ok: false }
>;
