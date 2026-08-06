import type {
  AnimationClip,
  ProjectDocument,
  ProjectForwardDirection,
  ProjectIntent,
  TransformChannel
} from '../model';
import type { PartSpec } from '../modeling/partContract';
import { readPartRecipe } from '../modeling/partRecipe';
import { canonicalJsonString } from '../canonicalJson';
import { evaluateAuthoringCompatibility } from './compatibilityEvaluator';
import { readAuthoringProfile } from './authoringProfile';
import {
  resolveArchetypeReference,
  resolveSpecialistReference
} from './authoringRegistry';
import { authoringRoutingMatches } from './authoringRouting';
import type {
  AuthoringAuthorityReference,
  AuthoringCompatibilityResult,
  AuthoringMotionBinding,
  AuthoringPartKind,
  AuthoringProfile,
  AuthoringSpatialRelation,
  ComposedAuthoringSlotDefinition
} from './authoringTypes';

export type AuthoringSlotState =
  | 'planned'
  | 'complete'
  | 'missing'
  | 'invalid';

export interface AuthoringSlotStatus {
  slotId: string;
  label: string;
  authority: AuthoringAuthorityReference;
  authorityType: 'archetype' | 'specialist';
  required: boolean;
  reason: string | null;
  acceptedPartKinds: readonly AuthoringPartKind[];
  minParts: number;
  maxParts: number;
  parentSlotIds: readonly string[];
  spatialRelations: readonly AuthoringSpatialRelation[];
  facing: 'forward' | null;
  attachmentPortId: string | null;
  hostSlotId: string | null;
  partIds: readonly string[];
  presentPartIds: readonly string[];
  missingPartIds: readonly string[];
  invalidKindPartIds: readonly string[];
  invalidHierarchyPartIds: readonly string[];
  invalidSpatialPartIds: readonly string[];
  invalidFacingPartIds: readonly string[];
  state: AuthoringSlotState;
  instruction: string;
}

export interface AuthoringPlanIssue {
  code: `authoring.plan.${string}`;
  path: string;
  message: string;
  expected: string;
  authority?: AuthoringAuthorityReference;
  partIds?: readonly string[];
  clipIds?: readonly string[];
}

export interface AuthoringPlanEvaluation {
  selected: boolean;
  profile: AuthoringProfile | null;
  profileValid: boolean;
  routingAligned: boolean;
  compatibility: AuthoringCompatibilityResult;
  slots: readonly AuthoringSlotStatus[];
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
    archetype.semanticSlots.map((slot) => ({
      ...slot,
      authority: profile.archetype,
      authorityType: 'archetype',
      attachmentPortId: null,
      hostSlotId: null
    }));
  const attachmentBindings = profile.bindings.filter(
    (binding) => binding.type === 'attachment'
  );
  const specialistSlots = profile.specialists.flatMap((reference) => {
    const specialist = resolveSpecialistReference(reference);
    if (!specialist) return [];
    return specialist.contributions.flatMap((contribution) => {
      const binding = attachmentBindings.find(
        (candidate) => candidate.contributionId === contribution.id
      );
      if (!binding) return [];
      return [{
        id: contribution.id,
        label: contribution.label,
        acceptedPartKinds: contribution.acceptedPartKinds,
        instruction: contribution.instruction,
        required: contribution.required,
        minParts: contribution.minParts,
        maxParts: contribution.maxParts,
        parentSlotIds: [binding.hostSlotId],
        spatialRelations: [],
        facing: null,
        authority: reference,
        authorityType: 'specialist' as const,
        attachmentPortId: binding.portId,
        hostSlotId: binding.hostSlotId
      }];
    });
  });
  return [...archetypeSlots, ...specialistSlots];
};

const partIdsForSlot = (
  profile: AuthoringProfile,
  definition: ComposedAuthoringSlotDefinition
): { partIds: readonly string[]; reason: string | null } => {
  if (definition.authorityType === 'archetype') {
    const assignment = profile.slots.find(
      (entry) => entry.slotId === definition.id
    );
    return {
      partIds: assignment?.partIds ?? [],
      reason: assignment?.reason ?? null
    };
  }
  const binding = profile.bindings.find(
    (entry) =>
      entry.type === 'attachment' &&
      entry.contributionId === definition.id
  );
  return {
    partIds: binding?.type === 'attachment' ? binding.partIds : [],
    reason: null
  };
};

const statusForSlot = (
  profile: AuthoringProfile,
  definition: ComposedAuthoringSlotDefinition,
  assignmentsBySlot: ReadonlyMap<string, readonly string[]>,
  partsById: ReadonlyMap<string, PartSpec>,
  intent: ProjectIntent,
  hasRecipe: boolean
): AuthoringSlotStatus => {
  const assignment = partIdsForSlot(profile, definition);
  const partIds = assignment.partIds;
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
  const invalidHierarchyPartIds = definition.parentSlotIds.length > 0
    ? presentParts
        .filter((part) => !reachesParentSlot(
          part,
          parentPartIds,
          sameSlotPartIds,
          partsById
        ))
        .map((part) => part.partId)
    : [];
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
    reason: assignment.reason,
    acceptedPartKinds: definition.acceptedPartKinds,
    minParts: definition.minParts,
    maxParts: definition.maxParts,
    parentSlotIds: definition.parentSlotIds,
    spatialRelations: definition.spatialRelations,
    facing: definition.facing,
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

const channelMoves = (channel: TransformChannel): boolean => {
  const opening = channel.keys[0];
  return opening !== undefined && channel.keys.some(
    (key) => canonicalJsonString(key.value) !==
      canonicalJsonString(opening.value)
  );
};

const clipRoleMatches = (
  clip: AnimationClip,
  binding: AuthoringMotionBinding
): boolean =>
  binding.role === 'once' ? clip.loop === 'once' : clip.loop === 'loop';

const motionIssues = (
  document: ProjectDocument,
  profile: AuthoringProfile
): readonly AuthoringPlanIssue[] =>
  profile.bindings.flatMap((binding, index) => {
    if (binding.type !== 'motion') return [];
    const path = `authoringProfile.bindings[${index}]`;
    const clip = document.animations[binding.clipId];
    if (!clip) {
      return [{
        code: 'authoring.plan.motion_clip_missing' as const,
        path: `${path}.clipId`,
        message: `Bound motion clip "${binding.clipId}" is missing.`,
        expected: `animation.motion.upsert for ${binding.clipId}`,
        authority: binding.specialist,
        clipIds: [binding.clipId]
      }];
    }
    const issues: AuthoringPlanIssue[] = [];
    if (!clipRoleMatches(clip, binding)) {
      issues.push({
        code: 'authoring.plan.motion_role_invalid',
        path: `${path}.role`,
        message:
          `Clip "${clip.id}" does not realize bound role "${binding.role}".`,
        expected: binding.role,
        authority: binding.specialist,
        clipIds: [clip.id]
      });
    }
    if (
      binding.role !== 'idle' &&
      !Object.values(clip.channels).some(channelMoves)
    ) {
      issues.push({
        code: 'authoring.plan.motion_static',
        path: `animations.${clip.id}.channels`,
        message: `Non-idle bound clip "${clip.id}" contains no changing motion.`,
        expected: 'at least one changing transform channel',
        authority: binding.specialist,
        clipIds: [clip.id]
      });
    }
    return issues;
  });

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
      incompleteSlotIds: [],
      unassignedPartIds: [],
      issues: [{
        code: 'authoring.plan.profile_invalid',
        path: 'authoringProfile',
        message: read.issues[0]?.message ?? 'Authoring profile is invalid.',
        expected: read.issues[0]?.expected ?? 'a canonical v1 authoring profile'
      }],
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
      incompleteSlotIds: [],
      unassignedPartIds: [],
      issues: [{
        code: 'authoring.plan.profile_missing',
        path: 'authoringProfile',
        message: 'No canonical authoring authority profile is selected.',
        expected: 'project.authoring.configure before authored model work'
      }],
      ready: false
    };
  }
  const profile = read.profile;
  const compatibility = evaluateAuthoringCompatibility(profile);
  const routingAligned = authoringRoutingMatches(document, profile.routing);
  const recipe = readPartRecipe(document);
  const hasRecipe = recipe.ok && recipe.recipe !== null;
  const parts = hasRecipe ? recipe.recipe?.parts ?? [] : [];
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
      profile,
      definition,
      assignmentsBySlot,
      partsById,
      document.intent as ProjectIntent,
      hasRecipe
    )
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
    issues.push({
      code: 'authoring.plan.routing_stale',
      path: 'authoringProfile.routing',
      message:
        'Authoring authority routing no longer matches intent, references, or delivery target.',
      expected: 'replace the profile through project.authoring.configure'
    });
  }
  if (!compatibility.compatible) {
    issues.push(...compatibility.issues.map((finding) => ({
      code: 'authoring.plan.compatibility_failed' as const,
      path: `authoringProfile.${finding.path}`,
      message: finding.message,
      expected: finding.expected,
      ...(finding.authority ? { authority: finding.authority } : {})
    })));
  }
  for (const slot of slots) {
    const path = slot.authorityType === 'archetype'
      ? `authoringProfile.slots.${slot.slotId}`
      : `authoringProfile.bindings.${slot.slotId}`;
    if (slot.state === 'planned' || slot.state === 'missing') {
      issues.push({
        code: slot.authorityType === 'specialist'
          ? 'authoring.plan.attachment_incomplete'
          : 'authoring.plan.slot_incomplete',
        path,
        message: `Authoring slot "${slot.slotId}" is not materialized.`,
        expected: slot.instruction,
        authority: slot.authority,
        partIds: slot.missingPartIds.length > 0
          ? slot.missingPartIds
          : slot.partIds
      });
    }
    for (const [code, partIds] of [
      ['authoring.plan.slot_kind_invalid', slot.invalidKindPartIds],
      ['authoring.plan.slot_hierarchy_invalid', slot.invalidHierarchyPartIds],
      ['authoring.plan.slot_spatial_invalid', slot.invalidSpatialPartIds],
      ['authoring.plan.slot_facing_invalid', slot.invalidFacingPartIds]
    ] as const) {
      if (partIds.length === 0) continue;
      issues.push({
        code,
        path,
        message: `Authoring slot "${slot.slotId}" violates ${code.slice('authoring.plan.slot_'.length).replace('_invalid', '')} constraints.`,
        expected: slot.instruction,
        authority: slot.authority,
        partIds
      });
    }
  }
  if (unassignedPartIds.length > 0) {
    issues.push({
      code: 'authoring.plan.part_unassigned',
      path: 'modeling.parts',
      message:
        `Model contains part IDs outside the authority plan: ${unassignedPartIds.join(', ')}.`,
      expected: 'every generated part owned by one archetype slot or attachment binding',
      partIds: unassignedPartIds
    });
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
    incompleteSlotIds,
    unassignedPartIds,
    issues,
    ready:
      routingAligned &&
      compatibility.compatible &&
      hasRecipe &&
      issues.length === 0
  };
};
