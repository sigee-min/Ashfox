import type {
  AnimationClip,
  ProjectDocument
} from '../../model';
import { compiledPartBoneId } from '../../modeling/provenance';
import {
  MOTION_AUTHORING_LIMITS,
  motionAuthoringIssue,
  type AnimationMotionUpsertInput,
  type MotionAuthoringIssue,
  type ResolvedAnimationMotionInput
} from '../motionContract';
import type { ResolvedMotionRequest } from './types';

export const identityIssue = (
  payload: ResolvedAnimationMotionInput
): MotionAuthoringIssue | null => {
  if (payload.role === 'idle' && payload.clipId !== 'idle') {
    return motionAuthoringIssue(
      'invalid_payload',
      'The canonical idle role requires clip ID "idle".',
      'payload.clipId',
      'idle'
    );
  }
  if (
    payload.role !== 'idle' &&
    (payload.clipId === 'idle' || payload.clipId.endsWith('.idle'))
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      `Clip ID "${payload.clipId}" is reserved for the idle role.`,
      'payload.clipId',
      'a non-idle ID that does not end in ".idle"'
    );
  }
  return null;
};

export const payloadPolicyIssue = (
  payload: ResolvedAnimationMotionInput
): MotionAuthoringIssue | null => {
  if (
    !Number.isSafeInteger(payload.durationFrames) ||
    payload.durationFrames < 1 ||
    payload.durationFrames > MOTION_AUTHORING_LIMITS.maxDurationFrames
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      'Animation duration must use the canonical frame grid.',
      'payload.durationFrames',
      `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`
    );
  }
  if (payload.static && payload.role !== 'idle') {
    return motionAuthoringIssue(
      'invalid_payload',
      'Only the canonical idle clip may be explicitly static.',
      'payload.static',
      'omit static, or use role "idle"'
    );
  }
  if (
    payload.static &&
    (
      (payload.poses?.length ?? 0) > 0 ||
      (payload.spins?.length ?? 0) > 0
    )
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      'A static idle cannot also author poses or spins.',
      'payload.static',
      'static: true without poses or spins'
    );
  }
  if (payload.role === 'idle' && (payload.spins?.length ?? 0) > 0) {
    return motionAuthoringIssue(
      'invalid_payload',
      'The canonical idle must close numerically and cannot contain continuous spins.',
      'payload.spins',
      'pose motion for idle, or a separate loop clip for spins'
    );
  }
  const duplicateRemoval = (payload.removePartIds ?? [])
    .find((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateRemoval) {
    return motionAuthoringIssue(
      'invalid_payload',
      `Part "${duplicateRemoval}" is removed more than once.`,
      'payload.removePartIds',
      'unique part IDs'
    );
  }
  return null;
};

export const conflictingNameIssue = (
  document: ProjectDocument,
  clipId: string,
  name: string
): MotionAuthoringIssue | null => {
  const conflict = Object.values(document.animations).find(
    (clip) => clip.id !== clipId && clip.name === name
  );
  return conflict
    ? motionAuthoringIssue(
        'invalid_state',
        `Animation name "${name}" is already owned by clip ` +
          `"${conflict.id}".`,
        'payload.clipId',
        `reuse clip ID "${conflict.id}"`
      )
    : null;
};

export const removalIssue = (
  current: AnimationClip | undefined,
  payload: AnimationMotionUpsertInput
): MotionAuthoringIssue | null => {
  const channels = Object.values(current?.channels ?? {});
  for (const [index, partId] of (payload.removePartIds ?? []).entries()) {
    const targetNodeId = compiledPartBoneId(partId);
    const exists = channels.some(
      (channel) =>
        channel.property === 'rotation' &&
        channel.targetNodeId === targetNodeId
    );
    if (!exists) {
      return motionAuthoringIssue(
        'invalid_payload',
        `Clip "${payload.clipId}" has no rotation track for part "${partId}".`,
        `payload.removePartIds[${index}]`,
        'a part ID with an existing rotation track in this clip'
      );
    }
  }
  return null;
};

export const patchChangesMotion = (
  current: AnimationClip | undefined,
  request: ResolvedMotionRequest
): boolean => {
  if (!current) return true;
  const { payload } = request;
  const hasAuthoredTracks =
    payload.static === true ||
    (payload.poses?.length ?? 0) > 0 ||
    (payload.spins?.length ?? 0) > 0;
  const hasRemoval = (payload.removePartIds?.length ?? 0) > 0;
  const durationChanges =
    request.durationSpecified &&
    (
      current.durationSeconds !== request.durationSeconds ||
      current.fps !== request.fps
    );
  const roleChanges =
    request.roleSpecified &&
    (
      current.loop !== request.loop ||
      current.name !== request.name
    );
  return hasAuthoredTracks || hasRemoval || durationChanges || roleChanges;
};
