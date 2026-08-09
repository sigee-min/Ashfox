import {
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import {
  PART_CONTRACT_LIMITS,
  PART_ID_PATTERN_SOURCE
} from '../../modeling/part';
import {
  AUTHORING_PROFILE_LIMITS,
  addAuthoringProfileIssue as addIssue,
  type AuthoringProfileIssue
} from './evidence';

export const AUTHORING_PART_ID_PATTERN = new RegExp(PART_ID_PATTERN_SOURCE);

export const readAuthoringPartIds = (
  value: unknown,
  path: string,
  issues: AuthoringProfileIssue[]
): readonly string[] | null => {
  if (
    !isUniqueContractTextArray(value) ||
    value.length === 0 ||
    value.length > AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner ||
    value.some((id) =>
      id.length > PART_CONTRACT_LIMITS.maxIdLength ||
      !AUTHORING_PART_ID_PATTERN.test(id)
    )
  ) {
    addIssue(
      issues,
      path,
      'Part IDs must be a non-empty unique bounded array of canonical IDs.',
      `1-${AUTHORING_PROFILE_LIMITS.maxPartIdsPerOwner} valid part IDs`
    );
    return null;
  }
  return [...value].sort((left, right) => left.localeCompare(right));
};
