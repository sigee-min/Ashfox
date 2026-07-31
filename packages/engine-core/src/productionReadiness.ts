import {
  CUBE_FACE_DIRECTIONS,
  type AnimationClip,
  type ProjectDocument,
  type TransformChannel
} from './model';
import {
  effectivelyVisibleSceneNodeIds
} from './sceneVisibility';
import {
  validateProjectDocument,
  type InvariantFinding,
  type ValidationReport
} from './validation';
import {
  evaluateProjectIntentRequirements,
  type ProjectIntentRequirementCode
} from './project/projectIntentEvaluation';
import {
  analyzeProjectAnimationCapabilities
} from './animation/capability';

const EPSILON = 0.000001;

export type ProductionReadinessCode =
  | 'production.geometry_missing'
  | 'production.texture_coverage_incomplete'
  | 'production.idle_missing'
  | 'production.idle_channels_missing'
  | 'production.idle_loop_invalid'
  | 'production.animation_preview_unfaithful'
  | 'production.animation_export_unsupported'
  | 'production.intent_missing'
  | 'production.intent_invalid'
  | 'production.intent_required_part_missing'
  | 'production.intent_required_material_missing'
  | 'production.intent_required_clip_missing'
  | 'production.intent_required_clip_channels_missing'
  | 'production.intent_grounding_mismatch'
  | 'production.intent_grounding_unstable'
  | 'production.intent_grounding_unverifiable'
  | 'production.intent_symmetry_part_missing'
  | 'production.intent_symmetry_mismatch'
  | 'production.intent_evaluation_unavailable';

export interface ProductionReadinessFinding {
  code: ProductionReadinessCode;
  severity: 'error';
  message: string;
  path: string;
  entityIds?: readonly string[];
  assetIds?: readonly string[];
  clipIds?: readonly string[];
  partIds?: readonly string[];
  materialIds?: readonly string[];
  idsTruncated?: boolean;
  fix: string;
}

export interface ProductionReadinessCounts {
  structuralErrors: number;
  structuralWarnings: number;
  visibleGeometry: number;
  enabledVisibleFaces: number;
  texturedVisibleFaces: number;
  untexturedVisibleFaces: number;
  idleClips: number;
  idleChannels: number;
  animationClips: number;
  previewableAnimationClips: number;
  exportableAnimationClips: number;
  intentPresent: boolean;
  requiredFeatures: number;
  requiredParts: number;
  missingParts: number;
  requiredMaterials: number;
  missingMaterials: number;
  requiredClips: number;
  missingClips: number;
  emptyRequiredClips: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
  symmetryPairs: number;
  symmetryMismatches: number;
  symmetryUnevaluated: number;
}

export interface ProductionReadinessReport {
  structurallyValid: boolean;
  mechanicallyReady: boolean;
  semanticReviewRequired: true;
  counts: ProductionReadinessCounts;
  findings: readonly ProductionReadinessFinding[];
  firstBlockingFinding:
    | InvariantFinding
    | ProductionReadinessFinding
    | null;
}

export const isProductionIdleClipName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'idle' ||
    /^animation\.[a-z0-9_.-]+\.idle$/.test(normalized)
  );
};

const isFiniteNumericVec3 = (
  value: unknown
): value is readonly [number, number, number] =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every(
    (component) =>
      typeof component === 'number' && Number.isFinite(component)
  );

const valuesClose = (
  first: readonly number[],
  last: readonly number[]
): boolean =>
  first.every(
    (component, index) =>
      Math.abs(component - (last[index] ?? Number.NaN)) <= EPSILON
  );

const clipHasNumericallyClosedChannels = (
  clip: AnimationClip,
  channels: readonly TransformChannel[]
): boolean => {
  if (clip.loop !== 'loop') return false;
  if (channels.length === 0) return false;
  return channels.every((channel) => {
    if (channel.keys.length < 2) return false;
    const first = channel.keys[0];
    const last = channel.keys.at(-1);
    if (!last) return false;
    return (
      Math.abs(first.timeSeconds) <= EPSILON &&
      Math.abs(last.timeSeconds - clip.durationSeconds) <= EPSILON &&
      isFiniteNumericVec3(first.value) &&
      isFiniteNumericVec3(last.value) &&
      valuesClose(first.value, last.value)
    );
  });
};

const structuralBlockers = (
  report: ValidationReport
): readonly InvariantFinding[] =>
  report.findings.filter(
    (finding) =>
      finding.severity === 'error' || finding.severity === 'warning'
  );

const productionIntentCode = (
  code: ProjectIntentRequirementCode
): ProductionReadinessCode => {
  switch (code) {
    case 'intent_missing':
      return 'production.intent_missing';
    case 'intent_invalid':
      return 'production.intent_invalid';
    case 'required_part_missing':
      return 'production.intent_required_part_missing';
    case 'required_material_missing':
      return 'production.intent_required_material_missing';
    case 'required_clip_missing':
      return 'production.intent_required_clip_missing';
    case 'required_clip_channels_missing':
      return 'production.intent_required_clip_channels_missing';
    case 'grounding_mismatch':
      return 'production.intent_grounding_mismatch';
    case 'grounding_unstable':
      return 'production.intent_grounding_unstable';
    case 'grounding_unverifiable':
      return 'production.intent_grounding_unverifiable';
    case 'symmetry_part_missing':
      return 'production.intent_symmetry_part_missing';
    case 'symmetry_mismatch':
      return 'production.intent_symmetry_mismatch';
    case 'evaluation_unavailable':
      return 'production.intent_evaluation_unavailable';
  }
};

export const evaluateProductionReadiness = (
  document: ProjectDocument,
  validationReport: ValidationReport =
    validateProjectDocument(document)
): ProductionReadinessReport => {
  const findings: ProductionReadinessFinding[] = [];
  const visibleGeometryIds: string[] = [];
  const visibleFaceTextureIds: (string | null)[] = [];
  const visibleNodeIds =
    effectivelyVisibleSceneNodeIds(document);

  for (const node of Object.values(document.scene.nodes)) {
    if (!visibleNodeIds.has(node.id)) continue;
    if (node.kind === 'cube') {
      const enabledFaces = CUBE_FACE_DIRECTIONS
        .map((direction) => node.faces[direction])
        .filter((face) => face.enabled);
      if (enabledFaces.length > 0) visibleGeometryIds.push(node.id);
      visibleFaceTextureIds.push(
        ...enabledFaces.map((face) => face.textureId)
      );
      continue;
    }
    if (node.kind === 'mesh') {
      const faces = Object.values(node.faces);
      if (faces.length > 0) visibleGeometryIds.push(node.id);
      visibleFaceTextureIds.push(...faces.map((face) => face.textureId));
    }
  }

  const texturedVisibleFaces = visibleFaceTextureIds.filter(
    (textureId) =>
      textureId !== null && document.textures[textureId] !== undefined
  ).length;
  const untexturedVisibleFaces =
    visibleFaceTextureIds.length - texturedVisibleFaces;

  if (visibleGeometryIds.length === 0) {
    findings.push({
      code: 'production.geometry_missing',
      severity: 'error',
      message: 'The project has no effectively visible renderable geometry.',
      path: 'scene.nodes',
      fix:
        'Create visible cube or mesh geometry with at least one enabled face.'
    });
  } else if (
    visibleFaceTextureIds.length === 0 ||
    untexturedVisibleFaces > 0
  ) {
    findings.push({
      code: 'production.texture_coverage_incomplete',
      severity: 'error',
      message:
        `${untexturedVisibleFaces} of ${visibleFaceTextureIds.length} ` +
        'visible faces do not resolve to a texture asset.',
      path: 'scene.nodes',
      entityIds: visibleGeometryIds,
      fix:
        'Assign an existing texture asset to every enabled face on visible geometry.'
    });
  }

  const idleClips = Object.values(document.animations).filter((clip) =>
    isProductionIdleClipName(clip.name)
  );
  const idleChannelsByClip = new Map(
    idleClips.map((clip) => [
      clip.id,
      Object.values(clip.channels).filter((channel) =>
        visibleNodeIds.has(channel.targetNodeId)
      )
    ])
  );
  const idleChannels = idleClips.reduce(
    (count, clip) =>
      count + (idleChannelsByClip.get(clip.id)?.length ?? 0),
    0
  );
  if (idleClips.length === 0) {
    findings.push({
      code: 'production.idle_missing',
      severity: 'error',
      message: 'No clip has the explicit Idle animation name.',
      path: 'animations',
      fix:
        'Create a clip named Idle or animation.<asset>.idle with a closed transform loop.'
    });
  }
  for (const clip of idleClips) {
    const visibleChannels =
      idleChannelsByClip.get(clip.id) ?? [];
    if (visibleChannels.length === 0) {
      findings.push({
        code: 'production.idle_channels_missing',
        severity: 'error',
        message:
          `Idle clip "${clip.name}" has no transform channel targeting ` +
          'effectively visible scene geometry and cannot demonstrate a reviewed pose.',
        path: `animations.${clip.id}.channels`,
        clipIds: [clip.id],
        fix:
          'Add at least one transform channel with numeric keys at time 0 and the clip duration.'
      });
      continue;
    }
    if (
      !clipHasNumericallyClosedChannels(
        clip,
        visibleChannels
      )
    ) {
      findings.push({
        code: 'production.idle_loop_invalid',
        severity: 'error',
        message:
          `Every channel in Idle clip "${clip.name}" must be a numeric, ` +
          'closed loop from time 0 through the clip duration.',
        path: `animations.${clip.id}`,
        clipIds: [clip.id],
        fix:
          'Use loop mode, at least two numeric keys per channel, and matching start/end values.'
      });
    }
  }

  const animationCapability =
    analyzeProjectAnimationCapabilities(document);
  for (const clipCapability of animationCapability.clips) {
    const clip = document.animations[clipCapability.clipId];
    if (!clip) continue;
    if (!clipCapability.previewable) {
      const issueCodes = [
        ...new Set(
          clipCapability.previewIssues.map((issue) => issue.code)
        )
      ];
      findings.push({
        code: 'production.animation_preview_unfaithful',
        severity: 'error',
        message:
          `Animation "${clip.name}" uses semantics the live numeric ` +
          `renderer cannot faithfully preview: ${issueCodes.join(', ')}.`,
        path: `animations.${clip.id}`,
        clipIds: [clip.id],
        fix:
          'Bake the clip to numeric bone-space transform keys without easing, split values, non-neutral timing or blend controls, or event tracks.'
      });
    }
    if (!clipCapability.exportable) {
      const issueCodes = [
        ...new Set(
          clipCapability.exportIssues.map((issue) => issue.code)
        )
      ];
      findings.push({
        code: 'production.animation_export_unsupported',
        severity: 'error',
        message:
          `Animation "${clip.name}" cannot be represented by ` +
          `${animationCapability.targetId}: ${issueCodes.join(', ')}.`,
        path: `animations.${clip.id}`,
        clipIds: [clip.id],
        fix:
          'Remove or bake the unsupported animation semantics, or choose a target that preserves them.'
      });
    }
  }

  const intentReport = evaluateProjectIntentRequirements(document);
  findings.push(
    ...intentReport.issues.map((issue) => ({
      code: productionIntentCode(issue.code),
      severity: 'error' as const,
      message: issue.message,
      path: issue.path,
      partIds: issue.partIds,
      materialIds: issue.materialIds,
      clipIds: issue.clipIds,
      entityIds: issue.entityIds,
      idsTruncated: issue.idsTruncated,
      fix: issue.fix
    }))
  );

  const blockers = structuralBlockers(validationReport);
  const structuralErrors = validationReport.findings.filter(
    (finding) => finding.severity === 'error'
  ).length;
  const structuralWarnings = validationReport.findings.filter(
    (finding) => finding.severity === 'warning'
  ).length;
  return {
    structurallyValid: validationReport.valid,
    mechanicallyReady:
      validationReport.valid &&
      blockers.length === 0 &&
      findings.length === 0,
    semanticReviewRequired: true,
    counts: {
      structuralErrors,
      structuralWarnings,
      visibleGeometry: visibleGeometryIds.length,
      enabledVisibleFaces: visibleFaceTextureIds.length,
      texturedVisibleFaces,
      untexturedVisibleFaces,
      idleClips: idleClips.length,
      idleChannels,
      animationClips: animationCapability.clips.length,
      previewableAnimationClips:
        animationCapability.clips.filter((clip) => clip.previewable).length,
      exportableAnimationClips:
        animationCapability.clips.filter((clip) => clip.exportable).length,
      intentPresent: intentReport.intentPresent,
      ...intentReport.counts
    },
    findings,
    firstBlockingFinding:
      blockers.find((finding) => finding.severity === 'error') ??
      findings[0] ??
      blockers[0] ??
      null
  };
};
