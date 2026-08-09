import { deepFreezeAuthoringValue } from '../values';
import type {
  AuthoringFaceComponent,
  AuthoringQualityStage,
  AuthoringReviewCheck,
  AuthoringTrack
} from '../contract';

export interface AuthoringTrackFacePolicy {
  requiredComponents: readonly AuthoringFaceComponent[];
  requireJawWhenMouthPresent: boolean;
  requireInteriorWhenMouthOpen: boolean;
  reviewCheck: AuthoringReviewCheck;
}

export interface AuthoringTrackPolicy {
  label: string;
  requiredQualityStages: readonly AuthoringQualityStage[];
  requireExclusiveCoverageTarget: boolean;
  reviewChecks: readonly AuthoringReviewCheck[];
  face: AuthoringTrackFacePolicy;
}

const policies = deepFreezeAuthoringValue({
  essential: {
    label: 'Essential',
    requiredQualityStages: ['silhouette', 'structure'],
    requireExclusiveCoverageTarget: false,
    reviewChecks: [{
      id: 'composable-form.track-essential-integrity',
      facets: ['silhouette', 'function'],
      cameras: ['native', 'perspective', 'front', 'side', 'top'],
      issue: 'proportion',
      instruction:
        'Confirm the distilled proportions are intentional for an icon, mascot, chibi, or small game piece while silhouette, middle form, contacts, terminals, and semantic material regions remain complete; reject low-effort miniaturization.'
    }],
    face: {
      requiredComponents: ['eye', 'nasal', 'oral'],
      requireJawWhenMouthPresent: false,
      requireInteriorWhenMouthOpen: false,
      reviewCheck: {
        id: 'composable-form.face-essential-budget',
        facets: ['face'],
        cameras: ['perspective', 'native', 'front'],
        issue: 'proportion',
        instruction:
          'Confirm the distilled composition deliberately gives the face enough visual area for its eye configuration, nasal form, mouth state, and expression without collapsing them into one mark.'
      }
    }
  },
  hero: {
    label: 'Hero',
    requiredQualityStages: ['silhouette', 'structure', 'focal'],
    requireExclusiveCoverageTarget: true,
    reviewChecks: [
      {
        id: 'composable-form.track-hero-structure',
        facets: ['silhouette', 'function'],
        cameras: ['native', 'perspective', 'front', 'side', 'top'],
        issue: 'proportion',
        instruction:
          'Confirm the asset preserves requested or observed proportions and separately reads identity-bearing mass rhythm, roots, joints, contacts, openings, terminal forms, and focal framing instead of inflating one childlike block.'
      },
      {
        id: 'composable-form.track-hero-material',
        facets: ['surface-cue', 'function'],
        cameras: ['native', 'perspective', 'front', 'side'],
        issue: 'material',
        instruction:
          'Confirm reference-defining material regions and terminal surfaces use deliberate role-material boundaries; automatic clusters and noise may enrich those regions but may not invent or replace them.'
      }
    ],
    face: {
      requiredComponents: ['eye', 'nasal', 'oral', 'eye-frame'],
      requireJawWhenMouthPresent: true,
      requireInteriorWhenMouthOpen: true,
      reviewCheck: {
        id: 'composable-form.face-hero-separation',
        facets: ['face'],
        cameras: ['perspective', 'native', 'front', 'side'],
        issue: 'focal_detail',
        instruction:
          'Confirm mature or reference proportions remain intact while the eye frame, nasal plane, jaw, mouth state, and any open-mouth interior remain separately readable rather than producing an infantile head.'
      }
    }
  }
} satisfies Readonly<Record<AuthoringTrack, AuthoringTrackPolicy>>);

export const AUTHORING_TRACK_POLICIES: Readonly<
  Record<AuthoringTrack, AuthoringTrackPolicy>
> = policies;

export const authoringTrackPolicy = (
  track: AuthoringTrack
): AuthoringTrackPolicy => AUTHORING_TRACK_POLICIES[track];
