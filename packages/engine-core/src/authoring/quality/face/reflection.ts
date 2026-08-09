import type { ProjectDocument } from '../../../model';
import { auditEyeVisibility } from '../../../modeling/eye/visibility';
import type { AuthoringSlotStatus } from '../../plan/contract';
import type { AuthoringPlanIssue } from '../../plan/contract';
import type { ArchetypeReference } from '../../contract';
import { authoringPlanIssue } from '../issues';
import type { FaceComponentCoverage } from './coverage';
import { evaluateFaceEyeSpatialQuality } from './eye';

export interface FaceComponentReflectionEvaluation {
  readonly ready: boolean;
  readonly expectedEyeCount: number;
  readonly spatialIssues: readonly AuthoringPlanIssue[];
  readonly visibilityIssues: readonly AuthoringPlanIssue[];
}

interface FaceReflectionInput {
  readonly document: ProjectDocument;
  readonly authority: ArchetypeReference;
  readonly coverages: readonly FaceComponentCoverage[];
  readonly slotsById: ReadonlyMap<string, AuthoringSlotStatus>;
  readonly permittedEyeSurfaceHostSlotIds: ReadonlySet<string>;
}

export const evaluateFaceReflections = (
  input: FaceReflectionInput
): readonly FaceComponentReflectionEvaluation[] => {
  const eyeAuditIssues = auditEyeVisibility(input.document);
  return input.coverages.map((coverage) => {
    const declaration = coverage.declaration;
    if (declaration.component !== 'eye') {
      return {
        ready: true,
        expectedEyeCount: 0,
        spatialIssues: [],
        visibilityIssues: []
      };
    }
    const expectedEyeCount = declaration.configuration.kind === 'paired'
      ? 2
      : 1;
    const relevantEyeIssues = eyeAuditIssues.filter((issue) =>
      coverage.readableEyes.some((eye) => eye.partId === issue.eyePartId)
    );
    const distinctEyeAnchors = new Set(
      coverage.readableEyes.map((eye) => eye.anchor.join(','))
    ).size;
    const spatial = evaluateFaceEyeSpatialQuality(
      input.document,
      input.authority,
      declaration,
      coverage.readableEyes,
      expectedEyeCount,
      input.slotsById,
      input.permittedEyeSurfaceHostSlotIds
    );
    const visibilityIssues = relevantEyeIssues.map((eyeIssue) =>
      authoringPlanIssue(
        'authoring.plan.face_eye_visibility_invalid',
        `modeling.parts.${eyeIssue.eyePartId}`,
        eyeIssue.message,
        'eye fully supported, unobstructed, and contrasting on the delivered outer surface',
        { authority: input.authority, partIds: [eyeIssue.eyePartId] }
      )
    );
    return {
      ready:
        coverage.readableEyes.length === expectedEyeCount &&
        distinctEyeAnchors === expectedEyeCount &&
        relevantEyeIssues.length === 0 &&
        spatial.ready,
      expectedEyeCount,
      spatialIssues: spatial.issue ? [spatial.issue] : [],
      visibilityIssues
    };
  });
};
