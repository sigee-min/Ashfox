import {
  blockingCanonicalAnimationPreviewIssues,
  canonicalJsonString,
  INTERNAL_CONTRACT_VERSIONS,
  isCurrentInternalContractVersion,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  VISUAL_REVIEW_RENDERER_IDENTIFIER
} from '../rendering/rendererIdentifier';
import {
  hasExactContractKeys,
  isCanonicalIsoDate,
  isClosedContractRecord,
  isNonEmptyContractText,
  isUniqueContractTextArray
} from '@ashfox/internal-contracts';
import {
  VISUAL_REVIEW_CAMERAS,
  VISUAL_REVIEW_ISSUES,
  VISUAL_REVIEW_MILESTONES,
  type PresentedReviewCheck,
  type VisualReviewObservation,
  type VisualReviewIssue
} from './visualReviewContract';
import { presentedReviewChecks } from './visualReviewContract';
import { canonicalFingerprint } from './canonicalFingerprint';
import { isPixelFrameEvidence } from '../rendering/pixelFrameEvidence';

export const VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.visualReviewReceipt;

export interface VisualReviewDecision {
  verdict: 'accepted' | 'rejected';
  issues: readonly VisualReviewIssue[];
  acknowledgedCheckIds: readonly string[];
  failedCheckIds: readonly string[];
}

export interface VisualReviewReceipt {
  schemaVersion: typeof VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION;
  projectId: string;
  revision: string;
  observation: VisualReviewObservation;
  decision: VisualReviewDecision;
  recordedAt: string;
  rendererIdentifier: string;
  actorId: string;
  evidenceFingerprint: string;
}

export interface VisualReviewReceiptMetadata {
  actorId: string;
  recordedAt: string;
}

const RECEIPT_KEYS = new Set([
  'schemaVersion',
  'projectId',
  'revision',
  'observation',
  'decision',
  'recordedAt',
  'rendererIdentifier',
  'actorId',
  'evidenceFingerprint'
]);

const OBSERVATION_KEYS = new Set(['ok', 'revision', 'data']);
const OBSERVATION_DATA_KEYS = new Set([
  'review',
  'purpose',
  'milestone',
  'verdict',
  'issues',
  'acknowledgedCheckIds',
  'failedCheckIds',
  'frameNonce',
  'mode',
  'camera',
  'cameraMatrix',
  'frameEvidence',
  'clipId',
  'playing',
  'observedTimeSeconds',
  'completedCycles',
  'previewIssues',
  'reviewChecks'
]);
const DECISION_KEYS = new Set([
  'verdict',
  'issues',
  'acknowledgedCheckIds',
  'failedCheckIds'
]);
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

const VISUAL_REVIEW_ISSUE_SET =
  new Set<VisualReviewIssue>(VISUAL_REVIEW_ISSUES);
const CAMERA_SET = new Set(VISUAL_REVIEW_CAMERAS);
const MILESTONE_SET = new Set(VISUAL_REVIEW_MILESTONES);

const sameTextSequence = (
  left: readonly string[],
  right: readonly string[]
): boolean =>
  left.length === right.length &&
  left.every((value, index) => value === right[index]);

const isVisualReviewIssueArray = (
  value: unknown
): value is readonly VisualReviewIssue[] =>
  Array.isArray(value) &&
  value.every((issue) => VISUAL_REVIEW_ISSUE_SET.has(issue)) &&
  new Set(value).size === value.length;

const isPresentedEvidenceCriterion = (
  value: unknown
): boolean =>
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
): boolean =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, AUTHORITY_CLAIM_KEYS) &&
  isNonEmptyContractText(value.criterionId) &&
  (value.basis === 'observed' || value.basis === 'requested') &&
  isUniqueContractTextArray(value.referenceIds) &&
  value.referenceIds.length > 0 &&
  isNonEmptyContractText(value.rationale);

const isPresentedReviewEvidence = (
  value: unknown
): boolean => {
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

const isReviewCheck = (
  value: unknown
): value is PresentedReviewCheck =>
  isClosedContractRecord(value) &&
  hasExactContractKeys(value, REVIEW_CHECK_KEYS) &&
  isNonEmptyContractText(value.id) &&
  isUniqueContractTextArray(value.facets) &&
  VISUAL_REVIEW_ISSUE_SET.has(value.issue as VisualReviewIssue) &&
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

const isReviewCheckArray = (
  value: unknown
): value is readonly PresentedReviewCheck[] =>
  Array.isArray(value) &&
  value.every(isReviewCheck) &&
  new Set(value.map((check) => check.id)).size === value.length;

const isFiniteNumberArray = (
  value: unknown,
  length: number
): value is readonly number[] =>
  Array.isArray(value) &&
  value.length === length &&
  value.every((entry) => typeof entry === 'number' && Number.isFinite(entry));

const isPendingObservation = (
  value: unknown,
  document: ProjectDocument
): value is VisualReviewObservation => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, OBSERVATION_KEYS) ||
    value.ok !== true ||
    value.revision !== document.revision ||
    !isClosedContractRecord(value.data) ||
    !hasExactContractKeys(value.data, OBSERVATION_DATA_KEYS)
  ) {
    return false;
  }
  const data = value.data;
  const reviewIsValid = data.review === 'next' || data.review === 'preview';
  const purposeIsValid =
    (data.review === 'next' && data.purpose === 'delivery') ||
    (data.review === 'preview' && data.purpose === 'preview');
  const milestoneIsValid = data.milestone === null ||
    (data.review === 'preview' &&
      MILESTONE_SET.has(
        data.milestone as (typeof VISUAL_REVIEW_MILESTONES)[number]
      ));
  const clipId = isNonEmptyContractText(data.clipId)
    ? data.clipId
    : null;
  const clipIsValid = data.clipId === null || clipId !== null;
  const modeIsValid = data.mode === 'frame' || data.mode === 'cycle';
  const cycleIsValid = data.mode === 'cycle'
    ? clipId !== null &&
      document.animations[clipId] !== undefined &&
      Number.isSafeInteger(data.completedCycles) &&
      (data.completedCycles as number) >= 1
    : data.clipId === null && data.completedCycles === 0;
  const previewPathIsValid = data.clipId === null || (
    clipId !== null &&
    document.animations[clipId] !== undefined &&
    blockingCanonicalAnimationPreviewIssues(
      document.animations[clipId]
    ).length === 0
  );
  const generatedPathIsValid = data.review === 'preview'
    ? data.mode === 'frame' && data.clipId === null
    : data.mode === 'frame'
      ? data.clipId === null
      : data.camera === 'perspective';
  return reviewIsValid &&
    purposeIsValid &&
    milestoneIsValid &&
    data.verdict === 'pending' &&
    Array.isArray(data.issues) && data.issues.length === 0 &&
    Array.isArray(data.acknowledgedCheckIds) &&
      data.acknowledgedCheckIds.length === 0 &&
    Array.isArray(data.failedCheckIds) &&
      data.failedCheckIds.length === 0 &&
    Number.isSafeInteger(data.frameNonce) &&
      (data.frameNonce as number) > 0 &&
    modeIsValid &&
    CAMERA_SET.has(
      data.camera as (typeof VISUAL_REVIEW_CAMERAS)[number]
    ) &&
    isFiniteNumberArray(data.cameraMatrix, 16) &&
    isPixelFrameEvidence(data.frameEvidence) &&
    clipIsValid &&
    data.playing === false &&
    typeof data.observedTimeSeconds === 'number' &&
      Number.isFinite(data.observedTimeSeconds) &&
      data.observedTimeSeconds === 0 &&
    cycleIsValid &&
    previewPathIsValid &&
    generatedPathIsValid &&
    Array.isArray(data.previewIssues) &&
      data.previewIssues.length === 0 &&
    isReviewCheckArray(data.reviewChecks) &&
    canonicalJsonString(data.reviewChecks) === canonicalJsonString(
      presentedReviewChecks(
        document,
        data.camera as VisualReviewObservation['data']['camera'],
        data.mode === 'cycle',
        data.clipId as string | null,
        data.milestone as VisualReviewObservation['data']['milestone']
      )
    );
};

const isDecision = (
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
  return value.failedCheckIds.every((id) => {
    const check = checks.get(id);
    return check !== undefined && issues.includes(check.issue);
  });
};

type ReceiptWithoutFingerprint = Omit<
  VisualReviewReceipt,
  'evidenceFingerprint'
>;

const evidenceFingerprintFor = (
  document: ProjectDocument,
  receipt: ReceiptWithoutFingerprint
): string =>
  canonicalFingerprint({
    receipt,
    document
  });

export const visualReviewReceiptFrom = (
  document: ProjectDocument,
  observation: VisualReviewObservation,
  reviewed: VisualReviewObservation,
  metadata: VisualReviewReceiptMetadata
): VisualReviewReceipt | null => {
  const reconstructedObservation: VisualReviewObservation = {
    ...reviewed,
    data: {
      ...reviewed.data,
      review: observation.data.review,
      verdict: 'pending',
      issues: [],
      acknowledgedCheckIds: [],
      failedCheckIds: []
    }
  };
  if (
    observation.data.verdict !== 'pending' ||
    reviewed.data.verdict === 'pending' ||
    observation.revision !== reviewed.revision ||
    canonicalJsonString(reconstructedObservation) !==
      canonicalJsonString(observation) ||
    document.id.length === 0 ||
    document.revision !== observation.revision
  ) {
    return null;
  }
  const receipt: ReceiptWithoutFingerprint = {
    schemaVersion: VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION,
    projectId: document.id,
    revision: document.revision,
    observation: structuredClone(observation),
    decision: {
      verdict: reviewed.data.verdict,
      issues: [...reviewed.data.issues],
      acknowledgedCheckIds: [...reviewed.data.acknowledgedCheckIds],
      failedCheckIds: [...reviewed.data.failedCheckIds]
    },
    recordedAt: metadata.recordedAt,
    rendererIdentifier: VISUAL_REVIEW_RENDERER_IDENTIFIER,
    actorId: metadata.actorId
  };
  const complete: VisualReviewReceipt = {
    ...receipt,
    evidenceFingerprint: evidenceFingerprintFor(document, receipt)
  };
  return isValidVisualReviewReceipt(complete, document)
    ? complete
    : null;
};

export const isValidVisualReviewReceipt = (
  value: unknown,
  document: ProjectDocument
): value is VisualReviewReceipt => {
  if (
    !isClosedContractRecord(value) ||
    !hasExactContractKeys(value, RECEIPT_KEYS) ||
    !isCurrentInternalContractVersion(
      'visualReviewReceipt',
      value.schemaVersion
    ) ||
    value.projectId !== document.id ||
    value.revision !== document.revision ||
    !isPendingObservation(value.observation, document) ||
    !isDecision(value.decision, value.observation) ||
    !isCanonicalIsoDate(value.recordedAt) ||
    value.rendererIdentifier !== VISUAL_REVIEW_RENDERER_IDENTIFIER ||
    !isNonEmptyContractText(value.actorId) ||
    typeof value.evidenceFingerprint !== 'string'
  ) {
    return false;
  }
  const receipt: ReceiptWithoutFingerprint = {
    schemaVersion: VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION,
    projectId: document.id,
    revision: document.revision,
    observation: value.observation,
    decision: value.decision,
    recordedAt: value.recordedAt,
    rendererIdentifier: VISUAL_REVIEW_RENDERER_IDENTIFIER,
    actorId: value.actorId
  };
  return value.evidenceFingerprint === evidenceFingerprintFor(
    document,
    receipt
  );
};

const receiptKey = (
  receipt: VisualReviewReceipt
): string => {
  const data = receipt.observation.data;
  return JSON.stringify([
    data.purpose,
    data.milestone,
    data.mode,
    data.camera,
    data.clipId
  ]);
};

const receiptOrder = (
  left: VisualReviewReceipt,
  right: VisualReviewReceipt
): number => {
  const byTime = left.recordedAt.localeCompare(right.recordedAt);
  if (byTime !== 0) return byTime;
  const byFrame = left.observation.data.frameNonce -
    right.observation.data.frameNonce;
  if (byFrame !== 0) return byFrame;
  return left.evidenceFingerprint.localeCompare(right.evidenceFingerprint);
};

export const recordVisualReview = (
  receipts: readonly VisualReviewReceipt[],
  receipt: VisualReviewReceipt
): readonly VisualReviewReceipt[] => {
  const active = receipts.filter(
    (candidate) =>
      candidate.projectId === receipt.projectId &&
      candidate.revision === receipt.revision
  );
  const matching = active.find(
    (candidate) => receiptKey(candidate) === receiptKey(receipt)
  );
  const winner = matching && receiptOrder(matching, receipt) > 0
    ? matching
    : structuredClone(receipt);
  return [
    ...active.filter(
      (candidate) => receiptKey(candidate) !== receiptKey(receipt)
    ),
    winner
  ].sort((left, right) => receiptKey(left).localeCompare(receiptKey(right)));
};

export const mergeVisualReviewLedgers = (
  left: readonly VisualReviewReceipt[],
  right: readonly VisualReviewReceipt[]
): readonly VisualReviewReceipt[] =>
  right.reduce(
    (ledger, receipt) => recordVisualReview(ledger, receipt),
    left
  );

export const areVisualReviewLedgersEqual = (
  left: readonly VisualReviewReceipt[],
  right: readonly VisualReviewReceipt[]
): boolean => canonicalJsonString(left) === canonicalJsonString(right);

export const isValidVisualReviewLedger = (
  value: unknown,
  document: ProjectDocument
): value is readonly VisualReviewReceipt[] => {
  if (!Array.isArray(value)) return false;
  if (!value.every((receipt) => isValidVisualReviewReceipt(receipt, document))) {
    return false;
  }
  const keys = value.map((receipt) => receiptKey(receipt));
  if (new Set(keys).size !== value.length) return false;
  const canonicalKeys = [...keys].sort((left, right) =>
    left.localeCompare(right)
  );
  return keys.every((key, index) => key === canonicalKeys[index]);
};

export const visualReviewPlanItem = (
  receipt: VisualReviewReceipt
): Pick<
  VisualReviewObservation['data'],
  'mode' | 'camera' | 'clipId'
> => ({
  mode: receipt.observation.data.mode,
  camera: receipt.observation.data.camera,
  clipId: receipt.observation.data.clipId
});

export const visualReviewsForRevision = (
  receipts: readonly VisualReviewReceipt[],
  projectId: string,
  revision: string
): readonly VisualReviewReceipt[] =>
  receipts.filter(
    (receipt) =>
      receipt.projectId === projectId &&
      receipt.revision === revision
  );

export const deliveryVisualReviewsForRevision = (
  receipts: readonly VisualReviewReceipt[],
  projectId: string,
  revision: string
): readonly VisualReviewReceipt[] =>
  visualReviewsForRevision(receipts, projectId, revision)
    .filter(
      (receipt) => receipt.observation.data.purpose === 'delivery'
    );

export const rejectedVisualReviewsForRevision = (
  receipts: readonly VisualReviewReceipt[],
  projectId: string,
  revision: string
): readonly VisualReviewReceipt[] =>
  deliveryVisualReviewsForRevision(receipts, projectId, revision)
    .filter((receipt) => receipt.decision.verdict === 'rejected');
