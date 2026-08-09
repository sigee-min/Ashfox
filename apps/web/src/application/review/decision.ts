import {
  hasExactContractKeys,
  isClosedContractRecord,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import type { VisualReviewObservation } from './observation';
import type { VisualReviewDecision } from './schema';
import { isVisualReviewIssueArray } from './checks';

const DECISION_KEYS = new Set([
  'verdict',
  'issues',
  'acknowledgedCheckIds',
  'failedCheckIds'
]);

const sameTextSequence = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

export const isVisualReviewDecision = (
  value: unknown,
  observation: VisualReviewObservation
): value is VisualReviewDecision => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, DECISION_KEYS) ||
    (value.verdict !== 'accepted' && value.verdict !== 'rejected') ||
    !isVisualReviewIssueArray(value.issues) ||
    !isUniqueContractTextArray(value.acknowledgedCheckIds) ||
    !isUniqueContractTextArray(value.failedCheckIds)
  ) {
    return false;
  }
  const checkIds = observation.data.reviewChecks.map((check) => check.id);
  if (value.verdict === 'accepted') {
    return value.issues.length === 0 &&
      value.failedCheckIds.length === 0 &&
      sameTextSequence(value.acknowledgedCheckIds, checkIds);
  }
  if (value.issues.length === 0) return false;
  if (checkIds.length > 0 && value.failedCheckIds.length === 0) return false;
  if (!sameTextSequence(
    value.acknowledgedCheckIds,
    value.failedCheckIds
  )) {
    return false;
  }
  const failedCheckIds = value.failedCheckIds;
  if (!sameTextSequence(
    failedCheckIds,
    checkIds.filter((id) => failedCheckIds.includes(id))
  )) {
    return false;
  }
  const checks = new Map(
    observation.data.reviewChecks.map((check) => [check.id, check])
  );
  const issues = value.issues;
  return failedCheckIds.every((id) => {
    const check = checks.get(id);
    return check !== undefined && issues.includes(check.issue);
  });
};
