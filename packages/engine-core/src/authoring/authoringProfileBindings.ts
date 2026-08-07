import {
  hasExactContractKeys,
  isClosedContractRecord,
  isDenseContractArray,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import { canonicalJsonString } from '../canonicalJson';
import { PART_CONTRACT_LIMITS } from '../modeling/partContract';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  readSpecialistReference,
  type AuthoringProfileIssue
} from './authoringEvidence';
import {
  AUTHORING_PART_ID_PATTERN,
  readAuthoringPartIds
} from './authoringProfilePrimitives';
import type {
  AuthoringAttachmentBinding,
  AuthoringBinding,
  AuthoringMotionBinding,
  AuthoringMotionRole,
  SpecialistReference
} from './authoringTypes';

const ATTACHMENT_BINDING_KEYS = new Set([
  'type',
  'contributionId',
  'portId',
  'hostSlotId',
  'partIds'
]);
const MOTION_BINDING_KEYS = new Set([
  'type',
  'specialist',
  'clipId',
  'role'
]);
const MOTION_ROLES = new Set<AuthoringMotionRole>([
  'idle',
  'loop',
  'once'
]);

export const readAuthoringBindings = (
  value: unknown,
  specialists: readonly SpecialistReference[],
  issues: AuthoringProfileIssue[]
): readonly AuthoringBinding[] | null => {
  if (
    !isDenseContractArray(value) ||
    value.length > AUTHORING_PROFILE_LIMITS.maxBindings
  ) {
    addIssue(
      issues,
      'bindings',
      'Bindings must be a bounded array.',
      `0-${AUTHORING_PROFILE_LIMITS.maxBindings} closed bindings`
    );
    return null;
  }
  const selectedSpecialistIds = new Set(
    specialists.map((reference) => reference.id)
  );
  const bindings: AuthoringBinding[] = [];
  value.forEach((entry, index) => {
    const path = `bindings[${index}]`;
    if (!isClosedContractRecord(entry) || typeof entry.type !== 'string') {
      addIssue(
        issues,
        path,
        'Binding must be a tagged closed object.',
        'attachment or motion binding'
      );
      return;
    }
    if (entry.type === 'attachment') {
      if (!hasExactContractKeys(entry, ATTACHMENT_BINDING_KEYS)) {
        addIssue(
          issues,
          path,
          'Attachment binding must use the closed v2 shape.',
          '{type,contributionId,portId,hostSlotId,partIds}'
        );
        return;
      }
      if (
        !isNonEmptyContractText(entry.contributionId) ||
        !isNonEmptyContractText(entry.portId) ||
        !isNonEmptyContractText(entry.hostSlotId)
      ) {
        addIssue(
          issues,
          path,
          'Attachment binding IDs must be non-empty.',
          'stable contribution, port, and host slot IDs'
        );
        return;
      }
      const partIds = readAuthoringPartIds(
        entry.partIds,
        `${path}.partIds`,
        issues
      );
      if (partIds) {
        bindings.push({
          type: 'attachment',
          contributionId: entry.contributionId,
          portId: entry.portId,
          hostSlotId: entry.hostSlotId,
          partIds
        } satisfies AuthoringAttachmentBinding);
      }
      return;
    }
    if (entry.type === 'motion') {
      if (!hasExactContractKeys(entry, MOTION_BINDING_KEYS)) {
        addIssue(
          issues,
          path,
          'Motion binding must use the closed v2 shape.',
          '{type,specialist,clipId,role}'
        );
        return;
      }
      const specialist = readSpecialistReference(
        entry.specialist,
        `${path}.specialist`,
        issues
      );
      if (specialist && !selectedSpecialistIds.has(specialist.id)) {
        addIssue(
          issues,
          `${path}.specialist`,
          `Motion specialist "${specialist.id}" is not selected.`,
          'an explicit v2 selected specialist reference'
        );
      }
      const clipValid = isNonEmptyContractText(entry.clipId) &&
        entry.clipId.length <= PART_CONTRACT_LIMITS.maxIdLength &&
        AUTHORING_PART_ID_PATTERN.test(entry.clipId);
      if (!clipValid) {
        addIssue(
          issues,
          `${path}.clipId`,
          'Motion clip ID is invalid.',
          'a canonical stable ID'
        );
      }
      const roleValid = typeof entry.role === 'string' &&
        MOTION_ROLES.has(entry.role as AuthoringMotionRole);
      if (!roleValid) {
        addIssue(
          issues,
          `${path}.role`,
          'Motion role is invalid.',
          'idle | loop | once'
        );
      }
      if (
        specialist &&
        selectedSpecialistIds.has(specialist.id) &&
        clipValid &&
        roleValid
      ) {
        bindings.push({
          type: 'motion',
          specialist,
          clipId: entry.clipId as string,
          role: entry.role as AuthoringMotionRole
        } satisfies AuthoringMotionBinding);
      }
      return;
    }
    addIssue(
      issues,
      `${path}.type`,
      `Unknown binding type "${entry.type}".`,
      'attachment | motion'
    );
  });
  return [...bindings].sort((left, right) =>
    canonicalJsonString(left).localeCompare(canonicalJsonString(right))
  );
};
