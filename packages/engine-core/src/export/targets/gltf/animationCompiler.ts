import type {
  AnimationClip,
  AnimationScalar,
  AnimationVec3,
  ProjectDocument,
  TransformChannel,
  Vec3
} from '../../../model';
import { GltfBinaryWriter } from './binaryWriter';
import type { GltfAnimation } from './types';

interface SampledChannel {
  times: number[];
  values: AnimationVec3[];
  interpolation: 'LINEAR' | 'STEP';
}

export interface GltfAnimationCompileOptions {
  writer: GltfBinaryWriter;
  nodeIndexById: ReadonlyMap<string, number>;
  restTranslationById: ReadonlyMap<string, [number, number, number]>;
  restRotationById: ReadonlyMap<string, [number, number, number]>;
  restScaleById: ReadonlyMap<string, [number, number, number]>;
  unitScale: number;
}

const numeric = (value: AnimationScalar): number => {
  if (typeof value !== 'number') {
    throw new Error('glTF animation compilation requires numeric keyframe values.');
  }
  return value;
};

const quaternionFromEuler = (
  rotation: Vec3
): [number, number, number, number] => {
  const x = (rotation[0] * Math.PI) / 360;
  const y = (rotation[1] * Math.PI) / 360;
  const z = (rotation[2] * Math.PI) / 360;
  const sx = Math.sin(x);
  const cx = Math.cos(x);
  const sy = Math.sin(y);
  const cy = Math.cos(y);
  const sz = Math.sin(z);
  const cz = Math.cos(z);
  return [
    sx * cy * cz + cx * sy * sz,
    cx * sy * cz - sx * cy * sz,
    cx * cy * sz + sx * sy * cz,
    cx * cy * cz - sx * sy * sz
  ];
};

const multiplyQuaternions = (
  left: readonly [number, number, number, number],
  right: readonly [number, number, number, number]
): [number, number, number, number] => {
  const [lx, ly, lz, lw] = left;
  const [rx, ry, rz, rw] = right;
  const result: [number, number, number, number] = [
    lw * rx + lx * rw + ly * rz - lz * ry,
    lw * ry - lx * rz + ly * rw + lz * rx,
    lw * rz + lx * ry - ly * rx + lz * rw,
    lw * rw - lx * rx - ly * ry - lz * rz
  ];
  const length = Math.hypot(...result);
  return length <= 0.000001
    ? [0, 0, 0, 1]
    : result.map((value) => value / length) as [
        number,
        number,
        number,
        number
      ];
};

const compileValues = (
  channel: TransformChannel,
  values: readonly AnimationVec3[],
  options: GltfAnimationCompileOptions
): { values: number[]; componentCount: 3 | 4 } => {
  if (channel.property === 'rotation') {
    const rest = options.restRotationById.get(channel.targetNodeId) ?? [0, 0, 0];
    const restQuaternion = quaternionFromEuler(rest);
    const quaternions = values.map((value) =>
      multiplyQuaternions(
        restQuaternion,
        quaternionFromEuler([
          numeric(value[0]),
          numeric(value[1]),
          numeric(value[2])
        ])
      )
    );
    for (let index = 1; index < quaternions.length; index += 1) {
      const previous = quaternions[index - 1];
      const current = quaternions[index];
      const dot = previous.reduce(
        (sum, component, componentIndex) =>
          sum + component * current[componentIndex],
        0
      );
      if (dot < 0) {
        quaternions[index] = current.map((component) => -component) as [
          number,
          number,
          number,
          number
        ];
      }
    }
    return {
      values: quaternions.flatMap((quaternion) => quaternion),
      componentCount: 4
    };
  }
  if (channel.property === 'position') {
    const rest = options.restTranslationById.get(channel.targetNodeId) ?? [0, 0, 0];
    return {
      values: values.flatMap((value) => [
        rest[0] + numeric(value[0]) * options.unitScale,
        rest[1] + numeric(value[1]) * options.unitScale,
        rest[2] + numeric(value[2]) * options.unitScale
      ]),
      componentCount: 3
    };
  }
  const rest = options.restScaleById.get(channel.targetNodeId) ?? [1, 1, 1];
  return {
    values: values.flatMap((value) => [
      rest[0] * numeric(value[0]),
      rest[1] * numeric(value[1]),
      rest[2] * numeric(value[2])
    ]),
    componentCount: 3
  };
};

const catmullRomScalar = (
  previous: AnimationScalar,
  start: AnimationScalar,
  end: AnimationScalar,
  next: AnimationScalar,
  progress: number
): number => {
  const p0 = numeric(previous);
  const p1 = numeric(start);
  const p2 = numeric(end);
  const p3 = numeric(next);
  const squared = progress * progress;
  const cubed = squared * progress;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * progress +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * squared +
    (-p0 + 3 * p1 - 3 * p2 + p3) * cubed
  );
};

const interpolateCatmullRom = (
  previous: AnimationVec3,
  start: AnimationVec3,
  end: AnimationVec3,
  next: AnimationVec3,
  progress: number
): AnimationVec3 => [
  catmullRomScalar(
    previous[0],
    start[0],
    end[0],
    next[0],
    progress
  ),
  catmullRomScalar(
    previous[1],
    start[1],
    end[1],
    next[1],
    progress
  ),
  catmullRomScalar(
    previous[2],
    start[2],
    end[2],
    next[2],
    progress
  )
];

const roundedTime = (value: number): number =>
  Math.round(value * 1_000_000) / 1_000_000;

const bakeCatmullRom = (
  channel: TransformChannel,
  clip: AnimationClip,
  restValue: AnimationVec3
): SampledChannel => {
  const source = [
    ...(channel.keys[0].timeSeconds > 0.000001
      ? [{ timeSeconds: 0, value: restValue }]
      : []),
    ...channel.keys.map((key) => ({
      timeSeconds: roundedTime(key.timeSeconds),
      value: key.value
    }))
  ];
  const finalSource = source[source.length - 1];
  if (finalSource.timeSeconds < clip.durationSeconds - 0.000001) {
    source.push({
      timeSeconds: roundedTime(clip.durationSeconds),
      value: finalSource.value
    });
  }
  const frameCount = Math.ceil(clip.durationSeconds * clip.fps);
  const times = [
    ...new Set([
      ...source.map((key) => key.timeSeconds),
      ...Array.from(
        { length: frameCount + 1 },
        (_, index) => roundedTime(
          Math.min(index / clip.fps, clip.durationSeconds)
        )
      ),
      roundedTime(clip.durationSeconds)
    ])
  ].sort((left, right) => left - right);
  const last = source[source.length - 1];
  const values = times.map((time) => {
    if (time <= source[0].timeSeconds + 0.000001) {
      return source[0].value;
    }
    const endIndex = source.findIndex(
      (key) => key.timeSeconds >= time - 0.000001
    );
    if (endIndex <= 0) return last.value;
    const startIndex = endIndex - 1;
    const start = source[startIndex];
    const end = source[endIndex];
    if (Math.abs(time - end.timeSeconds) <= 0.000001) {
      return end.value;
    }
    const duration = end.timeSeconds - start.timeSeconds;
    const progress = duration <= 0
      ? 0
      : (time - start.timeSeconds) / duration;
    return interpolateCatmullRom(
      source[Math.max(0, startIndex - 1)].value,
      start.value,
      end.value,
      source[Math.min(source.length - 1, endIndex + 1)].value,
      progress
    );
  });
  return {
    times,
    values,
    interpolation: 'LINEAR'
  };
};

const sampleChannel = (
  channel: TransformChannel,
  clip: AnimationClip
): SampledChannel => {
  const interpolation = channel.keys[0].interpolation;
  const restValue: AnimationVec3 =
    channel.property === 'scale'
      ? [1, 1, 1]
      : [0, 0, 0];
  if (interpolation === 'catmullrom') {
    return bakeCatmullRom(channel, clip, restValue);
  }
  const lastKey = channel.keys[channel.keys.length - 1];
  return {
    times: [
      ...(channel.keys[0].timeSeconds > 0.000001 ? [0] : []),
      ...channel.keys.map((keyframe) => keyframe.timeSeconds),
      ...(lastKey.timeSeconds < clip.durationSeconds - 0.000001
        ? [clip.durationSeconds]
        : [])
    ],
    values: [
      ...(channel.keys[0].timeSeconds > 0.000001 ? [restValue] : []),
      ...channel.keys.map((keyframe) => keyframe.value),
      ...(lastKey.timeSeconds < clip.durationSeconds - 0.000001
        ? [lastKey.value]
        : [])
    ],
    interpolation: interpolation === 'step' ? 'STEP' : 'LINEAR'
  };
};

export const compileGltfAnimations = (
  document: ProjectDocument,
  options: GltfAnimationCompileOptions
): GltfAnimation[] => {
  const animations: GltfAnimation[] = [];
  for (const clip of Object.values(document.animations).sort((left, right) =>
    left.id.localeCompare(right.id)
  )) {
    if (
      Object.keys(clip.triggers).length > 0 ||
      clip.startDelay ||
      clip.loopDelay ||
      clip.animationTimeUpdate ||
      clip.blendWeight !== undefined ||
      clip.overridePreviousAnimation !== undefined
    ) {
      throw new Error(
        'glTF core animation cannot compile Minecraft timing expressions or effect tracks.'
      );
    }
    const animation: GltfAnimation = {
      name: clip.name,
      samplers: [],
      channels: [],
      extras: {
        ashfoxLoop: clip.loop,
        ashfoxDurationSeconds: clip.durationSeconds,
        ashfoxFps: clip.fps
      }
    };
    for (const channel of Object.values(clip.channels).sort((left, right) =>
      left.id.localeCompare(right.id)
    )) {
      if (channel.keys.length === 0) continue;
      if (channel.rotationSpace === 'entity') {
        throw new Error(
          'glTF animation cannot compile entity-relative Minecraft rotation.'
        );
      }
      const interpolation = channel.keys[0].interpolation;
      if (
        channel.keys.some(
          (keyframe) =>
            keyframe.interpolation !== interpolation ||
            keyframe.preValue !== undefined ||
            keyframe.postValue !== undefined ||
            keyframe.easing !== undefined
        )
      ) {
        throw new Error(
          'glTF channels require uniform LINEAR or STEP keys without Minecraft envelopes.'
        );
      }
      const node = options.nodeIndexById.get(channel.targetNodeId);
      if (node === undefined) continue;
      const sampled = sampleChannel(channel, clip);
      const input = options.writer.addFloatAccessor(
        sampled.times,
        1,
        true
      );
      const compiled = compileValues(channel, sampled.values, options);
      const output = options.writer.addFloatAccessor(
        compiled.values,
        compiled.componentCount,
        false
      );
      const sampler = animation.samplers.length;
      animation.samplers.push({
        input,
        output,
        interpolation: sampled.interpolation
      });
      animation.channels.push({
        sampler,
        target: {
          node,
          path:
            channel.property === 'position'
              ? 'translation'
              : channel.property
        }
      });
    }
    if (animation.channels.length > 0) animations.push(animation);
  }
  return animations;
};
