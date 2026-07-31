import type {
  TransformChannel,
  TransformKeyframe
} from '../../model';
import type {
  MinecraftAnimationChannel,
  MinecraftAnimationCompileOptions,
  MinecraftAnimationKeyframe,
  MinecraftAnimationVector
} from './minecraftAnimationTypes';
import {
  formatAnimationTimestamp,
  serializeAnimationScalar,
  serializeAnimationVector
} from './minecraftAnimationValues';

const compileKeyframe = (
  keyframe: TransformKeyframe,
  property: TransformChannel['property'],
  options: MinecraftAnimationCompileOptions
): MinecraftAnimationVector | MinecraftAnimationKeyframe => {
  const vector = serializeAnimationVector(keyframe.value, property);
  const hasEnvelope =
    keyframe.preValue !== undefined ||
    keyframe.postValue !== undefined ||
    keyframe.easing !== undefined ||
    keyframe.interpolation !== 'linear';
  if (!hasEnvelope) return vector;

  if (options.dialect === 'bedrock') {
    return {
      ...(keyframe.preValue
        ? { pre: serializeAnimationVector(keyframe.preValue, property) }
        : { pre: vector }),
      ...(keyframe.postValue
        ? { post: serializeAnimationVector(keyframe.postValue, property) }
        : { post: vector }),
      ...(keyframe.interpolation === 'catmullrom'
        ? { lerp_mode: 'catmullrom' as const }
        : {})
    };
  }

  return {
    vector,
    ...(keyframe.preValue
      ? { pre: serializeAnimationVector(keyframe.preValue, property) }
      : {}),
    ...(keyframe.postValue
      ? { post: serializeAnimationVector(keyframe.postValue, property) }
      : {}),
    ...(keyframe.easing
      ? {
          easing: keyframe.easing.type,
          ...(keyframe.easing.arguments
            ? {
                easingArgs: keyframe.easing.arguments.map((argument) =>
                  serializeAnimationScalar(argument, false)
                )
              }
            : {})
        }
      : keyframe.interpolation !== 'linear'
        ? { lerp_mode: keyframe.interpolation }
        : {})
  };
};

export const compileMinecraftAnimationChannel = (
  channel: TransformChannel,
  options: MinecraftAnimationCompileOptions
): MinecraftAnimationChannel => {
  const result: MinecraftAnimationChannel = {};
  for (const keyframe of channel.keys) {
    result[formatAnimationTimestamp(keyframe.timeSeconds)] = compileKeyframe(
      keyframe,
      channel.property,
      options
    );
  }
  return result;
};
