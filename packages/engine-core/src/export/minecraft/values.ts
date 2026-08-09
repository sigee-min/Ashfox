import type {
  AnimationScalar,
  AnimationVec3,
  TransformChannel
} from '../../model';
import type {
  MinecraftAnimationScalar,
  MinecraftAnimationVector
} from './types';

export const serializeAnimationScalar = (
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

export const serializeAnimationVector = (
  value: AnimationVec3,
  property: TransformChannel['property']
): MinecraftAnimationVector => [
  serializeAnimationScalar(
    value[0],
    property === 'position' || property === 'rotation'
  ),
  serializeAnimationScalar(value[1], property === 'rotation'),
  serializeAnimationScalar(value[2], false)
];

export const formatAnimationTimestamp = (timeSeconds: number): string => {
  const rounded = Number(timeSeconds.toFixed(4));
  return String(rounded);
};
