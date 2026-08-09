import { isCurrentInternalContractVersion } from '@ashfox/engine-core';
import {
  hasExactContractKeys,
  isClosedContractRecord,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';

import {
  VISUAL_REVIEW_ISSUES,
  type PresentedReviewCheck,
  type PresentedReviewEvidence,
  type VisualReviewIssue
} from './observation';

const REVIEW_CHECK_KEYS = new Set([
  'id',
  'facets',
  'issue',
  'instruction',
  'authority',
  'authorityType',
  'evidence'
]);
const AUTHORITY_REFERENCE_KEYS = new Set(['id', 'version']);
const REVIEW_EVIDENCE_KEYS = new Set(['criteria', 'claims']);
const EVIDENCE_CRITERION_KEYS = new Set([
  'id',
  'basis',
  'required',
  'instruction'
]);
const AUTHORITY_CLAIM_KEYS = new Set([
  'criterionId',
  'basis',
  'referenceIds',
  'rationale'
]);

const VISUAL_REVIEW_ISSUE_SET: ReadonlySet<unknown> =
  new Set(VISUAL_REVIEW_ISSUES);

const isVisualReviewIssue = (
  value: unknown
): value is VisualReviewIssue => VISUAL_REVIEW_ISSUE_SET.has(value);

export const isVisualReviewIssueArray = (
  value: unknown
): value is readonly VisualReviewIssue[] =>
  Array.isArray(value) &&
  value.every(isVisualReviewIssue) &&
  new Set(value).size === value.length;

type EvidenceCriterion = PresentedReviewEvidence['criteria'][number];
type AuthorityClaim = PresentedReviewEvidence['claims'][number];

const isPresentedEvidenceCriterion = (
  value: unknown
): value is EvidenceCriterion =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, EVIDENCE_CRITERION_KEYS) &&
  isNonEmptyContractText(value.id) &&
  (value.basis === 'observed' ||
    value.basis === 'requested' ||
    value.basis === 'either') &&
  typeof value.required === 'boolean' &&
  isNonEmptyContractText(value.instruction);

const isPresentedAuthorityClaim = (
  value: unknown
): value is AuthorityClaim =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, AUTHORITY_CLAIM_KEYS) &&
  isNonEmptyContractText(value.criterionId) &&
  (value.basis === 'observed' || value.basis === 'requested') &&
  isUniqueContractTextArray(value.referenceIds) &&
  value.referenceIds.length > 0 &&
  isNonEmptyContractText(value.rationale);

const isPresentedReviewEvidence = (
  value: unknown
): value is PresentedReviewEvidence => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, REVIEW_EVIDENCE_KEYS) ||
    !Array.isArray(value.criteria) ||
    !Array.isArray(value.claims) ||
    !value.criteria.every(isPresentedEvidenceCriterion) ||
    !value.claims.every(isPresentedAuthorityClaim)
  ) {
    return false;
  }
  return new Set(
    value.criteria.map((criterion) => criterion.id)
  ).size === value.criteria.length;
};

const isReviewCheck = (value: unknown): value is PresentedReviewCheck =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, REVIEW_CHECK_KEYS) &&
  isNonEmptyContractText(value.id) &&
  isUniqueContractTextArray(value.facets) &&
  isVisualReviewIssue(value.issue) &&
  isNonEmptyContractText(value.instruction) &&
  isClosedContractRecord(value.authority) &&
  hasExactContractKeys(value.authority, AUTHORITY_REFERENCE_KEYS) &&
  isNonEmptyContractText(value.authority.id) &&
  isCurrentInternalContractVersion(
    'authoringProfile',
    value.authority.version
  ) &&
  (value.authorityType === 'archetype' ||
    value.authorityType === 'specialist') &&
  isPresentedReviewEvidence(value.evidence);

export const isReviewCheckArray = (
  value: unknown
): value is readonly PresentedReviewCheck[] =>
  Array.isArray(value) &&
  value.every(isReviewCheck) &&
  new Set(value.map((check) => check.id)).size === value.length;
