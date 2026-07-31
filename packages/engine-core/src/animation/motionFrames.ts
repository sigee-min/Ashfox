import type {
  TransformChannel
} from '../model';
import type {
  CompiledPartState
} from '../modeling/partInvariants';
import { compiledPartBoneId } from '../modeling/provenance';
import {
  MOTION_AUTHORING_FPS,
  motionAuthoringIssue,
  type AnimationMotionRole,
  type AnimationRotationDegrees,
  type MotionAuthoringIssue
} from './motionContract';

export type Rotation =
  readonly [number, number, number];

export const zeroRotation = (): Rotation => [0, 0, 0];

export const isMotionIssue = (
  value: readonly unknown[] | MotionAuthoringIssue
): value is MotionAuthoringIssue =>
  !Array.isArray(value);

export const axisIndex = (
  axis: 'x' | 'y' | 'z'
): 0 | 1 | 2 =>
  axis === 'x' ? 0 : axis === 'y' ? 1 : 2;

export const canAnimate = (
  part: CompiledPartState
): boolean =>
  part.parentPartId === null ||
  part.joint.kind !== 'fixed';

export const rotationForPart = (
  part: CompiledPartState,
  input: AnimationRotationDegrees,
  path: string
): Rotation | MotionAuthoringIssue => {
  if (!canAnimate(part)) {
    return motionAuthoringIssue(
      'invalid_payload',
      `Fixed child part "${part.partId}" cannot be animated.`,
      path,
      'a hinge part, ball part, or the root part'
    );
  }
  if (part.joint.kind === 'hinge') {
    if (typeof input !== 'number') {
      return motionAuthoringIssue(
        'invalid_payload',
        `Hinge part "${part.partId}" requires one scalar angle.`,
        path,
        `degree number around the ${part.joint.axis}-axis`
      );
    }
    const rotation: [number, number, number] = [0, 0, 0];
    rotation[axisIndex(part.joint.axis)] = input;
    return rotation;
  }
  if (typeof input === 'number') {
    return motionAuthoringIssue(
      'invalid_payload',
      `Part "${part.partId}" requires an XYZ rotation vector.`,
      path,
      'three degree numbers [x, y, z]'
    );
  }
  return input;
};

const nearestEquivalent = (
  reference: number,
  value: number
): number =>
  value + 360 * Math.round((reference - value) / 360);

const unwrapRotation = (
  previous: Rotation,
  current: Rotation
): Rotation => [
  nearestEquivalent(previous[0], current[0]),
  nearestEquivalent(previous[1], current[1]),
  nearestEquivalent(previous[2], current[2])
];

const rotationsEqual = (
  left: Rotation,
  right: Rotation
): boolean =>
  left.every((value, index) => value === right[index]);

export const unwrapSequence = (
  values: readonly Rotation[],
  role: AnimationMotionRole,
  partId: string
): readonly Rotation[] | MotionAuthoringIssue => {
  if (values.length === 0) return [];
  const unwrapped: Rotation[] = [values[0]];
  for (let index = 1; index < values.length; index += 1) {
    unwrapped.push(
      unwrapRotation(unwrapped[index - 1], values[index])
    );
  }
  if (role === 'once') return unwrapped;
  const closing = unwrapRotation(
    unwrapped[unwrapped.length - 1],
    unwrapped[0]
  );
  if (!rotationsEqual(closing, unwrapped[0])) {
    return motionAuthoringIssue(
      'invalid_payload',
      `Loop poses for part "${partId}" contain a full winding.`,
      'payload.poses',
      `oscillating poses for "${partId}", or a spins entry for continuous rotation`
    );
  }
  return [...unwrapped, unwrapped[0]];
};

export const poseFrames = (
  role: AnimationMotionRole,
  durationFrames: number,
  poseCount: number
): readonly number[] | MotionAuthoringIssue => {
  if (role === 'once') {
    if (poseCount === 1) return [0, durationFrames];
    if (poseCount > durationFrames + 1) {
      return motionAuthoringIssue(
        'invalid_payload',
        'Once poses exceed the available canonical frames.',
        'payload.poses',
        `at most ${durationFrames + 1} poses`
      );
    }
    return Array.from(
      { length: poseCount },
      (_, index) =>
        Math.round(
          (index * durationFrames) / (poseCount - 1)
        )
    );
  }
  if (poseCount > durationFrames) {
    return motionAuthoringIssue(
      'invalid_payload',
      'Loop poses exceed the available non-closing frames.',
      'payload.poses',
      `at most ${durationFrames} poses`
    );
  }
  return [
    ...Array.from(
      { length: poseCount },
      (_, index) =>
        Math.round(
          (index * durationFrames) / poseCount
        )
    ),
    durationFrames
  ];
};

const channelIdFor = (
  clipId: string,
  partId: string
): string =>
  `animation:${clipId}:channel:${partId}:rotation`;

const keyIdFor = (
  clipId: string,
  partId: string,
  frame: number
): string =>
  `animation:${clipId}:key:${partId}:${frame}`;

export const channelForFrames = (
  clipId: string,
  part: CompiledPartState,
  frames: readonly number[],
  values: readonly Rotation[]
): TransformChannel => ({
  id: channelIdFor(clipId, part.partId),
  targetNodeId: compiledPartBoneId(part.partId),
  property: 'rotation',
  keys: frames.map((frame, index) => ({
    id: keyIdFor(clipId, part.partId, frame),
    timeSeconds: frame / MOTION_AUTHORING_FPS,
    value: values[index],
    interpolation: 'linear' as const
  }))
});

export const spinChannel = (
  clipId: string,
  durationFrames: number,
  part: CompiledPartState,
  turns: number,
  direction: 1 | -1
): TransformChannel => {
  const rotationAxis = axisIndex(
    part.joint.kind === 'hinge'
      ? part.joint.axis
      : 'x'
  );
  const frames = Array.from(
    { length: durationFrames + 1 },
    (_, frame) => frame
  );
  const values = frames.map((frame): Rotation => {
    const rotation: [number, number, number] = [0, 0, 0];
    rotation[rotationAxis] =
      frame === 0
        ? 0
        : direction *
          turns *
          360 *
          (frame / durationFrames);
    return rotation;
  });
  return channelForFrames(
    clipId,
    part,
    frames,
    values
  );
};
