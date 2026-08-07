import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import { canonicalJsonString } from '../canonicalJson';
import { PART_CONTRACT_LIMITS } from '../modeling/partContract';
import { slotGraphHasCycle } from './authoringCatalogRules';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import {
  AUTHORING_PART_ID_PATTERN,
  readAuthoringPartIds
} from './authoringProfilePrimitives';
import {
  AUTHORING_CONTACTS,
  AUTHORING_QUALITY_STAGES,
  AUTHORING_SPATIAL_RELATIONS,
  AUTHORING_STRUCTURAL_ROLES,
  type ArchetypeDefinition,
  type AuthoringSlotAssignment
} from './authoringTypes';

const SLOT_KEYS = new Set([
  'slotId',
  'structuralRole',
  'qualityStage',
  'partIds',
  'parentSlotIds',
  'spatialRelations',
  'facing',
  'pairId',
  'contact'
]);
const STRUCTURAL_ROLES = new Set<string>(AUTHORING_STRUCTURAL_ROLES);
const QUALITY_STAGES = new Set<string>(AUTHORING_QUALITY_STAGES);
const SPATIAL_RELATIONS = new Set<string>(AUTHORING_SPATIAL_RELATIONS);
const CONTACTS = new Set<string>(AUTHORING_CONTACTS);

type RolePolicy = ArchetypeDefinition['structuralRolePolicies'][number];

const canonicalId = (value: unknown): value is string =>
  isNonEmptyContractText(value) &&
  value.length <= PART_CONTRACT_LIMITS.maxIdLength &&
  AUTHORING_PART_ID_PATTERN.test(value);

const readSlotEntry = (
  value: unknown,
  index: number,
  policiesByRole: ReadonlyMap<string, RolePolicy>,
  issues: AuthoringProfileIssue[]
): AuthoringSlotAssignment | null => {
  const path = `slots[${index}]`;
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, SLOT_KEYS)
  ) {
    addIssue(
      issues,
      path,
      'Structural slot declaration must use the closed contract shape.',
      '{slotId,structuralRole,qualityStage,partIds,parentSlotIds,' +
        'spatialRelations,facing,pairId,contact}'
    );
    return null;
  }
  const slotId = canonicalId(value.slotId) ? value.slotId : null;
  if (!slotId) {
    addIssue(
      issues,
      `${path}.slotId`,
      'Structural slot ID must be a canonical stable ID.',
      'a canonical ID up to 64 characters'
    );
  }
  const structuralRole = typeof value.structuralRole === 'string' &&
    STRUCTURAL_ROLES.has(value.structuralRole)
    ? value.structuralRole as AuthoringSlotAssignment['structuralRole']
    : null;
  const policy = structuralRole
    ? policiesByRole.get(structuralRole)
    : undefined;
  if (!structuralRole || !policy) {
    addIssue(
      issues,
      `${path}.structuralRole`,
      `Unknown structural role "${String(value.structuralRole)}".`,
      AUTHORING_STRUCTURAL_ROLES.join(' | ')
    );
  }
  const qualityStage = typeof value.qualityStage === 'string' &&
    QUALITY_STAGES.has(value.qualityStage)
    ? value.qualityStage as AuthoringSlotAssignment['qualityStage']
    : null;
  const stageValid = qualityStage !== null &&
    (policy?.allowedQualityStages.includes(qualityStage) ?? false);
  if (!stageValid) {
    addIssue(
      issues,
      `${path}.qualityStage`,
      `Quality stage "${String(value.qualityStage)}" is not allowed for this role.`,
      policy?.allowedQualityStages.join(' | ') ??
        AUTHORING_QUALITY_STAGES.join(' | ')
    );
  }
  const partIds = readAuthoringPartIds(
    value.partIds,
    `${path}.partIds`,
    issues
  );
  const parentSlotIds = isUniqueContractTextArray(value.parentSlotIds) &&
    value.parentSlotIds.length <= AUTHORING_PROFILE_LIMITS.maxSlots &&
    value.parentSlotIds.every(canonicalId)
    ? [...value.parentSlotIds].sort((left, right) => left.localeCompare(right))
    : null;
  if (!parentSlotIds) {
    addIssue(
      issues,
      `${path}.parentSlotIds`,
      'Parent slot IDs must be a unique bounded canonical array.',
      'zero or more canonical IDs declared by this profile'
    );
  }
  const spatialRelations = isUniqueContractTextArray(value.spatialRelations) &&
    value.spatialRelations.every((relation) => SPATIAL_RELATIONS.has(relation))
    ? [...value.spatialRelations].sort((left, right) =>
        left.localeCompare(right)
      ) as AuthoringSlotAssignment['spatialRelations']
    : null;
  if (!spatialRelations) {
    addIssue(
      issues,
      `${path}.spatialRelations`,
      'Spatial relations must use the closed directional taxonomy.',
      AUTHORING_SPATIAL_RELATIONS.join(' | ')
    );
  }
  const facingValid = value.facing === null || value.facing === 'forward';
  if (!facingValid) {
    addIssue(
      issues,
      `${path}.facing`,
      'Facing must be forward or null.',
      'forward | null'
    );
  }
  const pairValid = value.pairId === null || canonicalId(value.pairId);
  if (!pairValid) {
    addIssue(
      issues,
      `${path}.pairId`,
      'Pair ID must be null or a canonical stable ID.',
      'canonical ID | null'
    );
  }
  const contact = typeof value.contact === 'string' && CONTACTS.has(value.contact)
    ? value.contact as AuthoringSlotAssignment['contact']
    : null;
  if (!contact) {
    addIssue(
      issues,
      `${path}.contact`,
      `Unknown contact intent "${String(value.contact)}".`,
      AUTHORING_CONTACTS.join(' | ')
    );
  }
  if (
    !slotId ||
    !structuralRole ||
    !policy ||
    !qualityStage ||
    !stageValid ||
    !partIds ||
    !parentSlotIds ||
    !spatialRelations ||
    !facingValid ||
    !pairValid ||
    !contact
  ) {
    return null;
  }
  return {
    slotId,
    structuralRole,
    qualityStage,
    partIds,
    parentSlotIds,
    spatialRelations,
    facing: value.facing as AuthoringSlotAssignment['facing'],
    pairId: value.pairId as string | null,
    contact
  };
};

const validateParentReferences = (
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const slotIds = slots.map((slot) => slot.slotId);
  if (new Set(slotIds).size !== slotIds.length) {
    addIssue(
      issues,
      'slots',
      'Each structural slot ID may be declared once.',
      'unique slot IDs'
    );
  }
  const slotIdSet = new Set(slotIds);
  slots.forEach((slot, index) => {
    for (const parentSlotId of slot.parentSlotIds) {
      if (parentSlotId === slot.slotId || !slotIdSet.has(parentSlotId)) {
        addIssue(
          issues,
          `slots[${index}].parentSlotIds`,
          `Parent slot "${parentSlotId}" is missing or self-referential.`,
          'IDs of other slots declared by this profile'
        );
      }
    }
  });
  if (slotGraphHasCycle(slots)) {
    addIssue(
      issues,
      'slots',
      'Structural slot parent relationships must form a DAG.',
      'an acyclic module graph'
    );
  }
};

const validateRootedStages = (
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const roots = slots.filter((slot) => slot.parentSlotIds.length === 0);
  const root = roots.length === 1 ? roots[0] : undefined;
  if (
    !root ||
    root.structuralRole !== 'core' ||
    root.qualityStage !== 'silhouette'
  ) {
    addIssue(
      issues,
      'slots',
      'A composable form must have exactly one root slot, declared as a silhouette-stage core.',
      'one root with structuralRole core and qualityStage silhouette'
    );
    return;
  }
  const slotsById = new Map(slots.map((slot) => [slot.slotId, slot]));
  const stageIndex = new Map(
    AUTHORING_QUALITY_STAGES.map((stage, index) => [stage, index])
  );
  const reachesRoot = (slot: AuthoringSlotAssignment): boolean => {
    const pending = [...slot.parentSlotIds];
    const visited = new Set<string>();
    while (pending.length > 0) {
      const parentId = pending.pop();
      if (!parentId || visited.has(parentId)) continue;
      if (parentId === root.slotId) return true;
      visited.add(parentId);
      pending.push(...(slotsById.get(parentId)?.parentSlotIds ?? []));
    }
    return slot.slotId === root.slotId;
  };
  for (const slot of slots) {
    if (!reachesRoot(slot)) {
      addIssue(
        issues,
        `slots.${slot.slotId}.parentSlotIds`,
        `Structural slot "${slot.slotId}" does not reach the declared core root.`,
        `an ancestor path to ${root.slotId}`
      );
    }
    for (const parentSlotId of slot.parentSlotIds) {
      const parent = slotsById.get(parentSlotId);
      if (
        parent &&
        (stageIndex.get(parent.qualityStage) ?? 0) >
          (stageIndex.get(slot.qualityStage) ?? 0)
      ) {
        addIssue(
          issues,
          `slots.${slot.slotId}.qualityStage`,
          `Structural slot "${slot.slotId}" places ${slot.qualityStage} below later-stage parent "${parentSlotId}" (${parent.qualityStage}).`,
          'parent qualityStage must be the same as or earlier than its child'
        );
      }
    }
    if (slot.qualityStage !== 'focal') continue;
    const pending = [...slot.parentSlotIds];
    const visited = new Set<string>();
    let reachesEarlierStage = false;
    while (pending.length > 0 && !reachesEarlierStage) {
      const parentId = pending.pop();
      if (!parentId || visited.has(parentId)) continue;
      visited.add(parentId);
      const parent = slotsById.get(parentId);
      if (!parent) continue;
      reachesEarlierStage = parent.qualityStage !== 'focal';
      pending.push(...parent.parentSlotIds);
    }
    if (!reachesEarlierStage) {
      addIssue(
        issues,
        `slots.${slot.slotId}.parentSlotIds`,
        `Focal slot "${slot.slotId}" has no earlier-stage ancestor.`,
        'an ancestor declared at silhouette or structure stage'
      );
    }
  }
};

const validatePairs = (
  slots: readonly AuthoringSlotAssignment[],
  issues: AuthoringProfileIssue[]
): void => {
  const paired = new Map<string, AuthoringSlotAssignment[]>();
  for (const slot of slots) {
    if (slot.pairId === null) continue;
    paired.set(slot.pairId, [...(paired.get(slot.pairId) ?? []), slot]);
  }
  for (const [pairId, pair] of paired) {
    const sides = pair.flatMap((slot) => {
      const left = slot.spatialRelations.includes('left');
      const right = slot.spatialRelations.includes('right');
      return left === right ? [] : [left ? 'left' : 'right'];
    });
    const symmetric = pair.length === 2 &&
      new Set(pair.map((slot) => slot.structuralRole)).size === 1 &&
      new Set(pair.map((slot) => slot.qualityStage)).size === 1 &&
      new Set(pair.map((slot) => slot.contact)).size === 1 &&
      new Set(pair.map((slot) =>
        canonicalJsonString(slot.parentSlotIds)
      )).size === 1 &&
      sides.length === 2 &&
      new Set(sides).size === 2;
    if (!symmetric) {
      addIssue(
        issues,
        'slots',
        `Pair "${pairId}" must contain exactly two structurally symmetric slots with one left and one right member.`,
        'two same-role, stage, contact, and parent declarations carrying complementary left/right relations'
      );
    }
  }
};

export const readAuthoringSlots = (
  value: unknown,
  archetype: ArchetypeDefinition | undefined,
  issues: AuthoringProfileIssue[]
): readonly AuthoringSlotAssignment[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxSlots
  ) {
    addIssue(
      issues,
      'slots',
      'Structural slots must be a non-empty bounded declaration array.',
      `1-${AUTHORING_PROFILE_LIMITS.maxSlots} structural slot declarations`
    );
    return null;
  }
  const policiesByRole = new Map(
    (archetype?.structuralRolePolicies ?? []).map((policy) => [
      policy.role,
      policy
    ])
  );
  const slots = value.flatMap((entry, index) => {
    const slot = readSlotEntry(entry, index, policiesByRole, issues);
    return slot ? [slot] : [];
  });
  validateParentReferences(slots, issues);
  validateRootedStages(slots, issues);
  validatePairs(slots, issues);
  return [...slots].sort((left, right) =>
    left.slotId.localeCompare(right.slotId)
  );
};
