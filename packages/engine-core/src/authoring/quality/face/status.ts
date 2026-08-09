import type { PartSpec } from '../../../modeling/part';
import type {
  AuthoringPlanIssue
} from '../../plan/contract';
import type {
  ArchetypeReference,
  AuthoringFaceComponent,
  AuthoringFaceException,
  AuthoringFaceMode,
  AuthoringMouthState,
  AuthoringProfile
} from '../../contract';
import { authoringPlanIssue } from '../issues';
import type { FaceComponentCoverage } from './coverage';
import type { FaceComponentReflectionEvaluation } from './reflection';

export interface FaceComponentQualityStatus {
  component: AuthoringFaceComponent;
  form: string;
  slotIds: readonly string[];
  completeSlotIds: readonly string[];
  missingSlotIds: readonly string[];
  partIds: readonly string[];
  realizedPartIds: readonly string[];
  materialIds: readonly string[];
  realizedMaterialIds: readonly string[];
  missingMaterialIds: readonly string[];
  readableEyePartIds: readonly string[];
  state: 'complete' | 'incomplete';
}

export interface FaceQualityEvaluation {
  mode: AuthoringFaceMode;
  hostSlotId: string | null;
  mouthState: AuthoringMouthState | null;
  hostReady: boolean;
  components: readonly FaceComponentQualityStatus[];
  exceptions: readonly AuthoringFaceException[];
  issues: readonly AuthoringPlanIssue[];
  violations: readonly AuthoringPlanIssue[];
  ready: boolean;
}

const incompleteComponentIsViolation = (
  component: AuthoringFaceComponent,
  materializedPartCount: number,
  semanticPartCount: number,
  missingMaterialCount: number
): boolean => materializedPartCount > 0 && (
  component === 'eye' ||
  semanticPartCount !== materializedPartCount ||
  (semanticPartCount > 0 && missingMaterialCount > 0)
);

interface FaceComponentStatusInput {
  readonly authority: ArchetypeReference;
  readonly coverage: FaceComponentCoverage;
  readonly reflection: FaceComponentReflectionEvaluation;
  readonly hostReady: boolean;
  readonly geometryHostReady: boolean;
  readonly invalidComponents: ReadonlySet<AuthoringFaceComponent>;
}

export interface FaceComponentStatusEvaluation {
  readonly component: FaceComponentQualityStatus;
  readonly issues: readonly AuthoringPlanIssue[];
  readonly violations: readonly AuthoringPlanIssue[];
}

export const evaluateFaceComponentStatus = (
  input: FaceComponentStatusInput
): FaceComponentStatusEvaluation => {
  const declaration = input.coverage.declaration;
  const state =
    input.hostReady &&
    input.geometryHostReady &&
    !input.invalidComponents.has(declaration.component) &&
    input.coverage.missingSlotIds.length === 0 &&
    input.coverage.semanticPartCount > 0 &&
    input.coverage.semanticPartCount === input.coverage.materializedPartCount &&
    input.coverage.missingMaterialIds.length === 0 &&
    input.reflection.ready
      ? 'complete' as const
      : 'incomplete' as const;
  const issue = state === 'complete'
    ? null
    : authoringPlanIssue(
        declaration.component === 'eye'
          ? 'authoring.plan.face_eye_unreadable'
          : 'authoring.plan.face_component_incomplete',
        `authoringProfile.face.components.${declaration.component}`,
        declaration.component === 'eye'
          ? 'Full-face eye configuration is not readable in the delivered model.'
          : `Full-face component "${declaration.component}" is not materially realized below its host.`,
        declaration.component === 'eye'
          ? `${input.reflection.expectedEyeCount} spatially distinct eye feature(s), each at least 3x3, visible and contrasting on the compiled outer surface`
          : 'all declared component slots complete with descendant parts using every explicit component material',
        { authority: input.authority, partIds: input.coverage.partIds }
      );
  const violation = issue && incompleteComponentIsViolation(
    declaration.component,
    input.coverage.materializedPartCount,
    input.coverage.semanticPartCount,
    input.coverage.missingMaterialIds.length
  ) ? issue : null;
  return {
    component: {
      component: declaration.component,
      form: declaration.form,
      slotIds: input.coverage.slotIds,
      completeSlotIds: input.coverage.completeSlotIds,
      missingSlotIds: input.coverage.missingSlotIds,
      partIds: input.coverage.partIds,
      realizedPartIds: input.coverage.semanticPartIds,
      materialIds: declaration.materialIds,
      realizedMaterialIds: input.coverage.realizedMaterialIds,
      missingMaterialIds: input.coverage.missingMaterialIds,
      readableEyePartIds: input.coverage.readableEyes.map((eye) => eye.partId),
      state
    },
    issues: issue ? [issue] : [],
    violations: violation ? [violation] : []
  };
};

export const evaluateNoFaceQuality = (
  profile: AuthoringProfile,
  parts: readonly PartSpec[]
): FaceQualityEvaluation => {
  const facialFeaturePartIds = parts.flatMap((part) =>
    part.kind === 'feature' &&
    (part.motif === 'eye' || part.motif === 'nose' || part.motif === 'mouth')
      ? [part.partId]
      : []
  );
  const issues = facialFeaturePartIds.length === 0
    ? []
    : [authoringPlanIssue(
        'authoring.plan.face_mode_invalid',
        'authoringProfile.faceMode',
        'Facial focal features exist while the profile explicitly declares no face.',
        'remove eye/nose/mouth features or configure one full face contract before authoring them',
        { authority: profile.archetype, partIds: facialFeaturePartIds }
      )];
  return {
    mode: profile.faceMode,
    hostSlotId: null,
    mouthState: null,
    hostReady: true,
    components: [],
    exceptions: [],
    issues,
    violations: issues,
    ready: issues.length === 0
  };
};
