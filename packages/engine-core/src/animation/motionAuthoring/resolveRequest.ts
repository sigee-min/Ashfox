import type {
  AnimationClip,
  ProjectDocument
} from '../../model';
import { resourceToken } from '../../resourceToken';
import { CANONICAL_IDLE_CLIP_ID } from '../idleContract';
import {
  MOTION_AUTHORING_FPS,
  MOTION_AUTHORING_LIMITS,
  motionAuthoringIssue,
  type AnimationMotionUpsertInput,
  type ResolvedAnimationMotionInput
} from '../motionContract';
import type { ResolveMotionRequestResult } from './types';

const animationName = (
  document: ProjectDocument,
  clipId: string,
  role: ResolvedAnimationMotionInput['role']
): string => {
  const modelPath =
    'modelPath' in document.formatProfile
      ? document.formatProfile.modelPath
      : document.name;
  const model = resourceToken(
    modelPath.split('/').join('.'),
    'model'
  );
  const suffix =
    role === 'idle'
      ? 'idle'
      : resourceToken(clipId, 'clip');
  return `animation.${model}.${suffix}`;
};

const existingMotionRole = (
  clip: AnimationClip
): ResolvedAnimationMotionInput['role'] =>
  clip.loop !== 'loop'
    ? 'once'
    : clip.id === CANONICAL_IDLE_CLIP_ID
      ? 'idle'
      : 'loop';

export const resolveMotionRequest = (
  document: ProjectDocument,
  input: AnimationMotionUpsertInput,
  current: AnimationClip | undefined
): ResolveMotionRequestResult => {
  if (!current && input.role === undefined) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        'A new animation clip requires an explicit role.',
        'payload.role',
        'idle | loop | once'
      )
    };
  }
  if (!current && input.durationFrames === undefined) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        'A new animation clip requires an explicit duration.',
        'payload.durationFrames',
        `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`
      )
    };
  }
  if (
    current &&
    input.durationFrames === undefined &&
    current.fps !== MOTION_AUTHORING_FPS
  ) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_state',
        `Clip "${current.id}" uses ${current.fps} FPS instead of the canonical 20 FPS grid.`,
        `animations.${current.id}.fps`,
        'an explicit durationFrames to retime this clip at 20 FPS',
        'document'
      )
    };
  }

  const role = input.role ?? existingMotionRole(current!);
  const inferredFrames = current
    ? current.durationSeconds * MOTION_AUTHORING_FPS
    : Number.NaN;
  const durationFrames = input.durationFrames ?? inferredFrames;
  if (
    !Number.isSafeInteger(durationFrames) ||
    durationFrames < 1 ||
    durationFrames > MOTION_AUTHORING_LIMITS.maxDurationFrames
  ) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        current && input.durationFrames === undefined
          ? 'invalid_state'
          : 'invalid_payload',
        current && input.durationFrames === undefined
          ? `Clip "${current.id}" is not aligned to the canonical 20 FPS frame grid.`
          : 'Animation duration must use the canonical frame grid.',
        current && input.durationFrames === undefined
          ? `animations.${current.id}.durationSeconds`
          : 'payload.durationFrames',
        current && input.durationFrames === undefined
          ? 'an explicit durationFrames to retime this clip'
          : `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`,
        current && input.durationFrames === undefined
          ? 'document'
          : undefined
      )
    };
  }

  const roleSpecified = input.role !== undefined;
  const durationSpecified = input.durationFrames !== undefined;
  return {
    ok: true,
    value: {
      payload: {
        ...input,
        role,
        durationFrames
      },
      name:
        current && !roleSpecified
          ? current.name
          : animationName(document, input.clipId, role),
      durationSeconds:
        current && !durationSpecified
          ? current.durationSeconds
          : durationFrames / MOTION_AUTHORING_FPS,
      fps:
        current && !durationSpecified
          ? current.fps
          : MOTION_AUTHORING_FPS,
      loop:
        current && !roleSpecified
          ? current.loop
          : role === 'once'
            ? 'once'
            : 'loop',
      roleSpecified,
      durationSpecified
    }
  };
};
