import {
  AUTHORING_REVIEW_CAMERAS,
  AUTHORING_REVIEW_ISSUES,
  authoringReviewChecks,
  resolveArchetypeReference,
  resolveSpecialistReference,
  type ProjectDocument
} from '@ashfox/engine-core';
import type {
  AnimationPreviewIssue,
  AppliedAuthoringReviewCheck,
  AuthoringAuthorityClaim,
  AuthoringReviewIssue,
  EvidenceCriterionDefinition
} from '@ashfox/engine-core';
import type { CameraMode } from '../rendering/cameraPresets';

export const VISUAL_REVIEW_ISSUES = AUTHORING_REVIEW_ISSUES;
export type VisualReviewIssue = AuthoringReviewIssue;

export const VISUAL_REVIEW_MILESTONES = [
  'archetype',
  'specialists'
] as const;
export type VisualReviewMilestone =
  (typeof VISUAL_REVIEW_MILESTONES)[number];

export const VISUAL_REVIEW_CAMERAS = AUTHORING_REVIEW_CAMERAS;
export type VisualReviewCamera =
  (typeof VISUAL_REVIEW_CAMERAS)[number];

export interface PresentedReviewEvidence {
  criteria: readonly Pick<
    EvidenceCriterionDefinition,
    'id' | 'basis' | 'required' | 'instruction'
  >[];
  claims: readonly Pick<
    AuthoringAuthorityClaim,
    'criterionId' | 'basis' | 'referenceIds' | 'rationale'
  >[];
}

export type PresentedReviewCheck = Pick<
  AppliedAuthoringReviewCheck,
  | 'id'
  | 'facets'
  | 'issue'
  | 'instruction'
  | 'authority'
  | 'authorityType'
> & {
  evidence: PresentedReviewEvidence;
};

export interface VisualReviewObservation {
  ok: true;
  revision: string;
  data: {
    review: 'next' | 'preview' | 'accept' | 'reject';
    purpose: 'delivery' | 'preview';
    milestone: VisualReviewMilestone | null;
    verdict: 'pending' | 'accepted' | 'rejected';
    issues: readonly VisualReviewIssue[];
    acknowledgedCheckIds: readonly string[];
    failedCheckIds: readonly string[];
    frameNonce: number;
    mode: 'frame' | 'cycle';
    camera: CameraMode;
    cameraMatrix: readonly number[];
    clipId: string | null;
    playing: boolean;
    observedTimeSeconds: number;
    completedCycles: number;
    previewIssues: readonly AnimationPreviewIssue[];
    reviewChecks: readonly PresentedReviewCheck[];
  };
}

export const presentedReviewChecks = (
  document: ProjectDocument,
  camera: CameraMode,
  motion: boolean,
  clipId: string | null,
  milestone: VisualReviewMilestone | null
): readonly PresentedReviewCheck[] =>
  authoringReviewChecks(
    document.authoringProfile,
    camera,
    motion
      ? { facet: 'motion', clipId }
      : {}
  )
    .filter((check) => {
      if (!motion && check.facets.includes('motion')) return false;
      if (milestone === null) return true;
      return milestone === 'archetype'
        ? check.authorityType === 'archetype'
        : true;
    })
    .map(({
      id,
      facets,
      issue,
      instruction,
      authority,
      authorityType
    }) => {
      const definition = authorityType === 'archetype'
        ? resolveArchetypeReference(authority)
        : resolveSpecialistReference(authority);
      return {
        id,
        facets,
        issue,
        instruction,
        authority,
        authorityType,
        evidence: {
          criteria: (definition?.evidenceCriteria ?? []).map(
            (criterion) => ({
              id: criterion.id,
              basis: criterion.basis,
              required: criterion.required,
              instruction: criterion.instruction
            })
          ),
          claims: (document.authoringProfile?.claims ?? [])
            .filter((claim) => claim.authority.id === authority.id)
            .map((claim) => ({
              criterionId: claim.criterionId,
              basis: claim.basis,
              referenceIds: [...claim.referenceIds],
              rationale: claim.rationale
            }))
        }
      };
    });
