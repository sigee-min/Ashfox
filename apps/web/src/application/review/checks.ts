import {
  isDenseContractArray,
  hasExactContractKeys,
  isClosedContractRecord,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import {
  VISUAL_REVIEW_ISSUES,
  type VisualReviewCheck,
  type VisualReviewIssue
} from './observation';

const REVIEW_CHECK_KEYS = new Set([
  'id',
  'issue',
  'instruction'
]);

const VISUAL_REVIEW_ISSUE_SET: ReadonlySet<unknown> =
  new Set(VISUAL_REVIEW_ISSUES);

const isVisualReviewIssue = (
  value: unknown
): value is VisualReviewIssue => VISUAL_REVIEW_ISSUE_SET.has(value);

export const isVisualReviewIssueArray = (
  value: unknown
): value is readonly VisualReviewIssue[] =>
  isDenseContractArray(value) &&
  value.every(isVisualReviewIssue) &&
  new Set(value).size === value.length;

const isReviewCheck = (value: unknown): value is VisualReviewCheck =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, REVIEW_CHECK_KEYS) &&
  isNonEmptyContractText(value.id) &&
  isVisualReviewIssue(value.issue) &&
  isNonEmptyContractText(value.instruction);

export const isReviewCheckArray = (
  value: unknown
): value is readonly VisualReviewCheck[] =>
  isDenseContractArray(value) &&
  value.every(isReviewCheck) &&
  new Set(value.map((check) => check.id)).size === value.length;
