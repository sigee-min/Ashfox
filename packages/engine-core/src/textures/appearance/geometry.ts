/** Coordinate conversion shared by appearance planning and raster emission. */
import type {
  CubeFaceDirection,
  CubeNode,
  ModelFeaturePartSpec,
  ProjectDocument
} from '../../model';
import { cellKey, worldToLattice } from '../../modeling/lattice';
import {
  orientedSurfaceFeatureRect,
  surfaceFeaturePlane
} from '../../modeling/surface/feature';
import type { CellKey, LatticeBounds } from '../../modeling/contract';
import type { SurfaceAppearanceProtectedRegion } from './contract';

export const compiledLatticeBounds = (
  document: ProjectDocument,
  cube: CubeNode
): LatticeBounds | null => {
  try {
    const density = document.settings.surfacePixelDensity;
    return {
      min: {
        x: worldToLattice(cube.bounds.from[0], density),
        y: worldToLattice(cube.bounds.from[1], density),
        z: worldToLattice(cube.bounds.from[2], density)
      },
      max: {
        x: worldToLattice(cube.bounds.to[0], density),
        y: worldToLattice(cube.bounds.to[1], density),
        z: worldToLattice(cube.bounds.to[2], density)
      }
    };
  } catch {
    return null;
  }
};

export const latticeBoundsVolume = (bounds: LatticeBounds): number =>
  (bounds.max.x - bounds.min.x) *
  (bounds.max.y - bounds.min.y) *
  (bounds.max.z - bounds.min.z);

export const combinedLatticeBounds = (
  bounds: readonly LatticeBounds[]
): LatticeBounds => ({
  min: {
    x: Math.min(...bounds.map((entry) => entry.min.x)),
    y: Math.min(...bounds.map((entry) => entry.min.y)),
    z: Math.min(...bounds.map((entry) => entry.min.z))
  },
  max: {
    x: Math.max(...bounds.map((entry) => entry.max.x)),
    y: Math.max(...bounds.map((entry) => entry.max.y)),
    z: Math.max(...bounds.map((entry) => entry.max.z))
  }
});

export const addLatticeBoundsCells = (
  bounds: LatticeBounds,
  occupancy: Set<CellKey>
): void => {
  for (let x = bounds.min.x; x < bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y < bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z < bounds.max.z; z += 1) {
        occupancy.add(cellKey({ x, y, z }));
      }
    }
  }
};

export const surfaceFacePlane = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection
): number => {
  switch (direction) {
    case 'north': return bounds.min.z;
    case 'south': return bounds.max.z;
    case 'east': return bounds.max.x;
    case 'west': return bounds.min.x;
    case 'up': return bounds.max.y;
    case 'down': return bounds.min.y;
  }
};

export const generatedPatternOrigin = (
  cube: CubeNode,
  direction: CubeFaceDirection,
  texelsPerModelUnit: number
): readonly [number, number] => {
  const from = cube.bounds.from.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  const to = cube.bounds.to.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  switch (direction) {
    case 'north': return [1 - to[0], 1 - to[1]];
    case 'south': return [from[0], 1 - to[1]];
    case 'east': return [1 - to[2], 1 - to[1]];
    case 'west': return [from[2], 1 - to[1]];
    case 'up': return [from[0], from[2]];
    case 'down': return [from[0], 1 - to[2]];
  }
};

export const protectedSurfaceRegions = (
  features: readonly ModelFeaturePartSpec[],
  partId: string,
  face: CubeFaceDirection,
  plane: number
): readonly SurfaceAppearanceProtectedRegion[] => features.flatMap(
  (feature) =>
    feature.parentPartId === partId &&
    feature.face === face &&
    feature.motif !== 'patch' &&
    surfaceFeaturePlane(feature) === plane
      ? [orientedSurfaceFeatureRect(feature)]
      : []
);
