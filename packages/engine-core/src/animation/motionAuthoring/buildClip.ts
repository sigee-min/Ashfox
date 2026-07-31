import type {
  AnimationClip,
  TransformChannel
} from '../../model';
import {
  patchMotionChannels,
  patchMotionTriggers
} from './timing';
import type { ResolvedMotionRequest } from './types';

export const buildMotionClip = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[]
): AnimationClip => {
  const { payload } = request;
  return {
    ...(current ?? {}),
    id: payload.clipId,
    name: request.name,
    durationSeconds: request.durationSeconds,
    fps: request.fps,
    loop: request.loop,
    channels: patchMotionChannels(
      current,
      authored,
      payload.removePartIds ?? [],
      request.durationSeconds,
      request.durationSpecified
    ),
    triggers: patchMotionTriggers(
      current,
      request.durationSeconds,
      request.durationSpecified
    )
  };
};
