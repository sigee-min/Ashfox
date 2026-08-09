import {
  canonicalJsonString,
  isCurrentInternalContractVersion,
  type ProjectDocument
} from '@ashfox/engine-core';
import {
  hasExactContractKeys,
  isCanonicalIsoDate,
  isClosedContractRecord,
  isNonEmptyContractText
} from '@ashfox/internal-contracts';

import { VISUAL_REVIEW_RENDERER_IDENTIFIER } from '../../rendering/rendererIdentifier';
import type { VisualReviewObservation } from './observation';
import {
  VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION,
  type UnsignedVisualReviewReceipt,
  type VisualReviewReceipt,
  type VisualReviewReceiptMetadata
} from './schema';
import { visualReviewEvidenceFingerprint } from './fingerprint';
import {
  isPendingVisualReviewObservation
} from './reader';
import { isVisualReviewDecision } from './decision';

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
  const receipt: UnsignedVisualReviewReceipt = {
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
    evidenceFingerprint: visualReviewEvidenceFingerprint(document, receipt)
  };
  return isValidVisualReviewReceipt(complete, document) ? complete : null;
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
    !isPendingVisualReviewObservation(value.observation, document) ||
    !isVisualReviewDecision(value.decision, value.observation) ||
    !isCanonicalIsoDate(value.recordedAt) ||
    value.rendererIdentifier !== VISUAL_REVIEW_RENDERER_IDENTIFIER ||
    !isNonEmptyContractText(value.actorId) ||
    typeof value.evidenceFingerprint !== 'string'
  ) {
    return false;
  }
  const receipt: UnsignedVisualReviewReceipt = {
    schemaVersion: VISUAL_REVIEW_RECEIPT_SCHEMA_VERSION,
    projectId: document.id,
    revision: document.revision,
    observation: value.observation,
    decision: value.decision,
    recordedAt: value.recordedAt,
    rendererIdentifier: VISUAL_REVIEW_RENDERER_IDENTIFIER,
    actorId: value.actorId
  };
  return value.evidenceFingerprint ===
    visualReviewEvidenceFingerprint(document, receipt);
};
