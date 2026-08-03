import type {
  ModelPartFace
} from '../model';
import {
  cellKey,
  parseCellKey
} from './lattice';
import type {
  FeaturePartSpec
} from './partContract';
import type {
  Axis,
  CellKey,
  LatticePoint,
  OccupancyGrid
} from './types';

const AXIS_INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = {
  x: 0,
  y: 1,
  z: 2
};

export interface SurfaceFeatureAxes {
  normal: Axis;
  u: Axis;
  v: Axis;
  positive: boolean;
}

export interface SurfaceFeatureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SurfaceFeaturePixel {
  key: string;
  boundaryCell: LatticePoint;
  neighborCell: LatticePoint;
}

export interface SurfaceFeaturePlacementIssue {
  path: string;
  message: string;
}

export const surfaceFeatureAxes = (
  face: ModelPartFace
): SurfaceFeatureAxes => {
  switch (face) {
    case 'north':
      return { normal: 'z', u: 'x', v: 'y', positive: false };
    case 'south':
      return { normal: 'z', u: 'x', v: 'y', positive: true };
    case 'east':
      return { normal: 'x', u: 'z', v: 'y', positive: true };
    case 'west':
      return { normal: 'x', u: 'z', v: 'y', positive: false };
    case 'up':
      return { normal: 'y', u: 'x', v: 'z', positive: true };
    case 'down':
      return { normal: 'y', u: 'x', v: 'z', positive: false };
  }
};

const featurePlaneRect = (
  feature: FeaturePartSpec
): {
  minU: number;
  minV: number;
  maxU: number;
  maxV: number;
} => {
  const axes = surfaceFeatureAxes(feature.face);
  const anchorU = feature.anchor[AXIS_INDEX[axes.u]];
  const anchorV = feature.anchor[AXIS_INDEX[axes.v]];
  const minU = anchorU - Math.floor(feature.size[0] / 2);
  const minV = anchorV - Math.floor(feature.size[1] / 2);
  return {
    minU,
    minV,
    maxU: minU + feature.size[0],
    maxV: minV + feature.size[1]
  };
};

export const surfaceFeaturePlane = (
  feature: FeaturePartSpec
): number => {
  const axes = surfaceFeatureAxes(feature.face);
  return feature.anchor[AXIS_INDEX[axes.normal]];
};

/**
 * Returns the feature rectangle in the same oriented surface coordinates used
 * by deterministic generated texture patterns.
 */
export const orientedSurfaceFeatureRect = (
  feature: FeaturePartSpec
): SurfaceFeatureRect => {
  const rect = featurePlaneRect(feature);
  switch (feature.face) {
    case 'north':
    case 'east':
      return {
        x: 1 - rect.maxU,
        y: 1 - rect.maxV,
        width: feature.size[0],
        height: feature.size[1]
      };
    case 'south':
    case 'west':
      return {
        x: rect.minU,
        y: 1 - rect.maxV,
        width: feature.size[0],
        height: feature.size[1]
      };
    case 'up':
      return {
        x: rect.minU,
        y: rect.minV,
        width: feature.size[0],
        height: feature.size[1]
      };
    case 'down':
      return {
        x: rect.minU,
        y: 1 - rect.maxV,
        width: feature.size[0],
        height: feature.size[1]
      };
  }
};

export const surfaceFeaturePixels = (
  feature: FeaturePartSpec
): readonly SurfaceFeaturePixel[] => {
  const axes = surfaceFeatureAxes(feature.face);
  const normalIndex = AXIS_INDEX[axes.normal];
  const uIndex = AXIS_INDEX[axes.u];
  const vIndex = AXIS_INDEX[axes.v];
  const plane = surfaceFeaturePlane(feature);
  const rect = featurePlaneRect(feature);
  const pixels: SurfaceFeaturePixel[] = [];
  for (let u = rect.minU; u < rect.maxU; u += 1) {
    for (let v = rect.minV; v < rect.maxV; v += 1) {
      const boundary: [number, number, number] = [0, 0, 0];
      const neighbor: [number, number, number] = [0, 0, 0];
      boundary[uIndex] = u;
      boundary[vIndex] = v;
      neighbor[uIndex] = u;
      neighbor[vIndex] = v;
      boundary[normalIndex] = axes.positive ? plane - 1 : plane;
      neighbor[normalIndex] = axes.positive ? plane : plane - 1;
      const boundaryCell: LatticePoint = {
        x: boundary[0],
        y: boundary[1],
        z: boundary[2]
      };
      const neighborCell: LatticePoint = {
        x: neighbor[0],
        y: neighbor[1],
        z: neighbor[2]
      };
      pixels.push({
        key: [feature.face, plane, u, v].join(':'),
        boundaryCell,
        neighborCell
      });
    }
  }
  return pixels;
};

export const validateSurfaceFeaturePlacement = (
  feature: FeaturePartSpec,
  parent: OccupancyGrid,
  environment: ReadonlySet<CellKey>
): SurfaceFeaturePlacementIssue | null => {
  for (const pixel of surfaceFeaturePixels(feature)) {
    if (!parent.cells.has(cellKey(pixel.boundaryCell))) {
      return {
        path: `parts.${feature.partId}.anchor`,
        message:
          `Surface feature "${feature.partId}" extends outside parent ` +
          `part "${feature.parentPartId}" on its ${feature.face} face.`
      };
    }
    if (environment.has(cellKey(pixel.neighborCell))) {
      return {
        path: `parts.${feature.partId}.anchor`,
        message:
          `Surface feature "${feature.partId}" is covered by model ` +
          `geometry on its ${feature.face} face.`
      };
    }
  }
  return null;
};

const anchorDistance = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number =>
  Math.abs(left[0] - right[0]) +
  Math.abs(left[1] - right[1]) +
  Math.abs(left[2] - right[2]);

const compareAnchor = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number =>
  left[0] - right[0] ||
  left[1] - right[1] ||
  left[2] - right[2];

/**
 * Treats the public anchor as a placement preference and projects the whole
 * deterministic motif rectangle onto the nearest uncovered parent surface.
 */
export const projectSurfaceFeaturePlacement = (
  feature: FeaturePartSpec,
  parent: OccupancyGrid,
  environment: ReadonlySet<CellKey>
): FeaturePartSpec | null => {
  if (!validateSurfaceFeaturePlacement(feature, parent, environment)) {
    return feature;
  }
  const axes = surfaceFeatureAxes(feature.face);
  const normalIndex = AXIS_INDEX[axes.normal];
  const uIndex = AXIS_INDEX[axes.u];
  const vIndex = AXIS_INDEX[axes.v];
  const halfU = Math.floor(feature.size[0] / 2);
  const halfV = Math.floor(feature.size[1] / 2);
  const candidates = new Map<string, FeaturePartSpec>();
  for (const key of parent.cells) {
    const cell = parseCellKey(key);
    const neighbor = { ...cell };
    neighbor[axes.normal] += axes.positive ? 1 : -1;
    if (environment.has(cellKey(neighbor))) continue;
    const anchor: [number, number, number] = [0, 0, 0];
    anchor[normalIndex] = axes.positive
      ? cell[axes.normal] + 1
      : cell[axes.normal];
    anchor[uIndex] = cell[axes.u] + halfU;
    anchor[vIndex] = cell[axes.v] + halfV;
    const candidate: FeaturePartSpec = { ...feature, anchor };
    if (validateSurfaceFeaturePlacement(candidate, parent, environment)) {
      continue;
    }
    candidates.set(anchor.join(','), candidate);
  }
  return [...candidates.values()].sort((left, right) =>
    anchorDistance(left.anchor, feature.anchor) -
      anchorDistance(right.anchor, feature.anchor) ||
    compareAnchor(left.anchor, right.anchor)
  )[0] ?? null;
};
