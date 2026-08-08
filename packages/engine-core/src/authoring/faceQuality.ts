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
import { evaluateFaceEyeSpatialQuality } from './faceQualityEye';
import type {
  AuthoringFaceComponent,
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

const requiredEyeCount = (
  configuration: 'single' | 'paired'
): number => {
  return configuration === 'paired' ? 2 : 1;
};

const realizesForm = (
  part: PartSpec,
  form: string
): boolean => {
  switch (form) {
    case 'eye':
      return part.kind === 'feature' && part.motif === 'eye';
    case 'nose':
      return part.kind === 'feature' && part.motif === 'nose';
    case 'mouth':
      return part.kind === 'feature' &&
        part.motif === 'mouth' &&
        part.glyph !== 'beak';
    case 'beak':
      return (
        part.kind === 'feature' &&
        part.motif === 'mouth' &&
        part.glyph === 'beak'
      ) || part.kind !== 'feature';
    case 'muzzle':
    case 'jaw':
    case 'orbital':
    case 'brow':
    case 'mouth-interior':
      return part.kind !== 'feature' || part.motif === 'patch';
    default:
      return false;
  }
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
  const hostSlot = slotsById.get(face.hostSlotId);
  const hostReady = hostSlot?.state === 'complete';
  const hostPartIds = new Set(hostSlot?.partIds ?? []);
  const eyeAuditIssues = auditEyeVisibility(document);
  const issues: AuthoringPlanIssue[] = [];
  const violations: AuthoringPlanIssue[] = [];
  if (!hostReady) {
    issues.push(authoringPlanIssue(
      'authoring.plan.face_host_incomplete',
      'authoringProfile.face.hostSlotId',
      `Full-face host "${face.hostSlotId}" is not materialized.`,
      'one complete focal-frame host before facial components',
      {
        authority: profile.archetype,
        partIds: hostSlot?.partIds ?? []
      }
    ));
  }
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
    const realizedParts = partIds.flatMap((partId) => {
      const part = partsById.get(partId);
      return part && partDescendsFrom(part, hostPartIds, partsById)
        ? [part]
        : [];
    });
    const semanticParts = realizedParts.filter((part) =>
      realizesForm(part, declaration.form)
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
          slotsById
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
      hostReady &&
      missingSlotIds.length === 0 &&
      semanticParts.length > 0 &&
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
      if (declaration.component === 'eye' && semanticParts.length > 0) {
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
    hostReady,
    components,
    exceptions: face.exceptions,
    issues,
    violations,
    ready: hostReady && components.every((component) =>
      component.state === 'complete'
    )
  };
};
