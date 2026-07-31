import type {
  AnimationScalar,
  AnimationVec3,
  MolangExpression,
  TransformChannel
} from '../../model';
import type {
  MinecraftAnimationScalar,
  MinecraftAnimationVector
} from './minecraftAnimationTypes';

const isMolang = (value: AnimationScalar): value is MolangExpression =>
  typeof value === 'object' && value !== null && value.kind === 'molang';

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
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded);
};

export const containsMolang = (value: AnimationVec3): boolean =>
  value.some((component) => isMolang(component));
