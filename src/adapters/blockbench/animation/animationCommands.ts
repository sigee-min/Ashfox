import type { ToolError } from '../../../types';
import type {
  AnimationCommand,
  DeleteAnimationCommand,
  KeyframeCommand,
  TriggerKeyframeCommand,
  UpdateAnimationCommand
} from '../../../ports/editor';
import { errorMessage, type Logger } from '../../../logging';
import { toolError } from '../../../shared/tooling/toolResponse';
import type { AnimationClip, AnimatorInstance, GroupInstance, PreviewItem } from '../../../types/blockbench';
import { keyframeTimeBucket } from '../../../domain/animation/keyframes';
import { normalizeAnimationChannel, normalizeTriggerChannel } from '../../../domain/animation/channels';
import {
  ADAPTER_ANIMATION_API_UNAVAILABLE,
  ADAPTER_ANIMATOR_API_UNAVAILABLE,
  ANIMATION_CLIP_NOT_FOUND,
  MODEL_BONE_NOT_FOUND
} from '../../../shared/messages';
import {
  assignAnimationLength,
  readAnimationId,
  readGlobals,
  removeEntity,
  renameEntity,
  withUndo
} from '../blockbenchUtils';
import { findGroup } from '../outlinerLookup';

type KeyframeLike = {
  set?: (key: string, value: unknown) => void;
  data_point?: unknown;
  data_points?: unknown;
  value?: unknown;
  data?: unknown;
  interpolation?: unknown;
};

type AnimatorLike = {
  createKeyframe?: (
    value: unknown,
    time?: number,
    channel?: string,
    undo?: boolean,
    select?: boolean
  ) => KeyframeLike | undefined;
  addKeyframe?: (data: unknown, uuid?: string) => KeyframeLike | undefined;
  keyframes?: unknown[];
};

type BoneAnimatorConstructor = new (uuid: string, clip: AnimationClip) => AnimatorLike;
type EffectAnimatorConstructor = new (clip: AnimationClip) => AnimatorLike;

export const runCreateAnimation = (log: Logger, params: AnimationCommand): ToolError | null => {
  try {
    const { Animation: AnimationCtor } = readGlobals();
    if (typeof AnimationCtor === 'undefined') {
      return { code: 'not_implemented', message: ADAPTER_ANIMATION_API_UNAVAILABLE };
    }
    withUndo({ animations: true }, 'Create animation', () => {
      const anim = new AnimationCtor({
        name: params.name,
        length: params.length,
        loop: params.loop ? 'loop' : 'once',
        snapping: params.fps
      });
      if (params.id) anim.bbmcpId = params.id;
      anim.add?.(true);
    });
    log.info('animation created', { name: params.name });
    return null;
  } catch (err) {
    const message = errorMessage(err, 'animation create failed');
    log.error('animation create error', { message });
    return toolError('unknown', message, { reason: 'adapter_exception', context: 'animation_create' });
  }
};

export const runUpdateAnimation = (log: Logger, params: UpdateAnimationCommand): ToolError | null => {
  try {
    const animations = getAnimations();
    const target = findAnimationRef(params.name, params.id, animations);
    if (!target) {
      const label = params.id ?? params.name ?? 'unknown';
      return { code: 'invalid_payload', message: ANIMATION_CLIP_NOT_FOUND(label) };
    }
    if (params.id) target.bbmcpId = params.id;
    withUndo({ animations: true }, 'Update animation', () => {
      if (params.newName && params.newName !== target.name) {
        renameEntity(target, params.newName);
      }
      if (typeof params.length === 'number') {
        assignAnimationLength(target, params.length);
      }
      if (typeof params.loop === 'boolean') {
        if (typeof target.loop === 'string') {
          target.loop = params.loop ? 'loop' : 'once';
        } else {
          target.loop = params.loop;
        }
      }
      if (typeof params.fps === 'number') {
        if (typeof target.snapping !== 'undefined') {
          target.snapping = params.fps;
        } else {
          target.fps = params.fps;
        }
      }
    });
    log.info('animation updated', { name: params.name, newName: params.newName });
    return null;
  } catch (err) {
    const message = errorMessage(err, 'animation update failed');
    log.error('animation update error', { message });
    return toolError('unknown', message, { reason: 'adapter_exception', context: 'animation_update' });
  }
};

export const runDeleteAnimation = (log: Logger, params: DeleteAnimationCommand): ToolError | null => {
  try {
    const animations = getAnimations();
    const target = findAnimationRef(params.name, params.id, animations);
    if (!target) {
      const label = params.id ?? params.name ?? 'unknown';
      return { code: 'invalid_payload', message: ANIMATION_CLIP_NOT_FOUND(label) };
    }
    withUndo({ animations: true }, 'Delete animation', () => {
      if (removeEntity(target)) return;
      if (Array.isArray(animations)) {
        const idx = animations.indexOf(target);
        if (idx >= 0) animations.splice(idx, 1);
      }
    });
    log.info('animation deleted', { name: target?.name ?? params.name });
    return null;
  } catch (err) {
    const message = errorMessage(err, 'animation delete failed');
    log.error('animation delete error', { message });
    return toolError('unknown', message, { reason: 'adapter_exception', context: 'animation_delete' });
  }
};

export const runSetKeyframes = (log: Logger, params: KeyframeCommand): ToolError | null => {
  try {
    const animations = getAnimations();
    const clip = findAnimationRef(params.clip, params.clipId, animations);
    if (!clip) {
      const label = params.clipId ?? params.clip;
      return { code: 'invalid_payload', message: ANIMATION_CLIP_NOT_FOUND(label) };
    }
    const group = findGroup(params.bone);
    if (!group) {
      return { code: 'invalid_payload', message: MODEL_BONE_NOT_FOUND(params.bone) };
    }
    const canResolve =
      typeof clip.getBoneAnimator === 'function' ||
      typeof (group as { constructor?: { animator?: unknown } }).constructor?.animator === 'function';
    if (!canResolve) {
      return { code: 'not_implemented', message: ADAPTER_ANIMATOR_API_UNAVAILABLE };
    }
    let resolveError: ToolError | null = null;
    withUndo({ animations: true, keyframes: [] }, 'Set keyframes', () => {
      if (clip) {
        clip.select?.();
        const animator = resolveBoneAnimator(clip, group);
        if (!animator) {
          resolveError = { code: 'not_implemented', message: ADAPTER_ANIMATOR_API_UNAVAILABLE };
          return;
        }
        const channelKey = resolveAnimationChannelKey(params.channel);
        sanitizeClipKeyframes(clip);
        sanitizeAnimatorKeyframes(animator);
        sanitizeAnimatorChannels(animator, ['rotation', 'position', 'scale']);
        for (const k of params.keys) {
          const matches = findExistingKeyframes(animator, params.channel, k.time, params.timePolicy);
          if (matches.length > 0) {
            matches.forEach((keyframe) => applyKeyframeValue(keyframe, k.value, k.interp));
            continue;
          }
          const result = createTransformKeyframe(animator, channelKey, k.time, k.value, k.interp);
          if (result.error) {
            resolveError = toolError('unknown', errorMessage(result.error, 'keyframe create failed'), {
              reason: 'adapter_exception',
              context: 'keyframe_set'
            });
            break;
          }
          if (!result.keyframe) continue;
          applyKeyframeValue(result.keyframe, k.value, k.interp);
        }
      }
    });
    if (resolveError) return resolveError;
    refreshAnimationViewport(log, clip, lastKeyframeTime(params.keys));
    log.info('keyframes set', { clip: params.clip, bone: params.bone, count: params.keys.length });
    return null;
  } catch (err) {
    const message = errorMessage(err, 'keyframe set failed');
    log.error('keyframe set error', { message });
    return toolError('unknown', message, { reason: 'adapter_exception', context: 'keyframe_set' });
  }
};

export const runSetTriggerKeyframes = (log: Logger, params: TriggerKeyframeCommand): ToolError | null => {
  try {
    const globals = readGlobals();
    const animations = getAnimations();
    const clip = findAnimationRef(params.clip, params.clipId, animations);
    if (!clip) {
      const label = params.clipId ?? params.clip;
      return { code: 'invalid_payload', message: ANIMATION_CLIP_NOT_FOUND(label) };
    }
    const canResolve =
      hasEffectAnimator(clip) || typeof globals.EffectAnimator === 'function';
    if (!canResolve) {
      return { code: 'not_implemented', message: ADAPTER_ANIMATOR_API_UNAVAILABLE };
    }
    let resolveError: ToolError | null = null;
    withUndo({ animations: true, keyframes: [] }, 'Set trigger keyframes', () => {
      clip.select?.();
      const animator = resolveEffectAnimator(clip, globals);
      if (!animator) {
        resolveError = { code: 'not_implemented', message: ADAPTER_ANIMATOR_API_UNAVAILABLE };
        return;
      }
      sanitizeClipKeyframes(clip);
      sanitizeAnimatorKeyframes(animator);
      sanitizeAnimatorChannel(animator, params.channel);
      params.keys.forEach((k) => {
        const matches = findExistingKeyframes(animator, params.channel, k.time, params.timePolicy);
        if (matches.length > 0) {
          matches.forEach((keyframe) => applyTriggerValue(keyframe, k.value));
          return;
        }
        const kf = animator?.createKeyframe?.(undefined, k.time, params.channel, false, false);
        if (!kf) return;
        applyTriggerValue(kf, k.value);
      });
    });
    if (resolveError) return resolveError;
    refreshAnimationViewport(log, clip, lastTriggerKeyframeTime(params.keys));
    log.info('trigger keyframes set', { clip: params.clip, channel: params.channel, count: params.keys.length });
    return null;
  } catch (err) {
    const message = errorMessage(err, 'trigger keyframe set failed');
    log.error('trigger keyframe set error', { message });
    return toolError('unknown', message, { reason: 'adapter_exception', context: 'trigger_keyframe_set' });
  }
};

const findAnimationRef = (name?: string, id?: string, list?: AnimationClip[]): AnimationClip | null => {
  const animations = list ?? getAnimations();
  if (id) {
    const byId = animations.find((anim) => readAnimationId(anim) === id);
    if (byId) return byId;
  }
  if (name) return animations.find((anim) => anim?.name === name) ?? null;
  return null;
};

const EFFECT_ANIMATOR_KEYS = ['effects', 'effect', 'timeline', 'events'];

const resolveEffectAnimator = (clip: AnimationClip, globals: ReturnType<typeof readGlobals>): AnimatorLike | null => {
  const animators = (clip.animators ?? {}) as Record<string, unknown>;
  const existingKey = Object.keys(animators).find((key) =>
    EFFECT_ANIMATOR_KEYS.some((candidate) => key.toLowerCase().includes(candidate))
  );
  if (existingKey) {
    const existing = animators[existingKey];
    if (existing && typeof existing === 'object') return existing as AnimatorLike;
  }
  const ctor = globals.EffectAnimator as EffectAnimatorConstructor | undefined;
  if (typeof ctor !== 'function') return null;
  const animator = new ctor(clip);
  animators.effects = animator;
  clip.animators = animators;
  return animator;
};

const resolveBoneAnimator = (clip: AnimationClip, group: GroupInstance): AnimatorLike | null => {
  if (typeof clip.getBoneAnimator === 'function') {
    const animator = clip.getBoneAnimator(group) as AnimatorInstance | undefined;
    if (animator && typeof animator === 'object') return animator as AnimatorLike;
  }
  const ctor = (group as { constructor?: { animator?: unknown } }).constructor?.animator;
  if (typeof ctor !== 'function') return null;
  const uuid = group.uuid ?? group.id ?? group.name ?? 'bone';
  const animator = new (ctor as BoneAnimatorConstructor)(uuid, clip);
  const animators = (clip.animators ?? {}) as Record<string, unknown>;
  animators[String(uuid)] = animator;
  clip.animators = animators;
  return animator as AnimatorLike;
};

const hasEffectAnimator = (clip: AnimationClip): boolean => {
  const animators = (clip.animators ?? {}) as Record<string, unknown>;
  return Object.keys(animators).some((key) =>
    EFFECT_ANIMATOR_KEYS.some((candidate) => key.toLowerCase().includes(candidate))
  );
};

const resolveAnimationChannelKey = (channel: KeyframeCommand['channel']): string => {
  switch (channel) {
    case 'rot':
      return 'rotation';
    case 'pos':
      return 'position';
    case 'scale':
      return 'scale';
  }
};

const sanitizeKeyframeList = (list: unknown[] | undefined) => {
  if (!Array.isArray(list)) return;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const entry = list[i];
    if (!entry || typeof entry !== 'object') {
      try {
        list.splice(i, 1);
      } catch (err) {
        void err;
        break;
      }
    }
  }
};

const sanitizeAnimatorChannel = (animator: AnimatorLike, channel: string) => {
  const record = animator as Record<string, unknown>;
  sanitizeKeyframeList(record[channel] as unknown[] | undefined);
};

const sanitizeAnimatorChannels = (animator: AnimatorLike, channels: string[]) => {
  channels.forEach((channel) => sanitizeAnimatorChannel(animator, channel));
};

const sanitizeAnimatorKeyframes = (animator: AnimatorLike) => {
  sanitizeKeyframeList(animator.keyframes);
};

const sanitizeClipKeyframes = (clip: AnimationClip) => {
  sanitizeKeyframeList(clip.keyframes);
};

const buildKeyframeValueData = (value: unknown, interp?: string): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  if (Array.isArray(value)) {
    const normalized = value.map((entry) =>
      typeof entry === 'number' && Number.isFinite(entry) ? entry : 0
    );
    data.data_points = [{ x: normalized[0], y: normalized[1], z: normalized[2] }];
  }
  if (interp) data.interpolation = interp;
  return data;
};

const lastKeyframeTime = (keys: Array<{ time: number }>): number | undefined => {
  if (!Array.isArray(keys) || keys.length === 0) return undefined;
  const last = keys[keys.length - 1];
  const time = Number(last?.time);
  return Number.isFinite(time) ? time : undefined;
};

const lastTriggerKeyframeTime = (
  keys: Array<{ time: number; value: string | string[] | Record<string, unknown> }>
): number | undefined => {
  if (!Array.isArray(keys) || keys.length === 0) return undefined;
  const last = keys[keys.length - 1];
  const time = Number(last?.time);
  return Number.isFinite(time) ? time : undefined;
};

const createTransformKeyframe = (
  animator: AnimatorLike,
  channel: string,
  time: number,
  value: unknown,
  interp?: string
): { keyframe?: KeyframeLike; error?: unknown } => {
  const valueData = buildKeyframeValueData(value, interp);
  const numericTime = Number(time);
  const resolvedTime = Number.isFinite(numericTime) ? numericTime : 0;
  let lastError: unknown = null;

  if (typeof animator.createKeyframe === 'function') {
    const createValue = Array.isArray(value) ? value : valueData;
    try {
      const created = animator.createKeyframe(createValue, resolvedTime, channel, false, false);
      if (created) return { keyframe: created };
    } catch (err) {
      lastError = err;
    }
  }

  if (typeof animator.addKeyframe === 'function') {
    try {
      const created = animator.addKeyframe({ channel, time: resolvedTime, ...valueData });
      if (created) return { keyframe: created };
    } catch (err) {
      if (!lastError) lastError = err;
    }
  }

  if (lastError) return { error: lastError };
  return {};
};

const refreshAnimationViewport = (log: Logger, clip: AnimationClip | null, time?: number) => {
  if (!clip) return;
  const globals = readGlobals();
  try {
    if (typeof clip.select === 'function') {
      clip.select();
    } else if (globals.Animation?.selected) {
      globals.Animation.selected = clip;
    }
    if (Number.isFinite(Number(time))) {
      const resolvedTime = Number(time);
      if (typeof clip.setTime === 'function') {
        clip.setTime(resolvedTime);
      } else if (typeof globals.Animator?.setTime === 'function') {
        globals.Animator.setTime(resolvedTime);
      } else if (typeof globals.Animator?.preview === 'function') {
        globals.Animator.preview(resolvedTime);
      } else if (typeof clip.time === 'number') {
        clip.time = resolvedTime;
      }
    }
    renderViewportPreview(globals);
  } catch (err) {
    log.warn('animation viewport refresh failed', { message: errorMessage(err, 'viewport refresh failed') });
  }
};

const renderViewportPreview = (globals: ReturnType<typeof readGlobals>): void => {
  const registry = globals.Preview;
  const selected = registry?.selected;
  const all = registry?.all ?? [];
  const candidates = [selected, ...all].filter((entry): entry is PreviewItem => Boolean(entry));
  const rendered = new Set<PreviewItem>();
  for (const preview of candidates) {
    if (rendered.has(preview)) continue;
    if (typeof preview.render === 'function') {
      preview.render();
      rendered.add(preview);
    }
  }
};

const readKeyframeTime = (keyframe: KeyframeLike): number => {
  const raw = (keyframe as { time?: unknown; frame?: unknown }).time ?? (keyframe as { frame?: unknown }).frame;
  const value = typeof raw === 'number' ? raw : Number(raw ?? 0);
  return Number.isFinite(value) ? value : 0;
};


const findExistingKeyframes = (
  animator: AnimatorLike | undefined,
  channel: string,
  time: number,
  timePolicy?: KeyframeCommand['timePolicy']
): KeyframeLike[] => {
  if (!animator || !Array.isArray(animator.keyframes)) return [];
  const targetTime = Number(time);
  if (!Number.isFinite(targetTime)) return [];
  const targetBucket = keyframeTimeBucket(targetTime, timePolicy);
  const channelRaw = channel.toLowerCase();
  const matches: KeyframeLike[] = [];
  animator.keyframes.forEach((kf) => {
    if (!kf || typeof kf !== 'object') return false;
    const keyframe = kf as KeyframeLike;
    const rawChannel = String(
      (keyframe as { channel?: unknown; data_channel?: unknown; transform?: unknown }).channel ??
        (keyframe as { data_channel?: unknown }).data_channel ??
        (keyframe as { transform?: unknown }).transform ??
        ''
    ).toLowerCase();
    const channelOk =
      channelRaw === 'rot' || channelRaw === 'pos' || channelRaw === 'scale'
        ? normalizeAnimationChannel(rawChannel) === channelRaw
        : normalizeTriggerChannel(rawChannel) === channelRaw;
    if (!channelOk) return;
    const kfTime = readKeyframeTime(keyframe);
    if (keyframeTimeBucket(kfTime, timePolicy) === targetBucket) {
      matches.push(keyframe);
    }
  });
  return matches;
};

const applyKeyframeValue = (keyframe: KeyframeLike, value: unknown, interp?: string) => {
  if (!Array.isArray(value)) return;
  const normalized = value.map((entry) => (typeof entry === 'number' && Number.isFinite(entry) ? entry : 0));
  if (keyframe.set) {
    keyframe.set('x', normalized[0]);
    keyframe.set('y', normalized[1]);
    keyframe.set('z', normalized[2]);
  } else if (Array.isArray(keyframe.data_points) && keyframe.data_points[0]) {
    const point = keyframe.data_points[0] as Record<string, unknown>;
    point.x = normalized[0];
    point.y = normalized[1];
    point.z = normalized[2];
  } else {
    keyframe.data_points = [{ x: normalized[0], y: normalized[1], z: normalized[2] }];
  }
  if (interp) keyframe.interpolation = interp;
};

const applyTriggerValue = (keyframe: KeyframeLike, value: unknown) => {
  if (keyframe.set) {
    keyframe.set('data_point', value);
    keyframe.set('data_points', value);
    keyframe.set('value', value);
    keyframe.set('data', value);
    return;
  }
  keyframe.data_point = value;
  keyframe.data_points = value;
  keyframe.value = value;
  keyframe.data = value;
};

export const getAnimations = (): AnimationClip[] => {
  const globals = readGlobals();
  if (Array.isArray(globals.Animations)) return globals.Animations;
  if (Array.isArray(globals.Animation?.all)) return globals.Animation.all;
  return [];
};
