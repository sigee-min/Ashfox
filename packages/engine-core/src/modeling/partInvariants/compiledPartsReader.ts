import {
  MODEL_GEOMETRY_PRIMITIVES,
  type ProjectDocument
} from '../../model';
import { compareStableText } from '../../stableOrder';
import {
  PART_CONTRACT_LIMITS,
  isPartId
} from '../partContract/rules';
import { validatePartHierarchy } from './hierarchyValidator';
import { validatePartMaterials } from './materialValidator';
import { validatePartOccupancy } from './occupancyValidator';
import {
  isValidJoint,
  readPart,
  type CompiledPartNode
} from './partReader';
import {
  validatePartSurfaceOwnership
} from './surfaceOwnershipValidator';
import type {
  CompiledPartState,
  PartInvariantIssue,
  ReadCompiledPartsResult
} from './types';

const groupGeneratedNodes = (
  document: ProjectDocument,
  issues: PartInvariantIssue[]
): ReadonlyMap<string, CompiledPartNode[]> => {
  const grouped = new Map<string, CompiledPartNode[]>();
  for (const node of Object.values(document.scene.nodes)) {
    if (node.generation === undefined) continue;
    const generation = node.generation;
    if (
      generation.authority !== 'ashfox.part-compiler' ||
      !isPartId(generation.partId) ||
      !isPartId(generation.materialId) ||
      !MODEL_GEOMETRY_PRIMITIVES.includes(generation.primitive) ||
      !isValidJoint(generation.joint) ||
      (generation.role !== 'bone' && generation.role !== 'geometry') ||
      (generation.parentPartId !== null &&
        !isPartId(generation.parentPartId)) ||
      (node.kind !== 'bone' && node.kind !== 'cube')
    ) {
      issues.push({
        code: 'provenance',
        path: `scene.nodes.${node.id}.generation`,
        message: 'Generated node provenance is malformed.',
        entityIds: [node.id]
      });
      continue;
    }
    const entries = grouped.get(generation.partId) ?? [];
    entries.push(node);
    grouped.set(generation.partId, entries);
  }
  return grouped;
};

const validateDocumentBudget = (
  document: ProjectDocument,
  grouped: ReadonlyMap<string, CompiledPartNode[]>
): ReadCompiledPartsResult | null => {
  if (
    grouped.size > 0 &&
    document.settings.coordinateSystem.unit !== 'pixel'
  ) {
    return {
      ok: false,
      issues: [{
        code: 'grid',
        path: 'settings.coordinateSystem.unit',
        message: 'Compiled parts require pixel model units so one lattice cell maps to one generated surface pixel.',
        entityIds: []
      }]
    };
  }
  if (grouped.size > PART_CONTRACT_LIMITS.maxPartsPerDocument) {
    return {
      ok: false,
      issues: [{
        code: 'budget',
        path: 'scene.parts',
        message: `Compiled model exceeds ${PART_CONTRACT_LIMITS.maxPartsPerDocument} parts.`,
        entityIds: []
      }]
    };
  }
  return null;
};

const readGroupedParts = (
  document: ProjectDocument,
  grouped: ReadonlyMap<string, CompiledPartNode[]>,
  issues: PartInvariantIssue[]
): ReadonlyMap<string, CompiledPartState> => {
  const parts = new Map<string, CompiledPartState>();
  let totalCells = 0;
  for (const [partId, nodes] of [...grouped].sort(([left], [right]) =>
    compareStableText(left, right)
  )) {
    const part = readPart(document, partId, nodes, issues);
    if (!part) continue;
    totalCells += part.occupancy.cells.size;
    if (totalCells > PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument) {
      issues.push({
        code: 'budget',
        path: 'scene.parts',
        message: `Compiled model exceeds ${PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument} occupied cells.`,
        entityIds: [part.bone.id]
      });
      break;
    }
    parts.set(partId, part);
  }
  return parts;
};

const validateCompiledBoneChildren = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const compiledBoneIds = new Set(
    [...parts.values()].map((part) => part.bone.id)
  );
  for (const node of Object.values(document.scene.nodes)) {
    if (
      node.parentId &&
      compiledBoneIds.has(node.parentId) &&
      node.generation === undefined &&
      node.kind !== 'locator'
    ) {
      issues.push({
        code: 'provenance',
        path: `scene.nodes.${node.id}.parentId`,
        message: 'Only generated geometry or locators may be children of a compiled part bone.',
        entityIds: [node.id, node.parentId]
      });
    }
  }
};

export const readCompiledParts = (
  document: ProjectDocument
): ReadCompiledPartsResult => {
  const issues: PartInvariantIssue[] = [];
  const grouped = groupGeneratedNodes(document, issues);
  const budgetIssue = validateDocumentBudget(document, grouped);
  if (budgetIssue) return budgetIssue;

  const parts = readGroupedParts(document, grouped, issues);
  validateCompiledBoneChildren(document, parts, issues);
  if (issues.length === 0) {
    validatePartHierarchy(parts, issues);
    validatePartMaterials(parts, issues);
    validatePartOccupancy(parts, issues);
    validatePartSurfaceOwnership(document, parts, issues);
  }
  return issues.length === 0
    ? { ok: true, parts }
    : { ok: false, issues };
};
