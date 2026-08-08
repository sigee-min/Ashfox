import type {
  CubeNode,
  ModelPartFace,
  ProjectDocument,
  Vec3
} from '../model';
import {
  isSceneNodeEffectivelyVisible
} from '../sceneVisibility';
import type {
  EyeFeaturePartSpec
} from './partContract';
import { centeredEyePupilBias } from './eyeGaze';
import {
  readPartRecipe
} from './partRecipe';
import {
  eyeGlyphPixelRole,
  type EyeGlyphPixelRole
} from './eyeGlyph';
import {
  worldCubeBounds,
  type WorldAxisAlignedBounds
} from './worldCubeBounds';

type AxisIndex = 0 | 1 | 2;

interface FaceAxes {
  normal: AxisIndex;
  u: AxisIndex;
  v: AxisIndex;
  sign: -1 | 1;
}

interface EyeSurfaceCell {
  localX: number;
  localY: number;
  role: EyeGlyphPixelRole;
  point: Vec3;
}

export const EYE_VISIBILITY_POLICY = Object.freeze({
  minimumVisibleFraction: 0.75,
});

export type EyeVisibilityIssueCode =
  | 'surface-missing'
  | 'surface-occluded'
  | 'center-occluded';

export interface EyeVisibilityIssue {
  code: EyeVisibilityIssueCode;
  eyePartId: string;
  message: string;
  visibleFraction?: number;
  blockerNodeIds?: readonly string[];
}

const faceAxes = (face: ModelPartFace): FaceAxes => {
  switch (face) {
    case 'north':
      return { normal: 2, u: 0, v: 1, sign: -1 };
    case 'south':
      return { normal: 2, u: 0, v: 1, sign: 1 };
    case 'east':
      return { normal: 0, u: 2, v: 1, sign: 1 };
    case 'west':
      return { normal: 0, u: 2, v: 1, sign: -1 };
    case 'up':
      return { normal: 1, u: 0, v: 2, sign: 1 };
    case 'down':
      return { normal: 1, u: 0, v: 2, sign: -1 };
  }
};

const eyeSurfaceCells = (
  document: ProjectDocument,
  eye: EyeFeaturePartSpec,
  density: number
): readonly EyeSurfaceCell[] => {
  const axes = faceAxes(eye.face);
  const minimumU = eye.anchor[axes.u] - Math.floor(eye.size[0] / 2);
  const minimumV = eye.anchor[axes.v] - Math.floor(eye.size[1] / 2);
  const cells: EyeSurfaceCell[] = [];
  const pupilBias = document.intent
    ? centeredEyePupilBias(document.intent, eye)
    : 0;
  for (let y = 0; y < eye.size[1]; y += 1) {
    for (let x = 0; x < eye.size[0]; x += 1) {
      const motifX = eye.face === 'north' || eye.face === 'east'
        ? eye.size[0] - x - 1
        : x;
      const motifY = eye.face === 'up'
        ? y
        : eye.size[1] - y - 1;
      const role = eyeGlyphPixelRole(
        eye.glyph,
        motifX,
        motifY,
        eye.size[0],
        eye.size[1],
        pupilBias
      );
      if (role === null) continue;
      const point: [number, number, number] = [0, 0, 0];
      point[axes.normal] = eye.anchor[axes.normal] / density;
      point[axes.u] = (minimumU + x + 0.5) / density;
      point[axes.v] = (minimumV + y + 0.5) / density;
      cells.push({ localX: x, localY: y, role, point });
    }
  }
  return cells;
};

const facePlane = (
  bounds: WorldAxisAlignedBounds,
  axes: FaceAxes
): number => axes.sign > 0
  ? bounds.max[axes.normal]
  : bounds.min[axes.normal];

const containsSurfacePoint = (
  bounds: WorldAxisAlignedBounds,
  point: Vec3,
  axes: FaceAxes,
  epsilon: number
): boolean =>
  Math.abs(facePlane(bounds, axes) - point[axes.normal]) <= epsilon &&
  point[axes.u] > bounds.min[axes.u] + epsilon &&
  point[axes.u] < bounds.max[axes.u] - epsilon &&
  point[axes.v] > bounds.min[axes.v] + epsilon &&
  point[axes.v] < bounds.max[axes.v] - epsilon;

const blocksSurfacePoint = (
  bounds: WorldAxisAlignedBounds,
  point: Vec3,
  axes: FaceAxes,
  epsilon: number
): boolean => {
  if (
    point[axes.u] <= bounds.min[axes.u] + epsilon ||
    point[axes.u] >= bounds.max[axes.u] - epsilon ||
    point[axes.v] <= bounds.min[axes.v] + epsilon ||
    point[axes.v] >= bounds.max[axes.v] - epsilon
  ) {
    return false;
  }
  const eyeDepth = point[axes.normal] * axes.sign;
  const cubeForward = Math.max(
    bounds.min[axes.normal] * axes.sign,
    bounds.max[axes.normal] * axes.sign
  );
  return cubeForward >= eyeDepth - epsilon;
};

const visibleCubes = (document: ProjectDocument): readonly CubeNode[] =>
  Object.values(document.scene.nodes).filter(
    (node): node is CubeNode =>
      node.kind === 'cube' &&
      isSceneNodeEffectivelyVisible(document, node.id) &&
      Object.values(node.faces).some((face) => face.enabled)
  );

const auditEye = (
  document: ProjectDocument,
  eye: EyeFeaturePartSpec,
  cubes: readonly CubeNode[],
  boundsById: ReadonlyMap<string, WorldAxisAlignedBounds>
): readonly EyeVisibilityIssue[] => {
  const issues: EyeVisibilityIssue[] = [];
  const axes = faceAxes(eye.face);
  const epsilon = 1 / document.settings.surfacePixelDensity / 1_000;
  const hostCubes = cubes.filter(
    (cube) => cube.generation?.partId === eye.parentPartId
  );
  const blockers = cubes.filter(
    (cube) => cube.generation?.partId !== eye.parentPartId
  );
  const cells = eyeSurfaceCells(
    document,
    eye,
    document.settings.surfacePixelDensity
  );
  const supported = cells.filter((cell) => hostCubes.some((cube) => {
    const bounds = boundsById.get(cube.id);
    return bounds !== undefined &&
      containsSurfacePoint(bounds, cell.point, axes, epsilon);
  }));
  if (supported.length !== cells.length) {
    issues.push({
      code: 'surface-missing',
      eyePartId: eye.partId,
      message:
        `Eye "${eye.partId}" is not fully painted on a compiled outer ` +
        'host surface after attachment placement.'
    });
  }

  const blockedByCell = new Map<EyeSurfaceCell, readonly string[]>();
  for (const cell of supported) {
    const ids = blockers.flatMap((cube) => {
      const bounds = boundsById.get(cube.id);
      return bounds && blocksSurfacePoint(bounds, cell.point, axes, epsilon)
        ? [cube.id]
        : [];
    });
    if (ids.length > 0) blockedByCell.set(cell, ids);
  }
  const visibleCount = supported.length - blockedByCell.size;
  const visibleFraction = cells.length === 0 ? 0 : visibleCount / cells.length;
  const blockerNodeIds = [...new Set(
    [...blockedByCell.values()].flat()
  )].sort((left, right) => left.localeCompare(right));
  if (visibleFraction < EYE_VISIBILITY_POLICY.minimumVisibleFraction) {
    issues.push({
      code: 'surface-occluded',
      eyePartId: eye.partId,
      visibleFraction,
      blockerNodeIds,
      message:
        `Eye "${eye.partId}" leaves only ` +
        `${Math.round(visibleFraction * 100)}% of its motif visible. ` +
        'Other geometry may not disguise or cover the semantic eye.'
    });
  }
  const pupilCells = supported.filter((cell) => cell.role === 'pupil');
  const visiblePupil = pupilCells.find((cell) => !blockedByCell.has(cell));
  if (!visiblePupil) {
    issues.push({
      code: 'center-occluded',
      eyePartId: eye.partId,
      blockerNodeIds: [...new Set(
        pupilCells.flatMap((cell) => blockedByCell.get(cell) ?? [])
      )].sort((left, right) => left.localeCompare(right)),
      message:
        `Eye "${eye.partId}" has no unobstructed pupil pixel. ` +
        'A tooth, mask, or decorative cube cannot stand in for an eye.'
    });
  }

  return issues;
};

/**
 * Audits the delivered rest-pose scene rather than trusting semantic labels.
 * It verifies that every eye is painted on compiled host geometry, retains an
 * unobstructed pupil and readable area, and contrasts with its host material.
 */
export const auditEyeVisibility = (
  document: ProjectDocument
): readonly EyeVisibilityIssue[] => {
  const recipe = readPartRecipe(document);
  if (!recipe.ok || recipe.recipe === null) return [];
  const eyes = recipe.recipe.parts.filter(
    (part): part is EyeFeaturePartSpec =>
      part.kind === 'feature' && part.motif === 'eye'
  );
  if (eyes.length === 0) return [];
  const cubes = visibleCubes(document);
  const boundsById = new Map(
    cubes.map((cube) => [cube.id, worldCubeBounds(document, cube)])
  );
  return eyes.flatMap((eye) => auditEye(
    document,
    eye,
    cubes,
    boundsById
  ));
};
