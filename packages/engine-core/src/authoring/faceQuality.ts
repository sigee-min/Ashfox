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
import type {
  AuthoringFaceComponent,
  AuthoringFaceException,
  AuthoringFaceMode,
  AuthoringMouthState,
  AuthoringProfile
} from './authoringTypes';

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
  configuration: 'single' | 'paired' | 'compound' | null
): number => {
  switch (configuration) {
    case 'paired': return 2;
    case 'compound': return 3;
    default: return 1;
  }
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

export const evaluateFaceQuality = (
  document: ProjectDocument,
  profile: AuthoringProfile,
  slots: readonly AuthoringSlotStatus[],
  parts: readonly PartSpec[],
  materials: readonly PartMaterialDefinition[]
): FaceQualityEvaluation => {
  if (profile.faceMode === 'none' || profile.face === null) {
    return {
      mode: profile.faceMode,
      hostSlotId: null,
      mouthState: null,
      hostReady: true,
      components: [],
      exceptions: [],
      issues: [],
      ready: true
    };
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
    const mappedSlots = declaration.slotIds.flatMap((slotId) => {
      const slot = slotsById.get(slotId);
      return slot ? [slot] : [];
    });
    const completeSlots = mappedSlots.filter(
      (slot) => slot.state === 'complete'
    );
    const completeSlotIds = completeSlots.map((slot) => slot.slotId);
    const missingSlotIds = declaration.slotIds.filter(
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
          part.glyph !== undefined &&
          part.glyph !== 'dot' &&
          part.size[0] >= 2 &&
          part.size[1] >= 2
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
    const expectedEyeCount = requiredEyeCount(declaration.configuration);
    const eyeReady = declaration.component !== 'eye' || (
      readableEyes.length >= expectedEyeCount &&
      distinctEyeAnchors >= expectedEyeCount &&
      relevantEyeIssues.length === 0
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
      issues.push(authoringPlanIssue(
        declaration.component === 'eye'
          ? 'authoring.plan.face_eye_unreadable'
          : 'authoring.plan.face_component_incomplete',
        `authoringProfile.face.components.${declaration.component}`,
        declaration.component === 'eye'
          ? 'Full-face eye configuration is not readable in the delivered model.'
          : `Full-face component "${declaration.component}" is not materially realized below its host.`,
        declaration.component === 'eye'
          ? `${expectedEyeCount} spatially distinct non-dot eye feature(s), each at least 2x2, visible and contrasting on the compiled outer surface`
          : 'all declared component slots complete with descendant parts using every explicit component material',
        { authority: profile.archetype, partIds }
      ));
    }
    for (const eyeIssue of relevantEyeIssues) {
      issues.push(authoringPlanIssue(
        'authoring.plan.face_eye_visibility_invalid',
        `modeling.parts.${eyeIssue.eyePartId}`,
        eyeIssue.message,
        'eye fully supported, unobstructed, and contrasting on the delivered outer surface',
        { authority: profile.archetype, partIds: [eyeIssue.eyePartId] }
      ));
    }
    return {
      component: declaration.component,
      form: declaration.form,
      slotIds: declaration.slotIds,
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
    ready: hostReady && components.every((component) =>
      component.state === 'complete'
    )
  };
};
