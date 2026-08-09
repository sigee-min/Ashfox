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
import type { CameraMode } from '../../rendering/cameraPresets';
import type { PixelFrameEvidence } from '../../rendering/pixelFrameEvidence';

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
  readonly criteria: readonly Pick<
    EvidenceCriterionDefinition,
    'id' | 'basis' | 'required' | 'instruction'
  >[];
  readonly claims: readonly Pick<
    AuthoringAuthorityClaim,
    'criterionId' | 'basis' | 'referenceIds' | 'rationale'
  >[];
}

export type PresentedReviewCheck = Readonly<Pick<
  AppliedAuthoringReviewCheck,
  | 'id'
  | 'facets'
  | 'issue'
  | 'instruction'
  | 'authority'
  | 'authorityType'
>> & {
  readonly evidence: PresentedReviewEvidence;
};

export interface VisualReviewObservation {
  readonly ok: true;
  readonly revision: string;
  readonly data: {
    readonly review: 'next' | 'preview' | 'accept' | 'reject';
    readonly purpose: 'delivery' | 'preview';
    readonly milestone: VisualReviewMilestone | null;
    readonly verdict: 'pending' | 'accepted' | 'rejected';
    readonly issues: readonly VisualReviewIssue[];
    readonly acknowledgedCheckIds: readonly string[];
    readonly failedCheckIds: readonly string[];
    readonly frameNonce: number;
    readonly mode: 'frame' | 'cycle';
    readonly camera: CameraMode;
    readonly cameraMatrix: readonly number[];
    readonly frameEvidence: PixelFrameEvidence;
    readonly clipId: string | null;
    readonly playing: boolean;
    readonly observedTimeSeconds: number;
    readonly completedCycles: number;
    readonly previewIssues: readonly AnimationPreviewIssue[];
    readonly reviewChecks: readonly PresentedReviewCheck[];
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
