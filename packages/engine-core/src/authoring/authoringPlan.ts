import type {
  ProjectDocument,
  ProjectForwardDirection,
  ProjectIntent
} from '../model';
import type { PartSpec } from '../modeling/partContract';
import { readPartRecipe } from '../modeling/partRecipe';
import {
  evaluateAssetQuality,
  type AssetQualityEvaluation
} from './assetQuality';
import { evaluateAuthoringCompatibility } from './compatibilityEvaluator';
import { readAuthoringProfile } from './authoringProfile';
import { AUTHORING_PROFILE_LIMITS } from './authoringEvidence';
import { authoringPlanIssue } from './authoringIssueFactories';
import { motionIssues } from './authoringMotionPlan';
import type {
  AuthoringPlanIssue,
  AuthoringSlotState,
  AuthoringSlotStatus
} from './authoringPlanTypes';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoringRegistry';
import { authoringRoutingMatches } from './authoringRouting';
import type {
  AuthoringCompatibilityResult,
  AuthoringProfile,
  AuthoringSpatialRelation,
  ComposedAuthoringSlotDefinition
} from './authoringTypes';

export type {
  AuthoringPlanIssueCode,
  AuthoringPlanIssue,
  AuthoringSlotState,
  AuthoringSlotStatus
} from './authoringPlanTypes';

export interface AuthoringPlanEvaluation {
  selected: boolean;
  profile: AuthoringProfile | null;
  profileValid: boolean;
  routingAligned: boolean;
  compatibility: AuthoringCompatibilityResult;
  slots: readonly AuthoringSlotStatus[];
  assetQuality: AssetQualityEvaluation | null;
  incompleteSlotIds: readonly string[];
  unassignedPartIds: readonly string[];
  issues: readonly AuthoringPlanIssue[];
  ready: boolean;
}

type Point = readonly [number, number, number];

const average = (points: readonly Point[]): Point | null => {
  if (points.length === 0) return null;
  const sums = points.reduce(
    (value, point) => [
      value[0] + point[0],
      value[1] + point[1],
      value[2] + point[2]
    ] as Point,
    [0, 0, 0] as Point
  );
  return [
    sums[0] / points.length,
    sums[1] / points.length,
    sums[2] / points.length
  ];
};

const partCenter = (part: PartSpec): Point => {
  switch (part.kind) {
    case 'mass':
    case 'radial':
      return part.center;
    case 'segment':
      return average(part.points) ?? [0, 0, 0];
    case 'plate':
      return part.origin;
    case 'feature':
      return part.anchor;
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
    child[0] - parent[0],
    child[1] - parent[1],
    child[2] - parent[2]
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
  const attachmentBindings = profile.bindings.filter(
    (binding) => binding.type === 'attachment'
  );
  const attachmentBindingByContribution = new Map<
    string,
    (typeof attachmentBindings)[number]
  >();
  for (const binding of attachmentBindings) {
    if (!attachmentBindingByContribution.has(binding.contributionId)) {
      attachmentBindingByContribution.set(binding.contributionId, binding);
    }
  }
  const specialistSlots = profile.specialists.flatMap((reference) => {
    const specialist = resolveSpecialistReference(reference);
    if (!specialist) return [];
    return specialist.contributions.flatMap((contribution) => {
      const binding = attachmentBindingByContribution.get(contribution.id);
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
  assignmentsBySlot: ReadonlyMap<string, readonly string[]>,
  partsById: ReadonlyMap<string, PartSpec>,
  intent: ProjectIntent,
  hasRecipe: boolean
): AuthoringSlotStatus => {
  const partIds = assignmentsBySlot.get(definition.id) ?? [];
  const presentParts = partIds.flatMap((partId) => {
    const part = partsById.get(partId);
    return part ? [part] : [];
  });
  const presentPartIds = presentParts.map((part) => part.partId);
  const missingPartIds = partIds.filter((partId) => !partsById.has(partId));
  const invalidKindPartIds = presentParts
    .filter((part) => !definition.acceptedPartKinds.includes(part.kind))
    .map((part) => part.partId);
  const parentPartIds = new Set(
    definition.parentSlotIds.flatMap((slotId) =>
      assignmentsBySlot.get(slotId) ?? []
    )
  );
  const sameSlotPartIds = new Set(partIds);
  const rootPartIds = presentParts
    .filter((part) => part.parentPartId === null)
    .map((part) => part.partId);
  const moduleRootId = rootPartIds.length === 1
    ? rootPartIds[0] ?? null
    : null;
  const invalidHierarchyPartIds = definition.parentSlotIds.length > 0
    ? presentParts
        .filter((part) => !reachesParentSlot(
          part,
          parentPartIds,
          sameSlotPartIds,
          partsById
        ))
        .map((part) => part.partId)
    : presentParts.length === 0
      ? []
      : moduleRootId === null
        ? presentPartIds
        : presentParts
            .filter((part) =>
              part.partId !== moduleRootId &&
              !reachesParentSlot(
                part,
                new Set([moduleRootId]),
                sameSlotPartIds,
                partsById
              )
            )
            .map((part) => part.partId);
  const parentCenter = average(
    [...parentPartIds].flatMap((partId) => {
      const part = partsById.get(partId);
      return part ? [partCenter(part)] : [];
    })
  );
  const invalidSpatialPartIds = parentCenter
    ? presentParts
        .filter((part) =>
          definition.spatialRelations.some((relation) =>
            !relationSatisfied(
              partCenter(part),
              parentCenter,
              relation,
              intent.forward
            )
          )
        )
        .map((part) => part.partId)
    : [];
  const invalidFacingPartIds = definition.facing === 'forward'
    ? presentParts
        .filter((part) =>
          part.kind === 'feature' && part.face !== intent.forward
        )
        .map((part) => part.partId)
    : [];
  const invalid = [
    invalidKindPartIds,
    invalidHierarchyPartIds,
    invalidSpatialPartIds,
    invalidFacingPartIds
  ].some((values) => values.length > 0);
  const belowMinimum = partIds.length < definition.minParts;
  const state: AuthoringSlotState = !hasRecipe
    ? 'planned'
    : belowMinimum || missingPartIds.length > 0
      ? 'missing'
      : invalid
        ? 'invalid'
        : 'complete';
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

const emptyCompatibility: AuthoringCompatibilityResult = {
  compatible: false,
  issues: []
};

export const evaluateAuthoringPlan = (
  document: ProjectDocument
): AuthoringPlanEvaluation => {
  const read = readAuthoringProfile(document);
  if (!read.ok) {
    return {
      selected: true,
      profile: null,
      profileValid: false,
      routingAligned: false,
      compatibility: emptyCompatibility,
      slots: [],
      assetQuality: null,
      incompleteSlotIds: [],
      unassignedPartIds: [],
      issues: [authoringPlanIssue(
        'authoring.plan.profile_invalid',
        'authoringProfile',
        read.issues[0]?.message ?? 'Authoring profile is invalid.',
        read.issues[0]?.expected ?? 'a canonical authoring profile'
      )],
      ready: false
    };
  }
  if (!read.profile || !document.intent) {
    return {
      selected: false,
      profile: null,
      profileValid: true,
      routingAligned: false,
      compatibility: emptyCompatibility,
      slots: [],
      assetQuality: null,
      incompleteSlotIds: [],
      unassignedPartIds: [],
      issues: [authoringPlanIssue(
        'authoring.plan.profile_missing',
        'authoringProfile',
        'No canonical authoring authority profile is selected.',
        'compile one confirmed Intent Program before generated model work'
      )],
      ready: false
    };
  }
  const profile = read.profile;
  const compatibility = evaluateAuthoringCompatibility(profile);
  const routingAligned = authoringRoutingMatches(document, profile.routing);
  const recipe = readPartRecipe(document);
  const hasRecipe = recipe.ok && recipe.recipe !== null;
  const parts = hasRecipe ? recipe.recipe?.parts ?? [] : [];
  const materials = hasRecipe ? recipe.recipe?.materials ?? [] : [];
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const assignmentsBySlot = new Map<string, readonly string[]>([
    ...profile.slots.map((assignment) => [
      assignment.slotId,
      assignment.partIds
    ] as const),
    ...profile.bindings.flatMap((binding) =>
      binding.type === 'attachment'
        ? [[binding.contributionId, binding.partIds] as const]
        : []
    )
  ]);
  const slots = composeAuthoringSlots(profile).map((definition) =>
    statusForSlot(
      definition,
      assignmentsBySlot,
      partsById,
      document.intent as ProjectIntent,
      hasRecipe
    )
  );
  const assetQuality = evaluateAssetQuality(
    document,
    document.intent,
    profile,
    slots,
    parts,
    materials
  );
  const assignedPartIds = new Set(
    [...assignmentsBySlot.values()].flatMap((partIds) => partIds)
  );
  const unassignedPartIds = parts
    .map((part) => part.partId)
    .filter((partId) => !assignedPartIds.has(partId))
    .sort((left, right) => left.localeCompare(right));
  const issues: AuthoringPlanIssue[] = [];
  if (!routingAligned) {
    issues.push(authoringPlanIssue(
      'authoring.plan.routing_stale',
      'authoringProfile.routing',
      'Authoring authority routing no longer matches intent or references.',
      'recompile the confirmed Intent Program source'
    ));
  }
  if (!compatibility.compatible) {
    issues.push(...compatibility.issues.map((finding) => authoringPlanIssue(
      'authoring.plan.compatibility_failed',
      `authoringProfile.${finding.path}`,
      finding.message,
      finding.expected,
      finding.authority ? { authority: finding.authority } : {}
    )));
  }
  for (const slot of slots) {
    const path = slot.authorityType === 'archetype'
      ? `authoringProfile.slots.${slot.slotId}`
      : `authoringProfile.bindings.${slot.slotId}`;
    if (slot.state === 'planned' || slot.state === 'missing') {
      issues.push(authoringPlanIssue(
        slot.authorityType === 'specialist'
          ? 'authoring.plan.attachment_incomplete'
          : 'authoring.plan.slot_incomplete',
        path,
        `Authoring slot "${slot.slotId}" is not materialized.`,
        slot.instruction,
        {
          authority: slot.authority,
          partIds: slot.missingPartIds.length > 0
            ? slot.missingPartIds
            : slot.partIds
        }
      ));
    }
    for (const [code, partIds] of [
      ['authoring.plan.slot_kind_invalid', slot.invalidKindPartIds],
      ['authoring.plan.slot_hierarchy_invalid', slot.invalidHierarchyPartIds],
      ['authoring.plan.slot_spatial_invalid', slot.invalidSpatialPartIds],
      ['authoring.plan.slot_facing_invalid', slot.invalidFacingPartIds]
    ] as const) {
      if (partIds.length === 0) continue;
      issues.push(authoringPlanIssue(
        code,
        path,
        `Authoring slot "${slot.slotId}" violates ${code.slice('authoring.plan.slot_'.length).replace('_invalid', '')} constraints.`,
        slot.instruction,
        { authority: slot.authority, partIds }
      ));
    }
  }
  issues.push(...assetQuality.structuralQuality.issues);
  issues.push(...assetQuality.symmetryQuality.issues);
  issues.push(...assetQuality.supportQuality.issues);
  issues.push(...assetQuality.spanQuality.issues);
  issues.push(...assetQuality.restPoseQuality.issues);
  issues.push(...assetQuality.intentCoverage.issues);
  issues.push(...assetQuality.faceQuality.issues);
  if (unassignedPartIds.length > 0) {
    issues.push(authoringPlanIssue(
      'authoring.plan.part_unassigned',
      'modeling.parts',
      `Model contains part IDs outside the authority plan: ${unassignedPartIds.join(', ')}.`,
      'every generated part owned by one archetype slot or attachment binding',
      { partIds: unassignedPartIds }
    ));
  }
  issues.push(...motionIssues(document, profile));
  const incompleteSlotIds = slots
    .filter((slot) => slot.state !== 'complete')
    .map((slot) => slot.slotId);
  return {
    selected: true,
    profile,
    profileValid: true,
    routingAligned,
    compatibility,
    slots,
    assetQuality,
    incompleteSlotIds,
    unassignedPartIds,
    issues,
    ready:
      routingAligned &&
      compatibility.compatible &&
      assetQuality.ready &&
      hasRecipe &&
      issues.length === 0
  };
};
