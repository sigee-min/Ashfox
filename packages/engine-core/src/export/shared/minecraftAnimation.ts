import type {
  AnimationClip,
  AnimationEffect,
  AnimationEffectValue,
  AnimationScalar,
  AnimationTriggerTrack,
  AnimationVec3,
  MolangExpression,
  ProjectDocument,
  TransformChannel,
  TransformKeyframe
} from '../../model';

export type MinecraftAnimationScalar = number | string;
export type MinecraftAnimationVector = [
  MinecraftAnimationScalar,
  MinecraftAnimationScalar,
  MinecraftAnimationScalar
];

export interface MinecraftAnimationKeyframe {
  vector?: MinecraftAnimationVector;
  pre?: MinecraftAnimationVector;
  post?: MinecraftAnimationVector;
  lerp_mode?: 'linear' | 'step' | 'catmullrom';
  easing?: string;
  easingArgs?: MinecraftAnimationScalar[];
}

export type MinecraftAnimationChannel = Record<
  string,
  MinecraftAnimationVector | MinecraftAnimationKeyframe
>;

export interface MinecraftBoneAnimation {
  relative_to?: { rotation: 'entity' } | 'entity';
  position?: MinecraftAnimationChannel;
  rotation?: MinecraftAnimationChannel;
  scale?: MinecraftAnimationChannel;
}

export interface MinecraftAnimationEffect {
  effect: string;
  locator?: string;
  pre_effect_script?: string;
  bind_to_actor?: boolean;
}

export interface MinecraftActorAnimation {
  loop?: true | 'hold_on_last_frame';
  animation_length: number;
  start_delay?: string;
  loop_delay?: string;
  anim_time_update?: string;
  blend_weight?: MinecraftAnimationScalar;
  override_previous_animation?: boolean;
  bones?: Record<string, MinecraftBoneAnimation>;
  sound_effects?: Record<
    string,
    MinecraftAnimationEffect | MinecraftAnimationEffect[]
  >;
  particle_effects?: Record<
    string,
    MinecraftAnimationEffect | MinecraftAnimationEffect[]
  >;
  timeline?: Record<string, string | readonly string[]>;
}

export interface MinecraftActorAnimationFile {
  format_version: '1.8.0';
  animations: Record<string, MinecraftActorAnimation>;
}

export interface MinecraftAnimationCompileOptions {
  formatVersion: '1.8.0';
  dialect: 'bedrock' | 'geckolib5';
}

const isMolang = (value: AnimationScalar): value is MolangExpression =>
  typeof value === 'object' && value !== null && value.kind === 'molang';

const isAnimationEffect = (value: unknown): value is AnimationEffect =>
  typeof value === 'object' &&
  value !== null &&
  'effect' in value &&
  typeof value.effect === 'string';

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === 'string');

const isAnimationEffectArray = (
  value: AnimationEffectValue | string | readonly string[]
): value is readonly AnimationEffect[] =>
  Array.isArray(value) &&
  value.every((entry) => isAnimationEffect(entry));

const serializeScalar = (
  value: AnimationScalar,
  negate: boolean
): MinecraftAnimationScalar => {
  if (typeof value === 'number') {
    const result = negate ? -value : value;
    return Math.abs(result) <= 0.000001 ? 0 : result;
  }
  const source = value.source.trim();
  return negate ? `-(${source})` : source;
};

const serializeVector = (
  value: AnimationVec3,
  property: TransformChannel['property']
): MinecraftAnimationVector => [
  serializeScalar(value[0], property === 'position' || property === 'rotation'),
  serializeScalar(value[1], property === 'rotation'),
  serializeScalar(value[2], false)
];

const formatTimestamp = (timeSeconds: number): string => {
  const rounded = Number(timeSeconds.toFixed(4));
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
};

const compileKeyframe = (
  keyframe: TransformKeyframe,
  property: TransformChannel['property'],
  options: MinecraftAnimationCompileOptions
): MinecraftAnimationVector | MinecraftAnimationKeyframe => {
  if (
    options.dialect === 'bedrock' &&
    (keyframe.interpolation === 'step' || keyframe.easing)
  ) {
    throw new Error(
      'Bedrock actor animation 1.8.0 cannot compile STEP or GeckoLib easing.'
    );
  }
  const vector = serializeVector(keyframe.value, property);
  const hasEnvelope =
    keyframe.preValue !== undefined ||
    keyframe.postValue !== undefined ||
    keyframe.easing !== undefined ||
    keyframe.interpolation !== 'linear';
  if (!hasEnvelope) return vector;

  if (options.dialect === 'bedrock') {
    return {
      ...(keyframe.preValue
        ? { pre: serializeVector(keyframe.preValue, property) }
        : { pre: vector }),
      ...(keyframe.postValue
        ? { post: serializeVector(keyframe.postValue, property) }
        : { post: vector }),
      ...(keyframe.interpolation === 'catmullrom'
        ? { lerp_mode: 'catmullrom' as const }
        : {})
    };
  }

  return {
    vector,
    ...(keyframe.preValue
      ? { pre: serializeVector(keyframe.preValue, property) }
      : {}),
    ...(keyframe.postValue
      ? { post: serializeVector(keyframe.postValue, property) }
      : {}),
    ...(keyframe.easing
      ? {
          easing: keyframe.easing.type,
          ...(keyframe.easing.arguments
            ? {
                easingArgs: keyframe.easing.arguments.map((argument) =>
                  serializeScalar(argument, false)
                )
              }
            : {})
        }
      : keyframe.interpolation !== 'linear'
        ? { lerp_mode: keyframe.interpolation }
        : {})
  };
};

const compileChannel = (
  channel: TransformChannel,
  options: MinecraftAnimationCompileOptions
): MinecraftAnimationChannel => {
  const result: MinecraftAnimationChannel = {};
  for (const keyframe of channel.keys) {
    result[formatTimestamp(keyframe.timeSeconds)] = compileKeyframe(
      keyframe,
      channel.property,
      options
    );
  }
  return result;
};

const resolveLocatorName = (
  document: ProjectDocument,
  locatorId: string | undefined
): string | undefined => {
  if (!locatorId) return undefined;
  const locator = document.scene.nodes[locatorId];
  return locator?.kind === 'locator' ? locator.name : undefined;
};

const compileEffect = (
  document: ProjectDocument,
  effect: AnimationEffect
): MinecraftAnimationEffect => {
  const locator = resolveLocatorName(document, effect.locatorId);
  return {
    effect: effect.effect,
    ...(locator ? { locator } : {}),
    ...(effect.preEffectScript
      ? { pre_effect_script: effect.preEffectScript.source }
      : {}),
    ...(effect.bindToActor !== undefined
      ? { bind_to_actor: effect.bindToActor }
      : {})
  };
};

const compileEffectValue = (
  document: ProjectDocument,
  value: AnimationEffectValue
): MinecraftAnimationEffect | MinecraftAnimationEffect[] =>
  isAnimationEffectArray(value)
    ? value.map((effect) => compileEffect(document, effect))
    : compileEffect(document, value);

const compileTriggerTracks = (
  document: ProjectDocument,
  tracks: readonly AnimationTriggerTrack[],
  options: MinecraftAnimationCompileOptions
): Pick<
  MinecraftActorAnimation,
  'sound_effects' | 'particle_effects' | 'timeline'
> => {
  const soundEffects: Record<
    string,
    MinecraftAnimationEffect | MinecraftAnimationEffect[]
  > = {};
  const particleEffects: Record<
    string,
    MinecraftAnimationEffect | MinecraftAnimationEffect[]
  > = {};
  const timeline: Record<string, string | readonly string[]> = {};

  for (const track of tracks) {
    for (const keyframe of track.keys) {
      const timestamp = formatTimestamp(keyframe.timeSeconds);
      if (track.type === 'sound') {
        if (
          options.dialect === 'geckolib5' &&
          isAnimationEffectArray(keyframe.value)
        ) {
          throw new Error(
            'GeckoLib 5 effect timestamps require a single decoded value.'
          );
        }
        if (
          isAnimationEffect(keyframe.value) ||
          isAnimationEffectArray(keyframe.value)
        ) {
          soundEffects[timestamp] = compileEffectValue(
            document,
            keyframe.value
          );
        }
      } else if (track.type === 'particle') {
        if (
          options.dialect === 'geckolib5' &&
          isAnimationEffectArray(keyframe.value)
        ) {
          throw new Error(
            'GeckoLib 5 effect timestamps require a single decoded value.'
          );
        }
        if (
          isAnimationEffect(keyframe.value) ||
          isAnimationEffectArray(keyframe.value)
        ) {
          particleEffects[timestamp] = compileEffectValue(
            document,
            keyframe.value
          );
        }
      } else {
        if (
          options.dialect === 'geckolib5' &&
          isStringArray(keyframe.value)
        ) {
          throw new Error(
            'GeckoLib 5 timeline timestamps require a single string.'
          );
        }
        timeline[timestamp] = isStringArray(keyframe.value)
          ? options.dialect === 'bedrock'
            ? keyframe.value
            : keyframe.value.join('\n')
          : typeof keyframe.value === 'string'
            ? keyframe.value
            : '';
      }
    }
  }

  return {
    ...(Object.keys(soundEffects).length > 0
      ? { sound_effects: soundEffects }
      : {}),
    ...(Object.keys(particleEffects).length > 0
      ? { particle_effects: particleEffects }
      : {}),
    ...(Object.keys(timeline).length > 0 ? { timeline } : {})
  };
};

const compileClip = (
  document: ProjectDocument,
  clip: AnimationClip,
  options: MinecraftAnimationCompileOptions
): MinecraftActorAnimation => {
  const bones: Record<string, MinecraftBoneAnimation> = {};
  const channels = Object.values(clip.channels).sort((left, right) =>
    left.id.localeCompare(right.id)
  );
  for (const channel of channels) {
    const target = document.scene.nodes[channel.targetNodeId];
    if (!target || target.kind !== 'bone') continue;
    const bone = bones[target.name] ?? {};
    if (
      channel.property === 'rotation' &&
      channel.rotationSpace === 'entity'
    ) {
      bone.relative_to =
        options.dialect === 'bedrock'
          ? { rotation: 'entity' }
          : 'entity';
    }
    bone[channel.property] = compileChannel(channel, options);
    bones[target.name] = bone;
  }

  return {
    ...(clip.loop === 'loop'
      ? { loop: true as const }
      : clip.loop === 'hold_on_last_frame'
        ? { loop: 'hold_on_last_frame' as const }
        : {}),
    animation_length: clip.durationSeconds,
    ...(clip.startDelay
      ? { start_delay: clip.startDelay.source }
      : {}),
    ...(clip.loopDelay
      ? { loop_delay: clip.loopDelay.source }
      : {}),
    ...(clip.animationTimeUpdate
      ? { anim_time_update: clip.animationTimeUpdate.source }
      : {}),
    ...(clip.blendWeight !== undefined
      ? { blend_weight: serializeScalar(clip.blendWeight, false) }
      : {}),
    ...(clip.overridePreviousAnimation !== undefined
      ? {
          override_previous_animation:
            clip.overridePreviousAnimation
        }
      : {}),
    ...(Object.keys(bones).length > 0 ? { bones } : {}),
    ...compileTriggerTracks(
      document,
      Object.values(clip.triggers).sort((left, right) =>
        left.id.localeCompare(right.id)
      ),
      options
    )
  };
};

export const buildMinecraftActorAnimation = (
  document: ProjectDocument,
  options: MinecraftAnimationCompileOptions
): MinecraftActorAnimationFile => {
  const animations: Record<string, MinecraftActorAnimation> = {};
  for (const clip of Object.values(document.animations).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    animations[clip.name] = compileClip(document, clip, options);
  }
  return {
    format_version: options.formatVersion,
    animations
  };
};

export const containsMolang = (value: AnimationVec3): boolean =>
  value.some((component) => isMolang(component));
