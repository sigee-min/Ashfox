import type { AnimationClip, BlockbenchGlobals, UnknownRecord } from '../../../types/blockbench';
import type { TrackedAnimationChannel, TrackedAnimationTrigger } from '../../../session';
import { isRecord } from '../../../domain/guards';
import { normalizeKeyframeTime } from '../../../domain/animation/keyframes';
import { normalizeAnimationChannel, normalizeTriggerChannel } from '../../../domain/animation/channels';

export const getAnimationState = (
  globals: BlockbenchGlobals
): { animations: AnimationClip[]; status: 'available' | 'unavailable' } => {
  if (Array.isArray(globals.Animations)) return { animations: globals.Animations, status: 'available' };
  if (Array.isArray(globals.Animation?.all)) return { animations: globals.Animation.all, status: 'available' };
  return { animations: [], status: 'unavailable' };
};

export const extractChannels = (
  anim: AnimationClip
): { channels?: TrackedAnimationChannel[]; triggers?: TrackedAnimationTrigger[] } => {
  const animators = anim?.animators;
  if (!animators || typeof animators !== 'object') return {};
  const channels: TrackedAnimationChannel[] = [];
  const triggerBuckets: Record<'sound' | 'particle' | 'timeline', TrackedAnimationTrigger['keys']> = {
    sound: [],
    particle: [],
    timeline: []
  };
  Object.entries(animators).forEach(([bone, animator]) => {
    if (!isRecord(animator)) return;
    const grouped = collectAnimatorChannels(animator);
    grouped.forEach((entry) => {
      channels.push({ bone, channel: entry.channel, keys: entry.keys });
    });
    const triggerGroups = collectAnimatorTriggers(animator);
    triggerGroups.forEach((entry) => {
      triggerBuckets[entry.type].push(...entry.keys);
    });
  });
  const triggers = (Object.entries(triggerBuckets) as Array<
    ['sound' | 'particle' | 'timeline', TrackedAnimationTrigger['keys']]
  >)
    .filter(([, keys]) => keys.length > 0)
    .map(([type, keys]) => ({ type, keys }));
  return {
    channels: channels.length > 0 ? channels : undefined,
    triggers: triggers.length > 0 ? triggers : undefined
  };
};

export const normalizeLoop = (loopValue: unknown): boolean => {
  if (typeof loopValue === 'string') return loopValue === 'loop';
  return Boolean(loopValue);
};

const collectAnimatorChannels = (
  animator: UnknownRecord
): Array<{ channel: 'rot' | 'pos' | 'scale'; keys: TrackedAnimationChannel['keys'] }> => {
  const buckets: Record<'rot' | 'pos' | 'scale', TrackedAnimationChannel['keys']> = {
    rot: [],
    pos: [],
    scale: []
  };
  const keyframes = Array.isArray(animator.keyframes) ? animator.keyframes : [];
  keyframes.forEach((kf) => {
    if (!isRecord(kf)) return;
    const channel = normalizeAnimationChannel(kf.channel ?? kf.data_channel ?? kf.transform);
    const value = readVectorValue(kf);
    if (!channel || !value) return;
    buckets[channel].push({
      time: normalizeKeyframeTime(Number(kf.time ?? kf.frame ?? 0)),
      value,
      interp: normalizeInterp(kf.interpolation),
      easing: normalizeOptionalString(kf.easing),
      easingArgs: normalizeOptionalArray(kf.easingArgs ?? kf.easing_args),
      pre: readOptionalVec3(kf.pre),
      post: readOptionalVec3(kf.post),
      bezier: normalizeOptionalRecord(kf.bezier)
    });
  });
  return Object.entries(buckets)
    .filter(([, keys]) => keys.length > 0)
    .map(([channel, keys]) => ({ channel: channel as 'rot' | 'pos' | 'scale', keys }));
};

const collectAnimatorTriggers = (
  animator: UnknownRecord
): Array<{ type: 'sound' | 'particle' | 'timeline'; keys: TrackedAnimationTrigger['keys'] }> => {
  const buckets: Record<'sound' | 'particle' | 'timeline', TrackedAnimationTrigger['keys']> = {
    sound: [],
    particle: [],
    timeline: []
  };
  const keyframes = Array.isArray(animator.keyframes) ? animator.keyframes : [];
  keyframes.forEach((kf) => {
    if (!isRecord(kf)) return;
    const type = normalizeTriggerChannel(kf.channel ?? kf.data_channel ?? kf.transform);
    if (!type) return;
    const value = normalizeTriggerValue(kf.data_point ?? kf.data_points ?? kf.value ?? kf.data);
    if (value === null) return;
    buckets[type].push({
      time: normalizeKeyframeTime(Number(kf.time ?? kf.frame ?? 0)),
      value
    });
  });
  return (Object.entries(buckets) as Array<
    ['sound' | 'particle' | 'timeline', TrackedAnimationTrigger['keys']]
  >)
    .filter(([, keys]) => keys.length > 0)
    .map(([type, keys]) => ({ type, keys }));
};

const normalizeTriggerValue = (
  value: unknown
): string | string[] | Record<string, unknown> | null => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return value as string[];
    const allNumbers = value.every((item) => typeof item === 'number');
    if (allNumbers) return null;
    const allStrings = value.every((item) => typeof item === 'string');
    if (allStrings) return value as string[];
    return null;
  }
  if (isRecord(value)) return value;
  return null;
};

const normalizeInterp = (value: unknown): 'linear' | 'step' | 'catmullrom' | undefined => {
  const interp = String(value ?? '').toLowerCase();
  if (interp.includes('step')) return 'step';
  if (interp.includes('catmull')) return 'catmullrom';
  if (interp.includes('linear')) return 'linear';
  return undefined;
};

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeOptionalArray = (value: unknown): unknown[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return [...value];
};

const normalizeOptionalRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!isRecord(value)) return undefined;
  return value;
};

const readVec3FromArray = (value: unknown): [number, number, number] | null => {
  if (!Array.isArray(value) || value.length < 3) return null;
  const x = toFiniteNumber(value[0]);
  const y = toFiniteNumber(value[1]);
  const z = toFiniteNumber(value[2]);
  if (x === null || y === null || z === null) return null;
  return [x, y, z];
};

const readVec3FromPoint = (value: unknown): [number, number, number] | null => {
  if (!isRecord(value)) return null;
  const x = toFiniteNumber(value.x);
  const y = toFiniteNumber(value.y);
  const z = toFiniteNumber(value.z);
  if (x === null || y === null || z === null) return null;
  return [x, y, z];
};

const readVec3FromDataPoints = (value: unknown): [number, number, number] | null => {
  if (Array.isArray(value)) {
    const direct = readVec3FromArray(value);
    if (direct) return direct;
    const first = value[0];
    const fromPoint = readVec3FromPoint(first);
    if (fromPoint) return fromPoint;
  }
  return null;
};

const readOptionalVec3 = (value: unknown): [number, number, number] | undefined => {
  return readVec3FromArray(value) ?? readVec3FromPoint(value) ?? undefined;
};

const readVectorValue = (keyframe: UnknownRecord): [number, number, number] | null => {
  const fromDataPoints = readVec3FromDataPoints(keyframe.data_points);
  if (fromDataPoints) return fromDataPoints;
  const fromValue = readVec3FromArray(keyframe.value);
  if (fromValue) return fromValue;
  const fromDataPoint = readVec3FromArray(keyframe.data_point);
  if (fromDataPoint) return fromDataPoint;
  if (isRecord(keyframe.value)) {
    const fromVector = readVec3FromArray(keyframe.value.vector);
    if (fromVector) return fromVector;
    const fromPost = readVec3FromArray(keyframe.value.post);
    if (fromPost) return fromPost;
    const fromPre = readVec3FromArray(keyframe.value.pre);
    if (fromPre) return fromPre;
  }
  return null;
};
