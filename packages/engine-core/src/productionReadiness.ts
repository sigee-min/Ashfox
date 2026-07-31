import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument
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
import {
  CANONICAL_IDLE_CLIP_ID,
  idleClipNumericallyCloses
} from './animation/idleContract';
import {
  loopClipTransformChannelsClose
} from './animation/loopClosure';

export { CANONICAL_IDLE_CLIP_ID } from './animation/idleContract';

export type ProductionReadinessCode =
  | 'production.geometry_missing'
  | 'production.texture_coverage_incomplete'
  | 'production.idle_missing'
  | 'production.idle_channels_missing'
  | 'production.idle_loop_invalid'
  | 'production.animation_loop_invalid'
  | 'production.animation_preview_unfaithful'
  | 'production.animation_export_unsupported'
  | 'production.intent_missing'
  | 'production.intent_invalid'
  | 'production.intent_grounding_mismatch'
  | 'production.intent_grounding_unstable'
  | 'production.intent_grounding_unverifiable'
  | 'production.intent_evaluation_unavailable';

export interface ProductionReadinessFinding {
  code: ProductionReadinessCode;
  severity: 'error';
  message: string;
  path: string;
  entityIds?: readonly string[];
  assetIds?: readonly string[];
  clipIds?: readonly string[];
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
  features: number;
  unverifiableGeometry: number;
  groundSupportCells: number;
  projectedFootprintCells: number;
  uniformCenterOfMassSupported: boolean | null;
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
    case 'grounding_mismatch':
      return 'production.intent_grounding_mismatch';
    case 'grounding_unstable':
      return 'production.intent_grounding_unstable';
    case 'grounding_unverifiable':
      return 'production.intent_grounding_unverifiable';
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
        'Create one canonical root part with model.parts.upsert.'
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
        'Reproject canonical parts with model.parts.upsert or assign their base material with model.parts.material.'
    });
  }

  const canonicalIdle =
    document.animations[CANONICAL_IDLE_CLIP_ID];
  const idleClips = canonicalIdle ? [canonicalIdle] : [];
  const allNonCanonicalIdleIds = Object.values(document.animations)
    .filter(
      (clip) =>
        clip.id !== CANONICAL_IDLE_CLIP_ID &&
        isProductionIdleClipName(clip.name)
    )
    .map((clip) => clip.id)
    .sort();
  const nonCanonicalIdleIds = allNonCanonicalIdleIds.slice(0, 20);
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
      message: 'No canonical animation clip has ID "idle".',
      path: 'animations',
      ...(nonCanonicalIdleIds.length > 0
        ? {
            clipIds: nonCanonicalIdleIds,
            idsTruncated:
              allNonCanonicalIdleIds.length >
              nonCanonicalIdleIds.length
          }
        : {}),
      fix:
        nonCanonicalIdleIds.length > 0
          ? 'Delete the non-canonical Idle-named clips, then create animation.motion.upsert {clipId:"idle",role:"idle",durationFrames:20,static:true} in the same atomic batch.'
          : 'Create animation.motion.upsert {clipId:"idle",role:"idle",durationFrames:20,static:true}, or author a moving idle with closed poses.'
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
          'Patch this clip with animation.motion.upsert using static:true or ordered poses.'
      });
      continue;
    }
    if (!idleClipNumericallyCloses(clip)) {
      findings.push({
        code: 'production.idle_loop_invalid',
        severity: 'error',
        message:
          `Every channel in Idle clip "${clip.name}" must be a numeric, ` +
          'closed loop from time 0 through the clip duration.',
        path: `animations.${clip.id}`,
        clipIds: [clip.id],
        fix:
          'Patch this clip with animation.motion.upsert so ashfox derives its 20 FPS loop closure.'
      });
    }
  }

  for (const clip of Object.values(document.animations)) {
    if (
      clip.id === CANONICAL_IDLE_CLIP_ID ||
      clip.loop !== 'loop' ||
      loopClipTransformChannelsClose(clip)
    ) {
      continue;
    }
    findings.push({
      code: 'production.animation_loop_invalid',
      severity: 'error',
      message:
        `Every transform channel in loop clip "${clip.name}" must ` +
        'start at time 0 and close at the clip duration.',
      path: `animations.${clip.id}`,
      clipIds: [clip.id],
      fix:
        'Delete this clip with animation.clip.delete, then recreate it with animation.motion.upsert.'
    });
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
          'Delete this clip, then recreate it with animation.motion.upsert poses or hinge spins.'
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
          'Delete and recreate this clip with animation.motion.upsert, or choose another target with project.target.set.'
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
