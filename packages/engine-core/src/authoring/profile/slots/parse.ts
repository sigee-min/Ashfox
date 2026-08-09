import {
  hasExactContractKeys,
  isClosedContractRecord,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from '../evidence';
import {
  isCanonicalAuthoringSlotId,
  readAuthoringSlotSupport,
  readAuthoringSlotSymmetry
} from './contract';
import { readAuthoringPartIds } from '../primitives';
import { readAuthoringSlotSpan } from './span';
import {
  AUTHORING_QUALITY_STAGES,
  AUTHORING_SPATIAL_RELATIONS,
  AUTHORING_STRUCTURAL_ROLES,
  type AuthoringSlotAssignment
} from '../../contract';
import type { ArchetypeDefinition } from '../../catalog/contract';

const SLOT_KEYS = new Set([
  'slotId',
  'structuralRole',
  'qualityStage',
  'partIds',
  'parentSlotIds',
  'spatialRelations',
  'facing',
  'symmetry',
  'support',
  'span'
]);
const STRUCTURAL_ROLES = new Set<string>(AUTHORING_STRUCTURAL_ROLES);
const QUALITY_STAGES = new Set<string>(AUTHORING_QUALITY_STAGES);
const SPATIAL_RELATIONS = new Set<string>(AUTHORING_SPATIAL_RELATIONS);

type RolePolicy = ArchetypeDefinition['structuralRolePolicies'][number];

export const readAuthoringSlotEntry = (
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
        'spatialRelations,facing,symmetry,support,span}'
    );
    return null;
  }
  const slotId = isCanonicalAuthoringSlotId(value.slotId)
    ? value.slotId
    : null;
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
    value.parentSlotIds.every(isCanonicalAuthoringSlotId)
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
  const symmetry = readAuthoringSlotSymmetry(
    value.symmetry,
    `${path}.symmetry`,
    issues
  );
  const support = readAuthoringSlotSupport(
    value.support,
    `${path}.support`,
    partIds,
    issues
  );
  const span = readAuthoringSlotSpan(
    value.span,
    `${path}.span`,
    structuralRole,
    partIds,
    issues
  );
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
    !symmetry ||
    !support ||
    !span
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
    symmetry,
    support,
    span
  };
};
