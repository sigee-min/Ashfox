import type { ProjectDocument, ProjectIntent } from '../../model';
import type {
  PartMaterialDefinition,
  PartSpec
} from '../../modeling/part';
import {
  evaluateFaceQuality,
  type FaceQualityEvaluation
} from './face';
import {
  evaluateIntentCoverage,
  type IntentCoverageEvaluation
} from './coverage';
import type { AuthoringSlotStatus } from '../plan/contract';
import {
  evaluateRestPoseQuality,
  type RestPoseQualityEvaluation
} from './rest';
import {
  evaluateSpanQuality,
  type SpanQualityEvaluation
} from './span';
import {
  evaluateStructuralQuality,
  type StructuralQualityEvaluation
} from './structure';
import {
  evaluateSymmetryQuality,
  type SymmetryQualityEvaluation
} from './symmetry';
import {
  evaluateSupportQuality,
  type SupportQualityEvaluation
} from './support';
import type {
  AuthoringProfile,
  AuthoringQualityStage,
  AuthoringTrack
} from '../contract';

export const AUTHORING_ASSET_QUALITY_DIMENSIONS = [
  'silhouette',
  'structure',
  'focal',
  'symmetry',
  'support',
  'span',
  'rest-pose',
  'semantic-coverage',
  'face'
] as const;

export type AuthoringAssetQualityDimension =
  (typeof AUTHORING_ASSET_QUALITY_DIMENSIONS)[number];

export type AuthoringAssetQualityStage =
  | AuthoringQualityStage
  | 'surface'
  | 'complete';

export interface AuthoringAssetQualityDimensionStatus {
  dimension: AuthoringAssetQualityDimension;
  required: boolean;
  state: 'passed' | 'incomplete' | 'not-applicable';
  issueCount: number;
}

export interface AssetQualityEvaluation {
  track: AuthoringTrack;
  activeStage: AuthoringAssetQualityStage;
  dimensions: readonly AuthoringAssetQualityDimensionStatus[];
  structuralQuality: StructuralQualityEvaluation;
  symmetryQuality: SymmetryQualityEvaluation;
  supportQuality: SupportQualityEvaluation;
  spanQuality: SpanQualityEvaluation;
  restPoseQuality: RestPoseQualityEvaluation;
  intentCoverage: IntentCoverageEvaluation;
  faceQuality: FaceQualityEvaluation;
  ready: boolean;
}

export const evaluateAssetQuality = (
  document: ProjectDocument,
  intent: ProjectIntent,
  profile: AuthoringProfile,
  slots: readonly AuthoringSlotStatus[],
  parts: readonly PartSpec[],
  materials: readonly PartMaterialDefinition[]
): AssetQualityEvaluation => {
  const structuralQuality = evaluateStructuralQuality(slots);
  const symmetryQuality = evaluateSymmetryQuality(document, profile);
  const supportQuality = evaluateSupportQuality(document, profile);
  const spanQuality = evaluateSpanQuality(document, profile);
  const restPoseQuality = evaluateRestPoseQuality(document, profile);
  const intentCoverage = evaluateIntentCoverage(
    profile,
    intent,
    slots,
    parts,
    materials
  );
  const faceQuality = evaluateFaceQuality(
    document,
    profile,
    slots,
    parts,
    materials
  );
  const dimensions: AuthoringAssetQualityDimensionStatus[] = [
    ...structuralQuality.gates.map((gate) => ({
      dimension: gate.stage,
      required: gate.requiredSlotIds.length > 0,
      state: gate.state === 'passed' ? 'passed' as const : 'incomplete' as const,
      issueCount:
        gate.incompleteSlotIds.length + Number(gate.state === 'violated')
    })),
    {
      dimension: 'symmetry',
      required: symmetryQuality.required,
      state: !symmetryQuality.required
        ? 'not-applicable'
        : symmetryQuality.ready
          ? 'passed'
          : 'incomplete',
      issueCount: symmetryQuality.issues.length
    },
    {
      dimension: 'support',
      required: supportQuality.statuses.some(
        (status) => status.supportKind !== 'none'
      ),
      state: supportQuality.statuses.every(
        (status) => status.supportKind === 'none'
      )
        ? 'not-applicable'
        : supportQuality.ready
          ? 'passed'
          : 'incomplete',
      issueCount: supportQuality.issues.length
    },
    {
      dimension: 'span',
      required: spanQuality.statuses.some(
        (status) => status.spanKind === 'supported-surface'
      ),
      state: spanQuality.statuses.every(
        (status) => status.spanKind === 'none'
      )
        ? 'not-applicable'
        : spanQuality.ready
          ? 'passed'
          : 'incomplete',
      issueCount: spanQuality.issues.length
    },
    {
      dimension: 'rest-pose',
      required: true,
      state: restPoseQuality.ready ? 'passed' : 'incomplete',
      issueCount: restPoseQuality.issues.length
    },
    {
      dimension: 'semantic-coverage',
      required: true,
      state: intentCoverage.ready ? 'passed' : 'incomplete',
      issueCount: intentCoverage.issues.length
    },
    {
      dimension: 'face',
      required: profile.faceMode === 'full',
      state: profile.faceMode === 'none'
        ? 'not-applicable'
        : faceQuality.ready
          ? 'passed'
          : 'incomplete',
      issueCount: faceQuality.issues.length
    }
  ];
  const activeStage: AuthoringAssetQualityStage =
    structuralQuality.activeStage !== 'complete'
      ? structuralQuality.activeStage
      : !symmetryQuality.ready
        ? 'structure'
        : !supportQuality.ready
          ? 'structure'
          : !spanQuality.ready
            ? 'structure'
            : !restPoseQuality.ready
              ? 'structure'
              : !faceQuality.ready
                ? 'focal'
                : !intentCoverage.ready
                  ? 'surface'
                  : 'complete';
  return {
    track: profile.track,
    activeStage,
    dimensions,
    structuralQuality,
    symmetryQuality,
    supportQuality,
    spanQuality,
    restPoseQuality,
    intentCoverage,
    faceQuality,
    ready:
      structuralQuality.ready &&
      symmetryQuality.ready &&
      supportQuality.ready &&
      spanQuality.ready &&
      restPoseQuality.ready &&
      intentCoverage.ready &&
      faceQuality.ready
  };
};
