import type { ProjectDocument } from '../model';
import { auditEyeVisibility } from '../modeling/eyeVisibility';
import type {
  EyeFeaturePartSpec,
  PartMaterialDefinition,
  PartSpec
} from '../modeling/partContract';
import type {
  AuthoringPlanIssue,
  AuthoringSlotStatus
} from './authoringPlanTypes';
import { authoringPlanIssue } from './authoringIssueFactories';
import { uniqueSortedAuthoringValues } from './authoringCollections';
import {
  evaluateCanonicalFaceGeometry,
  realizesFaceForm
} from './faceQualityGeometry';
import { evaluateFaceEyeSpatialQuality } from './faceQualityEye';
import type {
  AuthoringFaceComponent,
  AuthoringFaceContract,
  AuthoringFaceException,
  AuthoringFaceMode,
  AuthoringMouthState,
  AuthoringProfile
} from './authoringTypes';
import { authoringFaceComponentSlotIds } from './authoringTypes';

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

const partDescendsFrom = (
  part: PartSpec,
  ancestorPartIds: ReadonlySet<string>,
  partsById: ReadonlyMap<string, PartSpec>
): boolean => {
  let parentId = part.parentPartId;
  const visited = new Set<string>();
  while (parentId !== null && !visited.has(parentId)) {
    if (ancestorPartIds.has(parentId)) return true;
    visited.add(parentId);
    parentId = partsById.get(parentId)?.parentPartId ?? null;
  }
  return false;
};

const canonicalSurfacePart = (
  slot: AuthoringSlotStatus | undefined,
  partsById: ReadonlyMap<string, PartSpec>
): PartSpec | null => {
  if (
    !slot ||
    slot.partIds.length !== 1 ||
    slot.presentPartIds.length !== 1 ||
    slot.partIds[0] !== slot.presentPartIds[0]
  ) {
    return null;
  }
  const part = partsById.get(slot.partIds[0] as string);
  return part && part.kind !== 'feature' ? part : null;
};

const hasFocalFrameAncestor = (
  slot: AuthoringSlotStatus | undefined,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>
): boolean => {
  if (!slot) return false;
  const pending = [...slot.parentSlotIds];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const candidateId = pending.pop();
    if (!candidateId || visited.has(candidateId)) continue;
    visited.add(candidateId);
    const candidate = slotsById.get(candidateId);
    if (!candidate) continue;
    if (candidate.structuralRole === 'focal-frame') return true;
    pending.push(...candidate.parentSlotIds);
  }
  return false;
};

const requiredEyeCount = (
  configuration: 'single' | 'paired'
): number => {
  return configuration === 'paired' ? 2 : 1;
};

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

const permittedEyeSurfaceHosts = (
  face: AuthoringFaceContract,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  partsById: ReadonlyMap<string, PartSpec>
): ReadonlySet<string> => {
  const host = slotsById.get(face.hostSlotId);
  const actualHostPart = canonicalSurfacePart(host, partsById);
  if (!actualHostPart) return new Set();
  const directEyeFrames = face.components.flatMap((component) =>
    component.component === 'eye-frame' ? component.slotIds : []
  ).filter((slotId) => {
    const slot = slotsById.get(slotId);
    const actualFramePart = canonicalSurfacePart(slot, partsById);
    return slot?.parentSlotIds.length === 1 &&
      slot.parentSlotIds[0] === face.hostSlotId &&
      actualFramePart?.parentPartId === actualHostPart.partId;
  });
  return new Set([face.hostSlotId, ...directEyeFrames]);
};

interface CanonicalFaceHostEvaluation {
  ready: boolean;
  partId: string | null;
  partIds: ReadonlySet<string>;
  permittedEyeSurfaceHostSlotIds: ReadonlySet<string>;
  issues: readonly AuthoringPlanIssue[];
  violations: readonly AuthoringPlanIssue[];
}

const evaluateCanonicalFaceHost = (
  face: AuthoringFaceContract,
  profile: AuthoringProfile,
  slotsById: ReadonlyMap<string, AuthoringSlotStatus>,
  partsById: ReadonlyMap<string, PartSpec>
): CanonicalFaceHostEvaluation => {
  const slot = slotsById.get(face.hostSlotId);
  const surfacePart = canonicalSurfacePart(slot, partsById);
  const ready = slot?.state === 'complete' &&
    surfacePart !== null &&
    !hasFocalFrameAncestor(slot, slotsById);
  const issue = ready
    ? null
    : authoringPlanIssue(
        'authoring.plan.face_host_incomplete',
        'authoringProfile.face.hostSlotId',
        `Full-face host "${face.hostSlotId}" is not one complete canonical surface part.`,
        'one materialized non-feature host part outside every other focal-frame subtree; nasal, muzzle, oral, and eye-frame parts use separate descendant slots',
        {
          authority: profile.archetype,
          partIds: slot?.partIds ?? []
        }
      );
  return {
    ready,
    partId: surfacePart?.partId ?? null,
    partIds: new Set(surfacePart ? [surfacePart.partId] : []),
    permittedEyeSurfaceHostSlotIds: permittedEyeSurfaceHosts(
      face,
      slotsById,
      partsById
    ),
    issues: issue ? [issue] : [],
    violations: issue && (slot?.presentPartIds.length ?? 0) > 0 ? [issue] : []
  };
};

const evaluateNoFaceQuality = (
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
  const explicitMaterialIds = new Set(materials.map((material) => material.id));
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
  const eyeAuditIssues = auditEyeVisibility(document);
  const issues: AuthoringPlanIssue[] = [
    ...host.issues,
    ...geometry.issues
  ];
  const violations: AuthoringPlanIssue[] = [
    ...host.violations,
    ...geometry.violations
  ];
  const components = face.components.map((declaration) => {
    const declarationSlotIds = authoringFaceComponentSlotIds(declaration);
    const mappedSlots = declarationSlotIds.flatMap((slotId) => {
      const slot = slotsById.get(slotId);
      return slot ? [slot] : [];
    });
    const completeSlots = mappedSlots.filter(
      (slot) => slot.state === 'complete'
    );
    const completeSlotIds = completeSlots.map((slot) => slot.slotId);
    const missingSlotIds = declarationSlotIds.filter(
      (slotId) => !completeSlotIds.includes(slotId)
    );
    const partIds = uniqueSortedAuthoringValues(
      mappedSlots.flatMap((slot) => slot.partIds)
    );
    const materializedPartIds = partIds.filter((partId) =>
      partsById.has(partId)
    );
    const realizedParts = partIds.flatMap((partId) => {
      const part = partsById.get(partId);
      return part && partDescendsFrom(part, host.partIds, partsById)
        ? [part]
        : [];
    });
    const semanticParts = realizedParts.filter((part) =>
      realizesFaceForm(part, declaration.form)
    );
    const readableEyes = declaration.component === 'eye'
      ? semanticParts.filter((part): part is EyeFeaturePartSpec =>
          part.kind === 'feature' &&
          part.motif === 'eye' &&
          part.size[0] >= 3 &&
          part.size[1] >= 3
        )
      : [];
    const materialEligibleParts = declaration.component === 'eye'
      ? readableEyes
      : semanticParts;
    const realizedMaterialIds = declaration.materialIds.filter((materialId) =>
      explicitMaterialIds.has(materialId) &&
      materialEligibleParts.some((part) => part.materialId === materialId)
    );
    const missingMaterialIds = declaration.materialIds.filter(
      (materialId) => !realizedMaterialIds.includes(materialId)
    );
    const relevantEyeIssues = declaration.component === 'eye'
      ? eyeAuditIssues.filter((issue) =>
          readableEyes.some((eye) => eye.partId === issue.eyePartId)
        )
      : [];
    const distinctEyeAnchors = new Set(
      readableEyes.map((eye) => eye.anchor.join(','))
    ).size;
    const expectedEyeCount = declaration.component === 'eye'
      ? requiredEyeCount(declaration.configuration.kind)
      : 0;
    const eyeSpatial = declaration.component === 'eye'
      ? evaluateFaceEyeSpatialQuality(
          document,
          profile.archetype,
          declaration,
          readableEyes,
          expectedEyeCount,
          slotsById,
          host.permittedEyeSurfaceHostSlotIds
        )
      : { ready: true, issue: null };
    if (eyeSpatial.issue) {
      issues.push(eyeSpatial.issue);
      violations.push(eyeSpatial.issue);
    }
    const eyeReady = declaration.component !== 'eye' || (
      readableEyes.length === expectedEyeCount &&
      distinctEyeAnchors === expectedEyeCount &&
      relevantEyeIssues.length === 0 &&
      eyeSpatial.ready
    );
    const state =
      host.ready &&
      geometry.hostReady &&
      !geometry.invalidComponents.has(declaration.component) &&
      missingSlotIds.length === 0 &&
      semanticParts.length > 0 &&
      semanticParts.length === materializedPartIds.length &&
      missingMaterialIds.length === 0 &&
      eyeReady
        ? 'complete' as const
        : 'incomplete' as const;
    if (state === 'incomplete') {
      const issue = authoringPlanIssue(
        declaration.component === 'eye'
          ? 'authoring.plan.face_eye_unreadable'
          : 'authoring.plan.face_component_incomplete',
        `authoringProfile.face.components.${declaration.component}`,
        declaration.component === 'eye'
          ? 'Full-face eye configuration is not readable in the delivered model.'
          : `Full-face component "${declaration.component}" is not materially realized below its host.`,
        declaration.component === 'eye'
          ? `${expectedEyeCount} spatially distinct eye feature(s), each at least 3x3, visible and contrasting on the compiled outer surface`
          : 'all declared component slots complete with descendant parts using every explicit component material',
        { authority: profile.archetype, partIds }
      );
      issues.push(issue);
      if (incompleteComponentIsViolation(
        declaration.component,
        materializedPartIds.length,
        semanticParts.length,
        missingMaterialIds.length
      )) {
        violations.push(issue);
      }
    }
    for (const eyeIssue of relevantEyeIssues) {
      const issue = authoringPlanIssue(
        'authoring.plan.face_eye_visibility_invalid',
        `modeling.parts.${eyeIssue.eyePartId}`,
        eyeIssue.message,
        'eye fully supported, unobstructed, and contrasting on the delivered outer surface',
        { authority: profile.archetype, partIds: [eyeIssue.eyePartId] }
      );
      issues.push(issue);
      violations.push(issue);
    }
    return {
      component: declaration.component,
      form: declaration.form,
      slotIds: declarationSlotIds,
      completeSlotIds,
      missingSlotIds,
      partIds,
      realizedPartIds: semanticParts.map((part) => part.partId),
      materialIds: declaration.materialIds,
      realizedMaterialIds,
      missingMaterialIds,
      readableEyePartIds: readableEyes.map((eye) => eye.partId),
      state
    } satisfies FaceComponentQualityStatus;
  });
  return {
    mode: profile.faceMode,
    hostSlotId: face.hostSlotId,
    mouthState: face.mouthState,
    hostReady: host.ready && geometry.hostReady,
    components,
    exceptions: face.exceptions,
    issues,
    violations,
    ready: host.ready && geometry.ready && components.every((component) =>
      component.state === 'complete'
    )
  };
};
