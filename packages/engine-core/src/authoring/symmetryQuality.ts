import type { ProjectDocument } from '../model';
import { cellKey } from '../modeling/lattice';
import {
  readCompiledParts
} from '../modeling/partInvariants';
import type { FeaturePartSpec } from '../modeling/partContract';
import {
  readPartRecipe
} from '../modeling/partRecipe';
import {
  areLatticeCellSetsExactReflections
} from '../modeling/partRecipeTransforms/geometry';
import {
  surfaceFeaturePixels
} from '../modeling/surfaceFeature';
import {
  projectCellLateralSide,
  projectSpatialFrame,
  reflectProjectCell
} from '../project/projectSpatialFrame';
import {
  compiledPartRigEntry,
  exactAuthoringRigReflection,
  type AuthoringRigEntry
} from './authoringRigReflection';
import { authoringPlanIssue } from './authoringIssueFactories';
import type { AuthoringPlanIssue } from './authoringPlanTypes';
import type {
  AuthoringProfile,
  AuthoringSlotAssignment
} from './authoringTypes';

export interface SymmetryQualityStatus {
  id: string;
  kind: 'centered' | 'paired';
  slotIds: readonly string[];
  partIds: readonly string[];
  complete: boolean;
  geometryExact: boolean;
  featureExact: boolean;
  materialExact: boolean;
  rigExact: boolean;
  lateralOwnershipExact: boolean;
}

export interface SymmetryQualityEvaluation {
  required: boolean;
  statuses: readonly SymmetryQualityStatus[];
  issues: readonly AuthoringPlanIssue[];
  /** Present geometry that violates the contract and must reject mutation. */
  violations: readonly AuthoringPlanIssue[];
  ready: boolean;
}

interface SlotOccupancy {
  geometry: ReadonlySet<`${number},${number},${number}`>;
  features: ReadonlySet<`${number},${number},${number}`>;
  materials: ReadonlySet<string>;
}

const emptyCells = (): Set<`${number},${number},${number}`> => new Set();

const cellsForSlot = (
  slot: AuthoringSlotAssignment,
  compiled: ReturnType<typeof readCompiledParts>,
  featureById: ReadonlyMap<string, FeaturePartSpec>
): SlotOccupancy => {
  const geometry = emptyCells();
  const features = emptyCells();
  const materials = new Set<string>();
  if (compiled.ok) {
    for (const partId of slot.partIds) {
      const part = compiled.parts.get(partId);
      if (!part) continue;
      for (const key of part.occupancy.cells) {
        geometry.add(key);
        materials.add(`${key}|geometry:${part.materialId}`);
      }
    }
  }
  for (const partId of slot.partIds) {
    const feature = featureById.get(partId);
    if (!feature) continue;
    for (const pixel of surfaceFeaturePixels(feature)) {
      const key = cellKey(pixel.boundaryCell);
      features.add(key);
      materials.add(`${key}|feature:${feature.materialId}`);
    }
  }
  return { geometry, features, materials };
};

const mergeCells = (
  occupancies: readonly SlotOccupancy[],
  key: 'geometry' | 'features'
): ReadonlySet<`${number},${number},${number}`> =>
  new Set(occupancies.flatMap((occupancy) => [...occupancy[key]]));

const exactReflection = (
  source: ReadonlySet<`${number},${number},${number}`>,
  target: ReadonlySet<`${number},${number},${number}`>,
  axis: 'x' | 'z',
  plane: number
): boolean => areLatticeCellSetsExactReflections(
  source,
  target,
  axis,
  plane
);

const exactMaterialReflection = (
  source: ReadonlySet<string>,
  target: ReadonlySet<string>,
  frame: ReturnType<typeof projectSpatialFrame>
): boolean => {
  if (source.size !== target.size) return false;
  return [...source].every((entry) => {
    const separator = entry.indexOf('|');
    if (separator < 0) return false;
    const coordinates = entry.slice(0, separator).split(',').map(Number);
    if (coordinates.length !== 3 || coordinates.some(Number.isNaN)) {
      return false;
    }
    const reflected = reflectProjectCell(
      coordinates as [number, number, number],
      frame
    );
    return target.has(
      `${reflected.join(',')}${entry.slice(separator)}`
    );
  });
};

const rigEntriesForSlot = (
  slot: AuthoringSlotAssignment,
  compiled: ReturnType<typeof readCompiledParts>,
  document: ProjectDocument
): readonly AuthoringRigEntry[] => {
  if (!compiled.ok) return [];
  return slot.partIds.flatMap((partId): readonly AuthoringRigEntry[] => {
    const part = compiled.parts.get(partId);
    if (!part) return [];
    // A fixed root has no animation relationship, and the compiler deliberately
    // keeps its pivot at the project origin. It is not rig-bearing; enforcing it
    // would make valid half-cell centered cores impossible for no rig benefit.
    if (part.parentPartId === null && part.joint.kind === 'fixed') return [];
    return [compiledPartRigEntry(part, document)];
  });
};

const lateralOwnershipExact = (
  cells: ReadonlySet<`${number},${number},${number}`>,
  side: 'left' | 'right',
  frame: ReturnType<typeof projectSpatialFrame>
): boolean => [...cells].every((key) => {
  const [x, y, z] = key.split(',').map(Number) as [number, number, number];
  return projectCellLateralSide([x, y, z], frame) === side;
});

const featureMap = (
  document: ProjectDocument
): ReadonlyMap<string, FeaturePartSpec> => {
  const recipe = readPartRecipe(document);
  if (!recipe.ok || !recipe.recipe) return new Map();
  return new Map(recipe.recipe.parts.flatMap((part) =>
    part.kind === 'feature' ? [[part.partId, part] as const] : []
  ));
};

export const evaluateSymmetryQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile
): SymmetryQualityEvaluation => {
  if (!document.intent || document.intent.symmetry.kind !== 'bilateral') {
    return {
      required: false,
      statuses: [],
      issues: [],
      violations: [],
      ready: true
    };
  }
  const frame = projectSpatialFrame(document.intent);
  const plane = frame.plane as number;
  const compiled = readCompiledParts(document);
  const features = featureMap(document);
  const recipe = readPartRecipe(document);
  const presentIds = new Set(
    recipe.ok && recipe.recipe
      ? recipe.recipe.parts.map((part) => part.partId)
      : []
  );
  const statuses: SymmetryQualityStatus[] = [];
  const issues: AuthoringPlanIssue[] = [];
  const violations: AuthoringPlanIssue[] = [];

  const centered = profile.slots.filter(
    (slot) => slot.symmetry.kind === 'centered'
  );
  for (const slot of centered) {
    const occupancy = cellsForSlot(slot, compiled, features);
    const complete = slot.partIds.every((partId) => presentIds.has(partId));
    const hasGeometry = occupancy.geometry.size > 0;
    const hasFeatures = occupancy.features.size > 0;
    const geometryExact = !hasGeometry || exactReflection(
      occupancy.geometry,
      occupancy.geometry,
      frame.lateralAxis,
      plane
    );
    const featureExact = !hasFeatures || exactReflection(
      occupancy.features,
      occupancy.features,
      frame.lateralAxis,
      plane
    );
    const materialExact = exactMaterialReflection(
      occupancy.materials,
      occupancy.materials,
      frame
    );
    const rig = rigEntriesForSlot(slot, compiled, document);
    const rigExact = exactAuthoringRigReflection(rig, rig, frame);
    const status: SymmetryQualityStatus = {
      id: `centered:${slot.slotId}`,
      kind: 'centered',
      slotIds: [slot.slotId],
      partIds: slot.partIds,
      complete,
      geometryExact,
      featureExact,
      materialExact,
      rigExact,
      lateralOwnershipExact: true
    };
    statuses.push(status);
    if (!geometryExact || !featureExact || !materialExact || !rigExact) {
      const issue = authoringPlanIssue(
        'authoring.plan.symmetry_centered_invalid',
        `authoringProfile.slots.${slot.slotId}.symmetry`,
        `Centered slot "${slot.slotId}" is not invariant under the project bilateral plane.`,
        'compiled geometry, feature footprints, per-cell geometry/feature material roles, and rig-bearing pivots/joints exactly equal their own reflection',
        { authority: profile.archetype, partIds: slot.partIds }
      );
      issues.push(issue);
      violations.push(issue);
    }
  }

  const pairs = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of profile.slots) {
    if (slot.symmetry.kind !== 'paired') continue;
    pairs.set(slot.symmetry.pairId, [
      ...(pairs.get(slot.symmetry.pairId) ?? []),
      slot
    ]);
  }
  for (const [pairId, slots] of pairs) {
    const left = slots.find((slot) => slot.spatialRelations.includes('left'));
    const right = slots.find((slot) => slot.spatialRelations.includes('right'));
    if (!left || !right) continue;
    const leftOccupancy = cellsForSlot(left, compiled, features);
    const rightOccupancy = cellsForSlot(right, compiled, features);
    const partIds = [...left.partIds, ...right.partIds];
    const complete = partIds.every((partId) => presentIds.has(partId));
    const presentCount = partIds.filter((partId) => presentIds.has(partId)).length;
    const geometryExact = presentCount === 0 || exactReflection(
      leftOccupancy.geometry,
      rightOccupancy.geometry,
      frame.lateralAxis,
      plane
    );
    const featureExact = presentCount === 0 || exactReflection(
      leftOccupancy.features,
      rightOccupancy.features,
      frame.lateralAxis,
      plane
    );
    const materialExact = presentCount === 0 || exactMaterialReflection(
      leftOccupancy.materials,
      rightOccupancy.materials,
      frame
    );
    const rigExact = presentCount === 0 || exactAuthoringRigReflection(
      rigEntriesForSlot(left, compiled, document),
      rigEntriesForSlot(right, compiled, document),
      frame
    );
    const leftCells = new Set([
      ...mergeCells([leftOccupancy], 'geometry'),
      ...mergeCells([leftOccupancy], 'features')
    ]);
    const rightCells = new Set([
      ...mergeCells([rightOccupancy], 'geometry'),
      ...mergeCells([rightOccupancy], 'features')
    ]);
    const ownershipExact = presentCount === 0 || (
      lateralOwnershipExact(leftCells, 'left', frame) &&
      lateralOwnershipExact(rightCells, 'right', frame)
    );
    const status: SymmetryQualityStatus = {
      id: `paired:${pairId}`,
      kind: 'paired',
      slotIds: [left.slotId, right.slotId],
      partIds,
      complete,
      geometryExact,
      featureExact,
      materialExact,
      rigExact,
      lateralOwnershipExact: ownershipExact
    };
    statuses.push(status);
    if (presentCount > 0 && (
      !complete || !geometryExact || !featureExact ||
      !materialExact || !rigExact ||
      !ownershipExact
    )) {
      const issue = authoringPlanIssue(
        'authoring.plan.symmetry_pair_invalid',
        `authoringProfile.slots.${pairId}.symmetry`,
        `Slot pair "${pairId}" must be absent or exist as one exact compiled reflection.`,
        'atomically materialize both sides with reflected geometry, feature footprints, exact per-cell material roles, rig-bearing pivots/joints, and half-space ownership',
        { authority: profile.archetype, partIds }
      );
      issues.push(issue);
      violations.push(issue);
    }
  }
  return {
    required: statuses.length > 0,
    statuses,
    issues,
    violations,
    ready: statuses.every((status) =>
      status.complete &&
      status.geometryExact &&
      status.featureExact &&
      status.materialExact &&
      status.rigExact &&
      status.lateralOwnershipExact
    )
  };
};
