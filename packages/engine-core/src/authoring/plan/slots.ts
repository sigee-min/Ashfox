import type { ProjectForwardDirection, ProjectIntent } from '../../model';
import type { PartSpec } from '../../modeling/part';
import { AUTHORING_PROFILE_LIMITS } from '../profile/evidence';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from '../catalog/registry';
import type {
  AuthoringProfile,
  AuthoringSpatialRelation,
  ComposedAuthoringSlotDefinition
} from '../contract';
import type { AuthoringSlotState, AuthoringSlotStatus } from './contract';

type Point = readonly [number, number, number];

const average = (points: readonly Point[]): Point | null => {
  if (points.length === 0) return null;
  const sums = points.reduce<Point>((value, point) => [
    value[0] + point[0],
    value[1] + point[1],
    value[2] + point[2]
  ], [0, 0, 0]);
  return [
    sums[0] / points.length,
    sums[1] / points.length,
    sums[2] / points.length
  ];
};

const partCenter = (part: PartSpec): Point => {
  switch (part.kind) {
    case 'mass':
    case 'radial': return part.center;
    case 'segment': return average(part.points) ?? [0, 0, 0];
    case 'plate': return part.origin;
    case 'feature': return part.anchor;
  }
};

const forwardVector = (forward: ProjectForwardDirection): Point => {
  switch (forward) {
    case 'north': return [0, 0, -1];
    case 'south': return [0, 0, 1];
    case 'east': return [1, 0, 0];
    case 'west': return [-1, 0, 0];
  }
};

const dot = (left: Point, right: Point): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const relationSatisfied = (
  child: Point,
  parent: Point,
  relation: AuthoringSpatialRelation,
  forward: ProjectForwardDirection
): boolean => {
  const delta: Point = [
    child[0] - parent[0], child[1] - parent[1], child[2] - parent[2]
  ];
  const front = forwardVector(forward);
  const left: Point = [front[2], 0, -front[0]];
  switch (relation) {
    case 'front': return dot(delta, front) > 0;
    case 'rear': return dot(delta, front) < 0;
    case 'left': return dot(delta, left) > 0;
    case 'right': return dot(delta, left) < 0;
    case 'above': return delta[1] > 0;
    case 'below': return delta[1] < 0;
  }
};

const reachesParentSlot = (
  part: PartSpec,
  allowedParentIds: ReadonlySet<string>,
  sameSlotPartIds: ReadonlySet<string>,
  partsById: ReadonlyMap<string, PartSpec>
): boolean => {
  let parentId = part.parentPartId;
  const visited = new Set<string>();
  while (parentId !== null && !visited.has(parentId)) {
    if (allowedParentIds.has(parentId)) return true;
    if (!sameSlotPartIds.has(parentId)) return false;
    visited.add(parentId);
    parentId = partsById.get(parentId)?.parentPartId ?? null;
  }
  return false;
};

export const composeAuthoringSlots = (
  profile: AuthoringProfile
): readonly ComposedAuthoringSlotDefinition[] => {
  const archetype = resolveArchetypeReference(profile.archetype);
  if (!archetype) return [];
  const archetypeSlots: ComposedAuthoringSlotDefinition[] =
    profile.slots.flatMap((slot) => {
      const policy = archetype.structuralRolePolicies.find(
        (candidate) => candidate.role === slot.structuralRole
      );
      if (!policy) return [];
      return [{
        id: slot.slotId,
        label: `${slot.structuralRole} module`,
        structuralRole: slot.structuralRole,
        qualityStage: slot.qualityStage,
        acceptedPartKinds: policy.acceptedPartKinds,
        instruction: policy.instruction,
        required: true,
        minParts: 1,
        maxParts: AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner,
        parentSlotIds: slot.parentSlotIds,
        spatialRelations: slot.spatialRelations,
        facing: slot.facing,
        symmetry: slot.symmetry,
        support: slot.support,
        span: slot.span,
        authority: profile.archetype,
        authorityType: 'archetype' as const,
        attachmentPortId: null,
        hostSlotId: null
      }];
    });
  const attachments = profile.bindings.filter(
    (binding) => binding.type === 'attachment'
  );
  const bindingByContribution = new Map<string, (typeof attachments)[number]>();
  for (const binding of attachments) {
    if (!bindingByContribution.has(binding.contributionId)) {
      bindingByContribution.set(binding.contributionId, binding);
    }
  }
  const specialistSlots = profile.specialists.flatMap((reference) => {
    const specialist = resolveSpecialistReference(reference);
    if (!specialist) return [];
    return specialist.contributions.flatMap((contribution) => {
      const binding = bindingByContribution.get(contribution.id);
      if (!binding) return [];
      return [{
        id: contribution.id,
        label: contribution.label,
        acceptedPartKinds: contribution.acceptedPartKinds,
        instruction: contribution.instruction,
        structuralRole: null,
        qualityStage: 'focal' as const,
        required: contribution.required,
        minParts: contribution.minParts,
        maxParts: contribution.maxParts,
        parentSlotIds: [binding.hostSlotId],
        spatialRelations: [],
        facing: null,
        symmetry: null,
        support: null,
        span: null,
        authority: reference,
        authorityType: 'specialist' as const,
        attachmentPortId: binding.portId,
        hostSlotId: binding.hostSlotId
      }];
    });
  });
  return [...archetypeSlots, ...specialistSlots];
};

const statusForSlot = (
  definition: ComposedAuthoringSlotDefinition,
  assignments: ReadonlyMap<string, readonly string[]>,
  partsById: ReadonlyMap<string, PartSpec>,
  intent: ProjectIntent,
  hasRecipe: boolean
): AuthoringSlotStatus => {
  const partIds = assignments.get(definition.id) ?? [];
  const presentParts = partIds.flatMap((id) => {
    const part = partsById.get(id);
    return part ? [part] : [];
  });
  const presentPartIds = presentParts.map((part) => part.partId);
  const missingPartIds = partIds.filter((id) => !partsById.has(id));
  const invalidKindPartIds = presentParts.filter((part) =>
    !definition.acceptedPartKinds.includes(part.kind)).map((part) => part.partId);
  const parentPartIds = new Set(definition.parentSlotIds.flatMap(
    (slotId) => assignments.get(slotId) ?? []
  ));
  const sameSlotPartIds = new Set(partIds);
  const rootPartIds = presentParts.filter((part) => part.parentPartId === null)
    .map((part) => part.partId);
  const moduleRootId = rootPartIds.length === 1 ? rootPartIds[0] ?? null : null;
  const invalidHierarchyPartIds = definition.parentSlotIds.length > 0
    ? presentParts.filter((part) => !reachesParentSlot(
        part, parentPartIds, sameSlotPartIds, partsById
      )).map((part) => part.partId)
    : presentParts.length === 0 ? []
      : moduleRootId === null ? presentPartIds
        : presentParts.filter((part) => part.partId !== moduleRootId &&
          !reachesParentSlot(
            part, new Set([moduleRootId]), sameSlotPartIds, partsById
          )).map((part) => part.partId);
  const parentCenter = average([...parentPartIds].flatMap((id) => {
    const part = partsById.get(id);
    return part ? [partCenter(part)] : [];
  }));
  const invalidSpatialPartIds = parentCenter
    ? presentParts.filter((part) => definition.spatialRelations.some(
        (relation) => !relationSatisfied(
          partCenter(part), parentCenter, relation, intent.forward
        )
      )).map((part) => part.partId)
    : [];
  const invalidFacingPartIds = definition.facing === 'forward'
    ? presentParts.filter((part) => part.kind === 'feature' &&
        part.face !== intent.forward).map((part) => part.partId)
    : [];
  const invalid = [invalidKindPartIds, invalidHierarchyPartIds,
    invalidSpatialPartIds, invalidFacingPartIds].some((ids) => ids.length > 0);
  const state: AuthoringSlotState = !hasRecipe ? 'planned'
    : partIds.length < definition.minParts || missingPartIds.length > 0
      ? 'missing' : invalid ? 'invalid' : 'complete';
  return {
    slotId: definition.id,
    label: definition.label,
    authority: definition.authority,
    authorityType: definition.authorityType,
    required: definition.required,
    structuralRole: definition.structuralRole,
    qualityStage: definition.qualityStage,
    acceptedPartKinds: definition.acceptedPartKinds,
    minParts: definition.minParts,
    maxParts: definition.maxParts,
    parentSlotIds: definition.parentSlotIds,
    spatialRelations: definition.spatialRelations,
    facing: definition.facing,
    symmetry: definition.symmetry,
    support: definition.support,
    span: definition.span,
    attachmentPortId: definition.attachmentPortId,
    hostSlotId: definition.hostSlotId,
    partIds,
    presentPartIds,
    missingPartIds,
    invalidKindPartIds,
    invalidHierarchyPartIds,
    invalidSpatialPartIds,
    invalidFacingPartIds,
    state,
    instruction: definition.instruction
  };
};

export interface AuthoringSlotEvaluation {
  readonly slots: readonly AuthoringSlotStatus[];
  readonly unassignedPartIds: readonly string[];
}

export const evaluateAuthoringSlots = (
  profile: AuthoringProfile,
  parts: readonly PartSpec[],
  intent: ProjectIntent,
  hasRecipe: boolean
): AuthoringSlotEvaluation => {
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const assignments = new Map<string, readonly string[]>([
    ...profile.slots.map((slot) => [slot.slotId, slot.partIds] as const),
    ...profile.bindings.flatMap((binding) => binding.type === 'attachment'
      ? [[binding.contributionId, binding.partIds] as const] : [])
  ]);
  const slots = composeAuthoringSlots(profile).map((definition) =>
    statusForSlot(definition, assignments, partsById, intent, hasRecipe)
  );
  const assigned = new Set([...assignments.values()].flatMap((ids) => ids));
  const unassignedPartIds = parts.map((part) => part.partId)
    .filter((id) => !assigned.has(id)).sort((left, right) => left.localeCompare(right));
  return { slots, unassignedPartIds };
};
