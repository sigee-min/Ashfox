import type {
  ConstrainedModelRecipe,
  ModelPartFace
} from '../model';
import { compareStableText } from '../stableOrder';
import {
  isPartId,
  type LatticeVec2,
  type LatticeVec3,
  type PartSpec
} from './partContract';
import { cellKey, parseCellKey } from './lattice';
import { normalizePartRecipe } from './partRecipe';
import type {
  Axis,
  CellKey,
  LatticePoint
} from './types';

export interface PartIdMirrorMapping {
  sourcePartId: string;
  targetPartId: string;
}

export interface MirrorPartRecipeInput {
  rootPartId: string;
  axis: Axis;
  plane: number;
  partIdMap: readonly PartIdMirrorMapping[];
}

export interface TranslatePartSubtreeInput {
  rootPartId: string;
  translation: LatticeVec3;
}

export interface PartRecipeTransformIssue {
  path: string;
  message: string;
}

export type PartRecipeTransformResult =
  | {
      ok: true;
      recipe: ConstrainedModelRecipe;
      affectedPartIds: readonly string[];
    }
  | {
      ok: false;
      issues: readonly PartRecipeTransformIssue[];
    };

const AXIS_INDEX: Readonly<Record<Axis, 0 | 1 | 2>> = {
  x: 0,
  y: 1,
  z: 2
};

const vec3WithCoordinate = (
  value: LatticeVec3,
  axis: Axis,
  coordinate: number
): LatticeVec3 => {
  const next: [number, number, number] = [...value];
  next[AXIS_INDEX[axis]] = coordinate;
  return next;
};

const addVec3 = (
  left: LatticeVec3,
  right: LatticeVec3
): LatticeVec3 => [
  left[0] + right[0],
  left[1] + right[1],
  left[2] + right[2]
];

const reflectPoint = (
  value: LatticeVec3,
  axis: Axis,
  plane: number
): LatticeVec3 => {
  const index = AXIS_INDEX[axis];
  return vec3WithCoordinate(
    value,
    axis,
    plane * 2 - value[index]
  );
};

const translatePrimitive = (
  part: PartSpec,
  translation: LatticeVec3
): PartSpec => {
  switch (part.kind) {
    case 'mass':
      return {
        ...part,
        center: addVec3(part.center, translation)
      };
    case 'segment':
      return {
        ...part,
        points: part.points.map((point) =>
          addVec3(point, translation)
        )
      };
    case 'plate':
      return {
        ...part,
        origin: addVec3(part.origin, translation)
      };
    case 'radial':
      return {
        ...part,
        center: addVec3(part.center, translation)
      };
    case 'feature':
      return {
        ...part,
        anchor: addVec3(part.anchor, translation)
      };
  }
};

const plateAxes = (
  plane: Extract<PartSpec, { kind: 'plate' }>['plane']
): {
  normal: Axis;
  u: Axis;
  v: Axis;
} => {
  if (plane === 'xy') return { normal: 'z', u: 'x', v: 'y' };
  if (plane === 'xz') return { normal: 'y', u: 'x', v: 'z' };
  return { normal: 'x', u: 'y', v: 'z' };
};

const reflectOutlineCoordinate = (
  outline: readonly LatticeVec2[],
  coordinate: 0 | 1
): readonly LatticeVec2[] =>
  outline.map((point) => {
    const next: [number, number] = [...point];
    next[coordinate] = -next[coordinate];
    return next;
  });

const reflectedPlate = (
  part: Extract<PartSpec, { kind: 'plate' }>,
  axis: Axis
): PartSpec => {
  const axes = plateAxes(part.plane);
  const index = AXIS_INDEX[axis];
  if (axis === axes.normal) {
    return {
      ...part,
      origin: vec3WithCoordinate(
        part.origin,
        axis,
        -part.origin[index] - part.thickness
      )
    };
  }
  return {
    ...part,
    origin: vec3WithCoordinate(
      part.origin,
      axis,
      -part.origin[index]
    ),
    outline: reflectOutlineCoordinate(
      part.outline,
      axis === axes.u ? 0 : 1
    )
  };
};

const oppositeFace = (face: ModelPartFace): ModelPartFace => {
  switch (face) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    case 'up':
      return 'down';
    case 'down':
      return 'up';
  }
};

const featureAxes = (
  face: ModelPartFace
): {
  normal: Axis;
  u: Axis;
  v: Axis;
} => {
  if (face === 'north' || face === 'south') {
    return { normal: 'z', u: 'x', v: 'y' };
  }
  if (face === 'east' || face === 'west') {
    return { normal: 'x', u: 'y', v: 'z' };
  }
  return { normal: 'y', u: 'x', v: 'z' };
};

const reflectedFeature = (
  part: Extract<PartSpec, { kind: 'feature' }>,
  axis: Axis
): PartSpec => {
  const axes = featureAxes(part.face);
  const index = AXIS_INDEX[axis];
  if (axis === axes.normal) {
    return {
      ...part,
      face: oppositeFace(part.face),
      anchor: vec3WithCoordinate(
        part.anchor,
        axis,
        -part.anchor[index]
      )
    };
  }
  const size = part.size[axis === axes.u ? 0 : 1];
  return {
    ...part,
    anchor: vec3WithCoordinate(
      part.anchor,
      axis,
      -part.anchor[index] + 2 * Math.floor(size / 2) - size
    )
  };
};

const reflectedPrimitive = (
  part: PartSpec,
  axis: Axis
): PartSpec => {
  const index = AXIS_INDEX[axis];
  switch (part.kind) {
    case 'mass':
      return {
        ...part,
        center: vec3WithCoordinate(
          part.center,
          axis,
          -part.center[index]
        )
      };
    case 'segment':
      return {
        ...part,
        points: part.points.map((point) =>
          vec3WithCoordinate(point, axis, -point[index])
        )
      };
    case 'plate':
      return reflectedPlate(part, axis);
    case 'radial': {
      if (part.axis !== axis) {
        return {
          ...part,
          center: vec3WithCoordinate(
            part.center,
            axis,
            -part.center[index]
          )
        };
      }
      const halfDepth = Math.floor(part.depth / 2);
      return {
        ...part,
        center: vec3WithCoordinate(
          part.center,
          axis,
          -part.center[index] + 2 * halfDepth - part.depth
        )
      };
    }
    case 'feature':
      return reflectedFeature(part, axis);
  }
};

export const reflectLatticeCell = (
  cell: LatticePoint,
  axis: Axis,
  plane: number
): LatticePoint => ({
  ...cell,
  [axis]: plane * 2 - cell[axis] - 1
});

export const areLatticeCellSetsExactReflections = (
  source: ReadonlySet<CellKey>,
  target: ReadonlySet<CellKey>,
  axis: Axis,
  plane: number
): boolean => {
  if (source.size !== target.size) return false;
  for (const key of source) {
    const reflected = cellKey(
      reflectLatticeCell(parseCellKey(key), axis, plane)
    );
    if (!target.has(reflected)) return false;
  }
  return true;
};

export const partSubtreeIds = (
  recipe: ConstrainedModelRecipe,
  rootPartId: string
): readonly string[] => {
  if (!recipe.parts.some((part) => part.partId === rootPartId)) {
    return [];
  }
  const selected = new Set([rootPartId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const part of recipe.parts) {
      if (
        part.parentPartId !== null &&
        selected.has(part.parentPartId) &&
        !selected.has(part.partId)
      ) {
        selected.add(part.partId);
        changed = true;
      }
    }
  }
  return [...selected].sort(compareStableText);
};

const normalizedResult = (
  parts: readonly PartSpec[],
  recipe: ConstrainedModelRecipe,
  affectedPartIds: readonly string[]
): PartRecipeTransformResult => {
  const normalized = normalizePartRecipe(parts, recipe.materials);
  if (!normalized.ok) {
    return {
      ok: false,
      issues: normalized.issues.map((issue) => ({
        path: issue.path,
        message: issue.message
      }))
    };
  }
  return {
    ok: true,
    recipe: normalized.recipe,
    affectedPartIds: [...affectedPartIds].sort(compareStableText)
  };
};

export const translatePartRecipeSubtree = (
  recipe: ConstrainedModelRecipe,
  input: TranslatePartSubtreeInput
): PartRecipeTransformResult => {
  const subtreeIds = partSubtreeIds(recipe, input.rootPartId);
  if (subtreeIds.length === 0) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message: `Canonical part "${input.rootPartId}" does not exist.`
      }]
    };
  }
  const selected = new Set(subtreeIds);
  const parts = recipe.parts.map((part): PartSpec => {
    if (!selected.has(part.partId)) return part;
    if (part.parentPartId === null) {
      return translatePrimitive(part, input.translation);
    }
    if (part.attachment === null) return part;
    return {
      ...part,
      attachment: {
        ...part.attachment,
        parentAnchor: addVec3(
          part.attachment.parentAnchor,
          input.translation
        )
      }
    };
  });
  return normalizedResult(parts, recipe, subtreeIds);
};

export const mirrorPartRecipeSubtree = (
  recipe: ConstrainedModelRecipe,
  input: MirrorPartRecipeInput
): PartRecipeTransformResult => {
  const subtreeIds = partSubtreeIds(recipe, input.rootPartId);
  if (subtreeIds.length === 0) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message: `Canonical part "${input.rootPartId}" does not exist.`
      }]
    };
  }
  const sourceRoot = recipe.parts.find(
    (part) => part.partId === input.rootPartId
  );
  if (sourceRoot?.parentPartId === null) {
    return {
      ok: false,
      issues: [{
        path: 'rootPartId',
        message:
          'The one canonical root cannot be copied because that would create a second model root.'
      }]
    };
  }

  const issues: PartRecipeTransformIssue[] = [];
  const mappings = new Map<string, string>();
  const targets = new Set<string>();
  const existingIds = new Set(recipe.parts.map((part) => part.partId));
  input.partIdMap.forEach((entry, index) => {
    const path = `partIdMap[${index}]`;
    if (!isPartId(entry.sourcePartId)) {
      issues.push({
        path: `${path}.sourcePartId`,
        message: 'Source part ID is invalid.'
      });
      return;
    }
    if (!isPartId(entry.targetPartId)) {
      issues.push({
        path: `${path}.targetPartId`,
        message: 'Target part ID is invalid.'
      });
      return;
    }
    if (mappings.has(entry.sourcePartId)) {
      issues.push({
        path: `${path}.sourcePartId`,
        message: `Source part "${entry.sourcePartId}" is mapped more than once.`
      });
    } else {
      mappings.set(entry.sourcePartId, entry.targetPartId);
    }
    if (targets.has(entry.targetPartId)) {
      issues.push({
        path: `${path}.targetPartId`,
        message: `Target part "${entry.targetPartId}" is used more than once.`
      });
    }
    targets.add(entry.targetPartId);
    if (existingIds.has(entry.targetPartId)) {
      issues.push({
        path: `${path}.targetPartId`,
        message: `Target part "${entry.targetPartId}" already exists.`
      });
    }
  });
  const subtree = new Set(subtreeIds);
  for (const sourcePartId of subtreeIds) {
    if (!mappings.has(sourcePartId)) {
      issues.push({
        path: 'partIdMap',
        message:
          `Explicit target ID is required for subtree part "${sourcePartId}".`
      });
    }
  }
  for (const sourcePartId of mappings.keys()) {
    if (!subtree.has(sourcePartId)) {
      issues.push({
        path: 'partIdMap',
        message:
          `Mapped source "${sourcePartId}" is outside the selected subtree.`
      });
    }
  }
  if (issues.length > 0) return { ok: false, issues };

  const mirrored = recipe.parts
    .filter((part) => subtree.has(part.partId))
    .map((part): PartSpec => {
      const targetPartId = mappings.get(part.partId)!;
      const reflected = reflectedPrimitive(part, input.axis);
      const parentPartId =
        part.parentPartId !== null && subtree.has(part.parentPartId)
          ? mappings.get(part.parentPartId)!
          : part.parentPartId;
      return {
        ...reflected,
        partId: targetPartId,
        parentPartId,
        attachment:
          part.attachment === null
            ? null
            : {
                parentAnchor: reflectPoint(
                  part.attachment.parentAnchor,
                  input.axis,
                  input.plane
                ),
                partAnchor: reflectPoint(
                  part.attachment.partAnchor,
                  input.axis,
                  0
                )
              }
      };
    });
  return normalizedResult(
    [...recipe.parts, ...mirrored],
    recipe,
    mirrored.map((part) => part.partId)
  );
};
