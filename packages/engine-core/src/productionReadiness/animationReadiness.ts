import {
  analyzeProjectAnimationCapabilities
} from '../animation/capability';
import {
  CANONICAL_IDLE_CLIP_ID,
  idleClipNumericallyCloses
} from '../animation/idleContract';
import {
  loopClipTransformChannelsClose
} from '../animation/loopClosure';
import {
  formatProfileSupportsAnimation
} from '../export/compatibility';
import type {
  AnimationClip,
  ProjectDocument,
  TransformChannel
} from '../model';
import type { ProductionReadinessFinding } from './types';

export interface AnimationReadiness {
  findings: readonly ProductionReadinessFinding[];
  counts: {
    idleClips: number;
    idleChannels: number;
    animationClips: number;
    previewableAnimationClips: number;
    exportableAnimationClips: number;
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
      clipIds.length > 0
        ? 'Delete the non-canonical Idle-named clips, then create animation.motion.upsert {clipId:"idle",role:"idle",durationFrames:20,static:true} in the same atomic batch.'
        : 'Create animation.motion.upsert {clipId:"idle",role:"idle",durationFrames:20,static:true}, or author a moving idle with closed poses.'
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
        'Patch this clip with animation.motion.upsert using static:true or ordered poses.'
    }];
  }
  if (!idleClipNumericallyCloses(clip)) {
    return [{
      code: 'production.idle_loop_invalid',
      severity: 'error',
      message:
        `Every channel in Idle clip "${clip.name}" must be a numeric, ` +
        'closed loop from time 0 through the clip duration.',
      path: `animations.${clip.id}`,
      clipIds: [clip.id],
      fix:
        'Patch this clip with animation.motion.upsert so ashfox derives its 20 FPS loop closure.'
    }];
  }
  return [];
};

const loopFindings = (
  document: ProjectDocument,
  targetSupportsAnimations: boolean
): readonly ProductionReadinessFinding[] =>
  Object.values(document.animations).flatMap((clip) => {
    if (
      !targetSupportsAnimations ||
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
        'Delete this clip with animation.clip.delete, then recreate it with animation.motion.upsert.'
    }];
  });

const capabilityFindings = (
  document: ProjectDocument,
  targetSupportsAnimations: boolean,
  capability: ReturnType<typeof analyzeProjectAnimationCapabilities>
): readonly ProductionReadinessFinding[] =>
  capability.clips.flatMap((clipCapability) => {
    const clip = document.animations[clipCapability.clipId];
    if (!clip || !targetSupportsAnimations) return [];
    const findings: ProductionReadinessFinding[] = [];
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
          `${capability.targetId}: ${issueCodes.join(', ')}.`,
        path: `animations.${clip.id}`,
        clipIds: [clip.id],
        fix:
          'Delete and recreate this clip with animation.motion.upsert, or choose another target with project.target.set.'
      });
    }
    return findings;
  });

export const evaluateAnimationReadiness = (
  document: ProjectDocument,
  visibleNodeIds: ReadonlySet<string>
): AnimationReadiness => {
  const targetSupportsAnimations =
    formatProfileSupportsAnimation(document.formatProfile);
  const canonicalIdle = document.animations[CANONICAL_IDLE_CLIP_ID];
  const idleClips = canonicalIdle ? [canonicalIdle] : [];
  const visibleIdleChannels = idleClips.map((clip) =>
    Object.values(clip.channels).filter((channel) =>
      visibleNodeIds.has(channel.targetNodeId)
    )
  );
  const capability = analyzeProjectAnimationCapabilities(document);
  const findings: ProductionReadinessFinding[] = [];
  if (targetSupportsAnimations && idleClips.length === 0) {
    findings.push(missingIdleFinding(document));
  }
  if (targetSupportsAnimations) {
    idleClips.forEach((clip, index) => {
      findings.push(
        ...idleClipFindings(clip, visibleIdleChannels[index] ?? [])
      );
    });
  }
  findings.push(
    ...loopFindings(document, targetSupportsAnimations),
    ...capabilityFindings(document, targetSupportsAnimations, capability)
  );
  return {
    findings,
    counts: {
      idleClips: idleClips.length,
      idleChannels: visibleIdleChannels.reduce(
        (count, channels) => count + channels.length,
        0
      ),
      animationClips: capability.clips.length,
      previewableAnimationClips:
        capability.clips.filter((clip) => clip.previewable).length,
      exportableAnimationClips:
        capability.clips.filter((clip) => clip.exportable).length
    }
  };
};
