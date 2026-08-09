import type { ProjectDocument } from '../../../model';
import type {
  PartMaterialDefinition,
  PartSpec
} from '../../../modeling/part';
import type { AuthoringSlotStatus } from '../../plan/contract';
import type { AuthoringProfile } from '../../contract';
import { evaluateFaceComponentCoverage } from './coverage';
import { evaluateCanonicalFaceGeometry } from './geometry';
import { evaluateCanonicalFaceHost } from './host';
import { evaluateFaceReflections } from './reflection';
import {
  evaluateFaceComponentStatus,
  evaluateNoFaceQuality,
  type FaceQualityEvaluation
} from './status';

export type {
  FaceComponentQualityStatus,
  FaceQualityEvaluation
} from './status';

export const evaluateFaceQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile,
  slots: readonly AuthoringSlotStatus[],
  parts: readonly PartSpec[],
  materials: readonly PartMaterialDefinition[]
): FaceQualityEvaluation => {
  if (profile.faceMode === 'none' || profile.face === null) {
    return evaluateNoFaceQuality(profile, parts);
  }
  const face = profile.face;
  const archetypeSlots = slots.filter(
    (slot) => slot.authorityType === 'archetype'
  );
  const slotsById = new Map(
    archetypeSlots.map((slot) => [slot.slotId, slot])
  );
  const partsById = new Map(parts.map((part) => [part.partId, part]));
  const explicitMaterialIds = new Set(
    materials.map((material) => material.id)
  );
  const host = evaluateCanonicalFaceHost(
    face,
    profile,
    slotsById,
    partsById
  );
  const geometry = evaluateCanonicalFaceGeometry({
    document,
    authority: profile.archetype,
    face,
    hostPartId: host.partId,
    slotsById,
    partsById,
    permittedEyeSurfaceHostSlotIds: host.permittedEyeSurfaceHostSlotIds
  });
  const coverages = evaluateFaceComponentCoverage({
    face,
    slotsById,
    partsById,
    explicitMaterialIds,
    hostPartIds: host.partIds
  });
  const reflections = evaluateFaceReflections({
    document,
    authority: profile.archetype,
    coverages,
    slotsById,
    permittedEyeSurfaceHostSlotIds: host.permittedEyeSurfaceHostSlotIds
  });
  const statuses = coverages.map((coverage, index) =>
    evaluateFaceComponentStatus({
      authority: profile.archetype,
      coverage,
      reflection: reflections[index]!,
      hostReady: host.ready,
      geometryHostReady: geometry.hostReady,
      invalidComponents: geometry.invalidComponents
    })
  );
  const componentIssues = statuses.flatMap((status, index) => [
    ...reflections[index]!.spatialIssues,
    ...status.issues,
    ...reflections[index]!.visibilityIssues
  ]);
  const componentViolations = statuses.flatMap((status, index) => [
    ...reflections[index]!.spatialIssues,
    ...status.violations,
    ...reflections[index]!.visibilityIssues
  ]);
  return {
    mode: profile.faceMode,
    hostSlotId: face.hostSlotId,
    mouthState: face.mouthState,
    hostReady: host.ready && geometry.hostReady,
    components: statuses.map((status) => status.component),
    exceptions: face.exceptions,
    issues: [
      ...host.issues,
      ...geometry.issues,
      ...componentIssues
    ],
    violations: [
      ...host.violations,
      ...geometry.violations,
      ...componentViolations
    ],
    ready:
      host.ready &&
      geometry.ready &&
      statuses.every((status) => status.component.state === 'complete')
  };
};
