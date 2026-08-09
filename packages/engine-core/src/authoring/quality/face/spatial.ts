import { cellKey, parseCellKey } from '../../../modeling/lattice';
import type { CompiledPartState } from '../../../modeling/invariants';
import type { FeaturePartSpec, PartSpec } from '../../../modeling/part';
import {
  surfaceFeaturePixels,
  surfaceFeaturePlane
} from '../../../modeling/surface/feature';
import type { ProjectSpatialFrame } from '../../../project/frame';

const axisIndex = (frame: ProjectSpatialFrame): 0 | 2 =>
  frame.direction === 'east' || frame.direction === 'west' ? 0 : 2;

const forwardSign = (frame: ProjectSpatialFrame): -1 | 1 =>
  frame.forward[axisIndex(frame)] as -1 | 1;

export const forwardSurfacePlane = (
  part: CompiledPartState,
  frame: ProjectSpatialFrame
): number | null => {
  const index = axisIndex(frame);
  const sign = forwardSign(frame);
  const coordinates = [...part.occupancy.cells].map((key) => {
    const point = parseCellKey(key);
    const coordinate = index === 0 ? point.x : point.z;
    return sign === 1 ? coordinate + 1 : -coordinate;
  });
  return coordinates.length === 0 ? null : Math.max(...coordinates);
};

export const featureForwardPlane = (
  feature: FeaturePartSpec,
  frame: ProjectSpatialFrame
): number => surfaceFeaturePlane(feature) * forwardSign(frame);

export const featureCells = (
  feature: FeaturePartSpec
): ReadonlySet<`${number},${number},${number}`> => new Set(
  surfaceFeaturePixels(feature).map((pixel) => cellKey(pixel.boundaryCell))
);

export const featureUsesForwardOuterSurface = (
  feature: FeaturePartSpec,
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): boolean => {
  if (feature.face !== frame.direction || feature.parentPartId === null) {
    return false;
  }
  const parent = compiled.get(feature.parentPartId);
  const parentPlane = parent ? forwardSurfacePlane(parent, frame) : null;
  return parentPlane !== null &&
    featureForwardPlane(feature, frame) === parentPlane &&
    [...featureCells(feature)].every((key) => parent?.occupancy.cells.has(key));
};

const projectedCellKey = (
  key: `${number},${number},${number}`,
  frame: ProjectSpatialFrame
): `${number},${number}` => {
  const point = parseCellKey(key);
  const lateral = frame.lateralAxis === 'x' ? point.x : point.z;
  return `${lateral},${point.y}`;
};

export const projectedFootprint = (
  parts: readonly PartSpec[],
  compiled: ReadonlyMap<string, CompiledPartState>,
  frame: ProjectSpatialFrame
): ReadonlySet<`${number},${number}`> => new Set(parts.flatMap((part) => {
  const cells = part.kind === 'feature'
    ? featureCells(part)
    : compiled.get(part.partId)?.occupancy.cells ?? new Set();
  return [...cells].map((key) => projectedCellKey(key, frame));
}));

export const partCells = (
  part: PartSpec,
  compiled: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<`${number},${number},${number}`> => part.kind === 'feature'
  ? featureCells(part)
  : compiled.get(part.partId)?.occupancy.cells ?? new Set();

export const cellCenterAlong = (
  key: `${number},${number},${number}`,
  direction: ProjectSpatialFrame['up']
): number => {
  const point = parseCellKey(key);
  return (point.x + 0.5) * direction[0] +
    (point.y + 0.5) * direction[1] +
    (point.z + 0.5) * direction[2];
};

export const footprintsOverlap = (
  left: ReadonlySet<`${number},${number}`>,
  right: ReadonlySet<`${number},${number}`>
): boolean => [...left].some((key) => right.has(key));
