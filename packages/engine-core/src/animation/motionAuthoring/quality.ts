import type {
  AnimationClip,
  TransformChannel
} from '../../model';
import { CANONICAL_IDLE_CLIP_ID, idleClipNumericallyCloses } from '../idleContract';
import { transformChannelClosesLoop } from '../loopClosure';
import {
  motionAuthoringIssue,
  type MotionAuthoringIssue,
  type ResolvedAnimationMotionInput
} from '../motionContract';
import type { ResolvedMotionRequest } from './types';

const valueSignature = (
  value: TransformChannel['keys'][number]['value']
): string => JSON.stringify(value);

const channelMoves = (channel: TransformChannel): boolean => {
  if (channel.keys.length < 2) return false;
  const opening = valueSignature(channel.keys[0].value);
  return channel.keys.some(
    (key) => valueSignature(key.value) !== opening
  );
};

export const loopClosureIssue = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  clip: AnimationClip
): MotionAuthoringIssue | null => {
  if (clip.loop !== 'loop') return null;
  const unclosed = Object.values(clip.channels).find(
    (channel) => !transformChannelClosesLoop(
      channel,
      clip.durationSeconds
    )
  );
  return unclosed
    ? motionAuthoringIssue(
        'invalid_payload',
        `Resulting loop clip "${clip.id}" preserves an open ` +
          `${unclosed.property} track for ` +
          `"${unclosed.targetNodeId}".`,
        current &&
          current.loop !== 'loop' &&
          request.roleSpecified
          ? 'payload.role'
          : 'payload.poses',
        'a closed transform track at the requested duration, or role "once"'
      )
    : null;
};

export const canonicalIdleIssue = (
  clip: AnimationClip
): MotionAuthoringIssue | null => {
  if (clip.id !== CANONICAL_IDLE_CLIP_ID) return null;
  return idleClipNumericallyCloses(clip)
    ? null
    : motionAuthoringIssue(
        'invalid_payload',
        'The resulting canonical idle must be a numerically closed loop on every transform channel.',
        'payload.poses',
        'exactly matching numeric opening and closing transforms, or static: true'
      );
};

export const movementIssue = (
  payload: ResolvedAnimationMotionInput,
  channels: AnimationClip['channels']
): MotionAuthoringIssue | null => {
  const moves = Object.values(channels).some(channelMoves);
  if (payload.static && moves) {
    return motionAuthoringIssue(
      'invalid_state',
      'The resulting idle still contains moving tracks.',
      'payload.removePartIds',
      'remove every moving part track, or omit static',
      'document'
    );
  }
  if (!payload.static && !moves) {
    return motionAuthoringIssue(
      'invalid_payload',
      `${payload.role} motion must contain at least two distinct poses.`,
      'payload.poses',
      payload.role === 'idle'
        ? 'actual idle movement, or static: true'
        : 'actual pose movement or a spin'
    );
  }
  return null;
};
