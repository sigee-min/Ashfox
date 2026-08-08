import { isDenseContractArray } from '@ashfox/internal-contracts';

import type { ProjectIntent } from '../model';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './authoringEvidence';
import { readAuthoringSlotEntry } from './authoringProfileSlotParsing';
import { validateAuthoringSlotGraph } from './authoringProfileSlotValidation';
import type {
  ArchetypeDefinition,
  AuthoringSlotAssignment
} from './authoringTypes';

/**
 * Closed authoring-slot boundary. Entry parsing owns normalization; graph
 * validation owns cross-slot invariants. Callers retain one public reader.
 */
export const readAuthoringSlots = (
  value: unknown,
  archetype: ArchetypeDefinition | undefined,
  intent: ProjectIntent | undefined,
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
    const slot = readAuthoringSlotEntry(
      entry,
      index,
      policiesByRole,
      issues
    );
    return slot ? [slot] : [];
  });
  validateAuthoringSlotGraph(slots, intent, issues);
  return [...slots].sort((left, right) =>
    left.slotId.localeCompare(right.slotId)
  );
};
