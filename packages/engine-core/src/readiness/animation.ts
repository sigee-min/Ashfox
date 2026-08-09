import {
  blockingCanonicalAnimationPreviewIssues
} from '../animation/capability';
import {
  CANONICAL_IDLE_CLIP_ID,
  idleClipNumericallyCloses
} from '../animation/idle/contract';
import {
  loopClipTransformChannelsClose
} from '../animation/loopClosure';
import type {
  AnimationClip,
  ProjectDocument,
  TransformChannel
} from '../model';
import type { ProductionReadinessFinding } from './contract';

export interface AnimationReadiness {
  findings: readonly ProductionReadinessFinding[];
  counts: {
    idleClips: number;
    idleChannels: number;
    animationClips: number;
    previewableAnimationClips: number;
  };
}

export const isProductionIdleClipName = (name: string): boolean => {
  const normalized = name.trim().toLowerCase();
  return (
    normalized === 'idle' ||
    /^animation\.[a-z0-9_.-]+\.idle$/.test(normalized)
  );
};

const nonCanonicalIdleIds = (
  document: ProjectDocument
): readonly string[] =>
  Object.values(document.animations)
    .filter(
      (clip) =>
        clip.id !== CANONICAL_IDLE_CLIP_ID &&
        isProductionIdleClipName(clip.name)
    )
    .map((clip) => clip.id)
    .sort();

const missingIdleFinding = (
  document: ProjectDocument
): ProductionReadinessFinding => {
  const allIds = nonCanonicalIdleIds(document);
  const clipIds = allIds.slice(0, 20);
  return {
    code: 'production.idle_missing',
    severity: 'error',
    message: 'No canonical animation clip has ID "idle".',
    path: 'animations',
    ...(clipIds.length > 0
      ? {
          clipIds,
          idsTruncated: allIds.length > clipIds.length
        }
      : {}),
    fix:
      'Correct the reviewed Intent Program source and compile it again.'
  };
};

const idleClipFindings = (
  clip: AnimationClip,
  visibleChannels: readonly TransformChannel[]
): readonly ProductionReadinessFinding[] => {
  if (visibleChannels.length === 0) {
    return [{
      code: 'production.idle_channels_missing',
      severity: 'error',
      message:
        `Idle clip "${clip.name}" has no transform channel targeting ` +
        'effectively visible scene geometry and cannot demonstrate a reviewed pose.',
      path: `animations.${clip.id}.channels`,
      clipIds: [clip.id],
      fix:
        'Correct the reviewed Intent Program source and compile it again.'
    }];
  }
  if (!idleClipNumericallyCloses(clip)) {
    return [{
      code: 'production.idle_loop_invalid',
      severity: 'error',
      message:
        `Every channel in Idle clip "${clip.name}" must be numeric and ` +
        'closed from the identity rest rotation at time 0 through the clip duration.',
      path: `animations.${clip.id}`,
      clipIds: [clip.id],
      fix:
        'Correct the reviewed Intent Program source and compile it again.'
    }];
  }
  return [];
};

const loopFindings = (
  document: ProjectDocument
): readonly ProductionReadinessFinding[] =>
  Object.values(document.animations).flatMap((clip) => {
    if (
      clip.id === CANONICAL_IDLE_CLIP_ID ||
      clip.loop !== 'loop' ||
      loopClipTransformChannelsClose(clip)
    ) {
      return [];
    }
    return [{
      code: 'production.animation_loop_invalid' as const,
      severity: 'error' as const,
      message:
        `Every transform channel in loop clip "${clip.name}" must ` +
        'start at time 0 and close at the clip duration.',
      path: `animations.${clip.id}`,
      clipIds: [clip.id],
      fix:
        'Correct the reviewed Intent Program source and compile it again.'
    }];
  });

const canonicalPreviewFindings = (
  document: ProjectDocument
): readonly ProductionReadinessFinding[] =>
  Object.values(document.animations).flatMap((clip) => {
    const previewIssues = blockingCanonicalAnimationPreviewIssues(clip);
    if (previewIssues.length === 0) return [];
    const issueCodes = [...new Set(previewIssues.map((issue) => issue.code))];
    return [{
      code: 'production.animation_preview_unfaithful',
      severity: 'error',
      message:
        `Animation "${clip.name}" uses semantics the live numeric ` +
        `renderer cannot faithfully preview: ${issueCodes.join(', ')}.`,
      path: `animations.${clip.id}`,
      clipIds: [clip.id],
      fix:
        'Correct the reviewed Intent Program source and compile it again.'
    }];
  });

export const evaluateAnimationReadiness = (
  document: ProjectDocument,
  visibleNodeIds: ReadonlySet<string>
): AnimationReadiness => {
  const canonicalIdle = document.animations[CANONICAL_IDLE_CLIP_ID];
  const idleClips = canonicalIdle ? [canonicalIdle] : [];
  const visibleIdleChannels = idleClips.map((clip) =>
    Object.values(clip.channels).filter((channel) =>
      visibleNodeIds.has(channel.targetNodeId)
    )
  );
  const clips = Object.values(document.animations);
  const previewableClips = clips.filter((clip) =>
    blockingCanonicalAnimationPreviewIssues(clip).length === 0
  );
  const findings: ProductionReadinessFinding[] = [];
  if (idleClips.length === 0) {
    findings.push(missingIdleFinding(document));
  }
  idleClips.forEach((clip, index) => {
    findings.push(
      ...idleClipFindings(clip, visibleIdleChannels[index] ?? [])
    );
  });
  findings.push(
    ...loopFindings(document),
    ...canonicalPreviewFindings(document)
  );
  return {
    findings,
    counts: {
      idleClips: idleClips.length,
      idleChannels: visibleIdleChannels.reduce(
        (count, channels) => count + channels.length,
        0
      ),
      animationClips: clips.length,
      previewableAnimationClips: previewableClips.length
    }
  };
};
