import type {
  AnimationClip,
  AnimationTriggerTrack,
  TransformChannel
} from '../../model';
import { compiledPartBoneId } from '../../modeling/provenance';
import { compareStableText } from '../../stableOrder';
import {
  MOTION_AUTHORING_FPS,
  motionAuthoringIssue,
  type MotionAuthoringIssue
} from '../motionContract';
import type { ResolvedMotionRequest } from './types';

const scaledFrameTime = (
  timeSeconds: number,
  scale: number,
  durationSeconds: number
): number => {
  const durationFrames = Math.round(
    durationSeconds * MOTION_AUTHORING_FPS
  );
  const frame = Math.min(
    durationFrames,
    Math.max(
      0,
      Math.round(timeSeconds * scale * MOTION_AUTHORING_FPS)
    )
  );
  return frame === durationFrames
    ? durationSeconds
    : frame / MOTION_AUTHORING_FPS;
};

const scaleChannelTime = (
  channel: TransformChannel,
  scale: number,
  durationSeconds: number,
  canonicalize: boolean
): TransformChannel =>
  scale === 1 && !canonicalize
    ? channel
    : {
        ...channel,
        keys: channel.keys.map((key) => ({
          ...key,
          timeSeconds: scaledFrameTime(
            key.timeSeconds,
            scale,
            durationSeconds
          )
        }))
      };

const scaleTriggerTime = (
  trigger: AnimationTriggerTrack,
  scale: number,
  durationSeconds: number,
  canonicalize: boolean
): AnimationTriggerTrack => {
  if (scale === 1 && !canonicalize) return trigger;
  const scaleKey = <T extends { timeSeconds: number }>(key: T): T => ({
    ...key,
    timeSeconds: scaledFrameTime(
      key.timeSeconds,
      scale,
      durationSeconds
    )
  });
  switch (trigger.type) {
    case 'sound':
      return { ...trigger, keys: trigger.keys.map(scaleKey) };
    case 'particle':
      return { ...trigger, keys: trigger.keys.map(scaleKey) };
    case 'timeline':
      return { ...trigger, keys: trigger.keys.map(scaleKey) };
  }
};

export const patchMotionChannels = (
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[],
  removePartIds: readonly string[],
  durationSeconds: number,
  canonicalizeTiming: boolean
): Readonly<Record<string, TransformChannel>> => {
  const authoredTargets = new Set(
    authored.map((channel) => channel.targetNodeId)
  );
  const removedTargets = new Set(removePartIds.map(compiledPartBoneId));
  const scale =
    current && current.durationSeconds > 0
      ? durationSeconds / current.durationSeconds
      : 1;
  const preserved = Object.values(current?.channels ?? {})
    .filter(
      (channel) =>
        !(
          channel.property === 'rotation' &&
          (
            authoredTargets.has(channel.targetNodeId) ||
            removedTargets.has(channel.targetNodeId)
          )
        )
    )
    .map((channel) =>
      scaleChannelTime(
        channel,
        scale,
        durationSeconds,
        canonicalizeTiming
      )
    );
  return Object.fromEntries(
    [...preserved, ...authored]
      .sort((left, right) => compareStableText(left.id, right.id))
      .map((channel) => [channel.id, channel])
  );
};

export const patchMotionTriggers = (
  current: AnimationClip | undefined,
  durationSeconds: number,
  canonicalizeTiming: boolean
): AnimationClip['triggers'] => {
  if (!current) return {};
  const scale =
    current.durationSeconds > 0
      ? durationSeconds / current.durationSeconds
      : 1;
  return Object.fromEntries(
    Object.values(current.triggers)
      .map((trigger) =>
        scaleTriggerTime(
          trigger,
          scale,
          durationSeconds,
          canonicalizeTiming
        )
      )
      .sort((left, right) => compareStableText(left.id, right.id))
      .map((trigger) => [trigger.id, trigger])
  );
};

const scaledFramePosition = (
  timeSeconds: number,
  scale: number,
  durationSeconds: number
): number =>
  Math.min(
    durationSeconds * MOTION_AUTHORING_FPS,
    Math.max(0, timeSeconds * scale * MOTION_AUTHORING_FPS)
  );

const isCanonicalFramePosition = (frame: number): boolean =>
  Math.abs(frame - Math.round(frame)) <= 0.000001;

export const preservedTimingIssue = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[]
): MotionAuthoringIssue | null => {
  if (!current || !request.durationSpecified) return null;
  const authoredTargets = new Set(
    authored.map((channel) => channel.targetNodeId)
  );
  const removedTargets = new Set(
    (request.payload.removePartIds ?? []).map(compiledPartBoneId)
  );
  const scale = request.durationSeconds / current.durationSeconds;
  for (const channel of Object.values(current.channels)) {
    if (
      channel.property === 'rotation' &&
      (
        authoredTargets.has(channel.targetNodeId) ||
        removedTargets.has(channel.targetNodeId)
      )
    ) {
      continue;
    }
    const occupiedFrames = new Set<number>();
    for (const [keyIndex, key] of channel.keys.entries()) {
      const framePosition = scaledFramePosition(
        key.timeSeconds,
        scale,
        request.durationSeconds
      );
      if (!isCanonicalFramePosition(framePosition)) {
        return motionAuthoringIssue(
          'invalid_state',
          `Retiming clip "${current.id}" would place a preserved key ` +
            `from channel "${channel.id}" between canonical 20 FPS frames.`,
          `animations.${current.id}.channels.${channel.id}.keys[${keyIndex}].timeSeconds`,
          'delete and recreate this clip, or reauthor every preserved off-grid track before changing durationFrames',
          'document'
        );
      }
      const frame = Math.round(framePosition);
      if (occupiedFrames.has(frame)) {
        return motionAuthoringIssue(
          'invalid_state',
          `Retiming clip "${current.id}" would collapse multiple keys ` +
            `from channel "${channel.id}" onto frame ${frame}.`,
          `animations.${current.id}.channels.${channel.id}.keys`,
          'reauthor or remove this track before changing durationFrames',
          'document'
        );
      }
      occupiedFrames.add(frame);
    }
  }
  for (const trigger of Object.values(current.triggers)) {
    for (const [keyIndex, key] of trigger.keys.entries()) {
      const framePosition = scaledFramePosition(
        key.timeSeconds,
        scale,
        request.durationSeconds
      );
      if (!isCanonicalFramePosition(framePosition)) {
        return motionAuthoringIssue(
          'invalid_state',
          `Retiming clip "${current.id}" would place a preserved ` +
            `trigger key from "${trigger.id}" between canonical 20 FPS frames.`,
          `animations.${current.id}.triggers.${trigger.id}.keys[${keyIndex}].timeSeconds`,
          'delete and recreate this clip before changing durationFrames',
          'document'
        );
      }
    }
  }
  return null;
};
