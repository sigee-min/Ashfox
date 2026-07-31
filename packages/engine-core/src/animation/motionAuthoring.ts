import type {
  AnimationClip,
  ProjectDocument,
  TransformChannel
} from '../model';
import {
  readCompiledParts,
  type CompiledPartState
} from '../modeling/partInvariants';
import { compiledPartBoneId } from '../modeling/provenance';
import { resourceToken } from '../resourceToken';
import { compareStableText } from '../stableOrder';
import {
  countMotionKeys,
  MOTION_AUTHORING_LIMITS
} from './motionContract';
import type {
  AnimationMotionKeyInput,
  AnimationPartMotionInput,
  CommandPayloadMap
} from '../commands/types';

export const MOTION_AUTHORING_FPS = 20;

type Rotation = readonly [number, number, number];

export interface MotionAuthoringIssue {
  code: 'invalid_payload' | 'invalid_state';
  message: string;
  path: string;
  expected: string;
  pathScope?: 'document';
}

export type CompileAnimationMotionResult =
  | {
      ok: true;
      clip: AnimationClip;
      current: AnimationClip | undefined;
      removedTrackIds: readonly string[];
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

type ChannelBuildResult =
  | {
      ok: true;
      channel: TransformChannel;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

const issue = (
  code: MotionAuthoringIssue['code'],
  message: string,
  path: string,
  expected: string,
  pathScope?: MotionAuthoringIssue['pathScope']
): MotionAuthoringIssue => ({
  code,
  message,
  path,
  expected,
  ...(pathScope ? { pathScope } : {})
});

const zeroRotation = (): Rotation => [0, 0, 0];

const rotationsEqual = (
  left: Rotation,
  right: Rotation
): boolean =>
  left.every((value, index) => value === right[index]);

const isMotionIssue = (
  value: Rotation | MotionAuthoringIssue
): value is MotionAuthoringIssue =>
  !Array.isArray(value);

const rotationFor = (
  part: CompiledPartState,
  key: AnimationMotionKeyInput,
  keyPath: string,
  motionPath: string
): Rotation | MotionAuthoringIssue => {
  if (
    part.parentPartId !== null &&
    part.joint.kind === 'fixed'
  ) {
    return issue(
      'invalid_payload',
      `Fixed child part "${part.partId}" cannot be animated.`,
      `${motionPath}.partId`,
      'a hinge part, ball part, or the root part'
    );
  }
  if (part.joint.kind === 'hinge') {
    if (typeof key.rotationDegrees !== 'number') {
      return issue(
        'invalid_payload',
        `Hinge part "${part.partId}" requires one scalar angle.`,
        `${keyPath}.rotationDegrees`,
        `degree number around the ${part.joint.axis}-axis`
      );
    }
    const rotation: [number, number, number] = [0, 0, 0];
    const axisIndex = part.joint.axis === 'x'
      ? 0
      : part.joint.axis === 'y'
        ? 1
        : 2;
    rotation[axisIndex] = key.rotationDegrees;
    return rotation;
  }
  if (typeof key.rotationDegrees === 'number') {
    return issue(
      'invalid_payload',
      `Part "${part.partId}" requires an XYZ rotation vector.`,
      `${keyPath}.rotationDegrees`,
      'three degree numbers [x, y, z]'
    );
  }
  return key.rotationDegrees;
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

const buildMotionChannel = (
  clipId: string,
  durationSeconds: number,
  frameCount: number,
  loop: boolean,
  part: CompiledPartState,
  motion: AnimationPartMotionInput,
  motionIndex: number
): ChannelBuildResult => {
  const motionPath = `payload.motions[${motionIndex}]`;
  const valuesByFrame = new Map<number, Rotation>();
  const pathsByFrame = new Map<number, string>();
  for (const [keyIndex, key] of motion.keys.entries()) {
    const keyPath = `${motionPath}.keys[${keyIndex}]`;
    const rotation = rotationFor(
      part,
      key,
      keyPath,
      motionPath
    );
    if (isMotionIssue(rotation)) {
      return { ok: false, issue: rotation };
    }
    const frame = Math.round(key.phase * frameCount);
    if (valuesByFrame.has(frame)) {
      return {
        ok: false,
        issue: issue(
          'invalid_payload',
          `Motion keys for part "${part.partId}" ` +
            'collapse to the same sampled frame.',
          `${keyPath}.phase`,
          `phases separated by at least ${1 / frameCount}`
        )
      };
    }
    valuesByFrame.set(frame, rotation);
    pathsByFrame.set(frame, keyPath);
  }
  if (!valuesByFrame.has(0)) {
    valuesByFrame.set(0, zeroRotation());
  }
  if (loop) {
    const start = valuesByFrame.get(0) ?? zeroRotation();
    const closing = valuesByFrame.get(frameCount);
    if (closing && !rotationsEqual(start, closing)) {
      return {
        ok: false,
        issue: issue(
          'invalid_payload',
          `Loop motion for part "${part.partId}" has a closing ` +
            'rotation that differs from its opening rotation.',
          `${pathsByFrame.get(frameCount) ?? motionPath}.rotationDegrees`,
          'the phase 0 rotation, or omit the closing key to derive it'
        )
      };
    }
    valuesByFrame.set(frameCount, start);
  }

  return {
    ok: true,
    channel: {
      id: channelIdFor(clipId, part.partId),
      targetNodeId: compiledPartBoneId(part.partId),
      property: 'rotation',
      keys: [...valuesByFrame.entries()]
        .sort(([left], [right]) => left - right)
        .map(([frame, value]) => ({
          id: keyIdFor(clipId, part.partId, frame),
          timeSeconds:
            frame === frameCount
              ? durationSeconds
              : (frame / frameCount) * durationSeconds,
          value,
          interpolation: 'linear' as const
        }))
    }
  };
};

const animationName = (
  document: ProjectDocument,
  clipId: string,
  role: CommandPayloadMap[
    'animation.motion.upsert'
  ]['role']
): string => {
  const modelPath =
    'modelPath' in document.formatProfile
      ? document.formatProfile.modelPath
      : document.name;
  const model = resourceToken(
    modelPath.split('/').join('.'),
    'model'
  );
  const suffix =
    role === 'idle'
      ? 'idle'
      : resourceToken(clipId, 'clip');
  return `animation.${model}.${suffix}`;
};

const defaultIdleMotion = (
  parts: ReadonlyMap<string, CompiledPartState>
): readonly AnimationPartMotionInput[] | null => {
  const root = [...parts.values()]
    .filter((part) => part.parentPartId === null)
    .sort((left, right) =>
      compareStableText(left.partId, right.partId)
    )[0];
  return root
    ? [{
        partId: root.partId,
        keys: [{
          phase: 0,
          rotationDegrees: zeroRotation()
        }]
      }]
    : null;
};

type ResolveMotionsResult =
  | {
      ok: true;
      motions: readonly AnimationPartMotionInput[];
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

const resolveMotions = (
  parts: ReadonlyMap<string, CompiledPartState>,
  payload: CommandPayloadMap['animation.motion.upsert']
): ResolveMotionsResult => {
  const requested = payload.motions ?? [];
  const duplicatePartId = requested
    .map((motion) => motion.partId)
    .find((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicatePartId) {
    return {
      ok: false,
      issue: issue(
        'invalid_payload',
        `Part "${duplicatePartId}" has more than one motion entry.`,
        'payload.motions',
        'one complete motion entry per part'
      )
    };
  }
  if (requested.length > 0) {
    return { ok: true, motions: requested };
  }
  if (payload.role !== 'idle') {
    return {
      ok: false,
      issue: issue(
        'invalid_payload',
        'Loop and one-shot clips require at least one part motion.',
        'payload.motions',
        'one or more part motions'
      )
    };
  }
  const idle = defaultIdleMotion(parts);
  return idle
    ? { ok: true, motions: idle }
    : {
        ok: false,
        issue: issue(
          'invalid_state',
          'A static idle requires one compiled root part.',
          'modeling',
          'one compiled root part',
          'document'
        )
      };
};

type BuildChannelsResult =
  | {
      ok: true;
      channels: readonly TransformChannel[];
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

const buildMotionChannels = (
  parts: ReadonlyMap<string, CompiledPartState>,
  payload: CommandPayloadMap['animation.motion.upsert'],
  motions: readonly AnimationPartMotionInput[],
  durationSeconds: number,
  frameCount: number,
  loops: boolean
): BuildChannelsResult => {
  const channels: TransformChannel[] = [];
  for (const [motionIndex, motion] of motions.entries()) {
    const part = parts.get(motion.partId);
    if (!part) {
      return {
        ok: false,
        issue: issue(
          'invalid_payload',
          `Part "${motion.partId}" does not exist in the compiled rig.`,
          `payload.motions[${motionIndex}].partId`,
          'an existing compiled part ID'
        )
      };
    }
    const built = buildMotionChannel(
      payload.clipId,
      durationSeconds,
      frameCount,
      loops,
      part,
      motion,
      motionIndex
    );
    if (!built.ok) return built;
    channels.push(built.channel);
  }
  return {
    ok: true,
    channels: channels.sort((left, right) =>
      compareStableText(left.id, right.id)
    )
  };
};

const conflictingNameIssue = (
  document: ProjectDocument,
  clipId: string,
  name: string
): MotionAuthoringIssue | null => {
  const conflict = Object.values(document.animations).find(
    (clip) => clip.id !== clipId && clip.name === name
  );
  return conflict
    ? issue(
        'invalid_state',
        `Animation name "${name}" is already owned by clip ` +
          `"${conflict.id}".`,
        'payload.clipId',
        `reuse clip ID "${conflict.id}"`
      )
    : null;
};

const identityIssue = (
  payload: CommandPayloadMap['animation.motion.upsert']
): MotionAuthoringIssue | null => {
  if (
    payload.role === 'idle' &&
    payload.clipId !== 'idle'
  ) {
    return issue(
      'invalid_payload',
      'The canonical idle role requires clip ID "idle".',
      'payload.clipId',
      'idle'
    );
  }
  if (
    payload.role !== 'idle' &&
    (
      payload.clipId === 'idle' ||
      payload.clipId.endsWith('.idle')
    )
  ) {
    return issue(
      'invalid_payload',
      `Clip ID "${payload.clipId}" is reserved for the idle role.`,
      'payload.clipId',
      'a non-idle ID that does not end in ".idle"'
    );
  }
  return null;
};

const motionBudgetIssue = (
  payload: CommandPayloadMap['animation.motion.upsert']
): MotionAuthoringIssue | null => {
  const keyCount = countMotionKeys(payload.motions);
  return keyCount > MOTION_AUTHORING_LIMITS.maxKeysPerOperation
    ? issue(
        'invalid_payload',
        `Animation motion contains ${keyCount} keys, exceeding the ` +
          `${MOTION_AUTHORING_LIMITS.maxKeysPerOperation}-key operation budget.`,
        'payload.motions',
        `at most ${MOTION_AUTHORING_LIMITS.maxKeysPerOperation} total keys`
      )
    : null;
};

const advancedClipField = (
  clip: AnimationClip
):
  | 'startDelay'
  | 'loopDelay'
  | 'animationTimeUpdate'
  | 'blendWeight'
  | 'overridePreviousAnimation'
  | null =>
  clip.startDelay !== undefined
    ? 'startDelay'
    : clip.loopDelay !== undefined
      ? 'loopDelay'
      : clip.animationTimeUpdate !== undefined
        ? 'animationTimeUpdate'
        : clip.blendWeight !== undefined
          ? 'blendWeight'
          : clip.overridePreviousAnimation !== undefined
            ? 'overridePreviousAnimation'
            : null;

const advancedReplacementIssue = (
  clip: AnimationClip | undefined
): MotionAuthoringIssue | null => {
  if (!clip) return null;
  const clipPath = `animations.${clip.id}`;
  if (Object.keys(clip.triggers).length > 0) {
    return issue(
      'invalid_state',
      `Clip "${clip.id}" has trigger tracks that complete motion ` +
        'replacement must not discard implicitly.',
      `${clipPath}.triggers`,
      'delete then recreate the clip in the same atomic batch',
      'document'
    );
  }
  const field = advancedClipField(clip);
  if (field) {
    return issue(
      'invalid_state',
      `Clip "${clip.id}" has advanced field "${field}" that complete ` +
        'motion replacement must not discard implicitly.',
      `${clipPath}.${field}`,
      'delete then recreate the clip in the same atomic batch',
      'document'
    );
  }
  for (const [channelId, channel] of Object.entries(
    clip.channels
  )) {
    const channelPath = `${clipPath}.channels.${channelId}`;
    if (
      channel.property !== 'rotation' ||
      channel.rotationSpace !== undefined
    ) {
      return issue(
        'invalid_state',
        `Clip "${clip.id}" has an advanced transform channel that ` +
          'complete motion replacement must not discard implicitly.',
        channelPath,
        'delete then recreate the clip in the same atomic batch',
        'document'
      );
    }
    const advancedKeyIndex = channel.keys.findIndex(
      (key) =>
        key.interpolation !== 'linear' ||
        key.preValue !== undefined ||
        key.postValue !== undefined ||
        key.easing !== undefined ||
        key.value.some((component) =>
          typeof component !== 'number'
        )
    );
    if (advancedKeyIndex >= 0) {
      return issue(
        'invalid_state',
        `Clip "${clip.id}" has an advanced transform key that complete ` +
          'motion replacement must not discard implicitly.',
        `${channelPath}.keys[${advancedKeyIndex}]`,
        'delete then recreate the clip in the same atomic batch',
        'document'
      );
    }
  }
  return null;
};

export const compileAnimationMotion = (
  document: ProjectDocument,
  payload: CommandPayloadMap['animation.motion.upsert']
): CompileAnimationMotionResult => {
  const contractIssue =
    identityIssue(payload) ??
    motionBudgetIssue(payload) ??
    advancedReplacementIssue(
      document.animations[payload.clipId]
    );
  if (contractIssue) {
    return { ok: false, issue: contractIssue };
  }
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    return {
      ok: false,
      issue: issue(
        'invalid_state',
        compiled.issues[0]?.message ??
          'The compiled part rig is unavailable.',
        compiled.issues[0]?.path ?? 'modeling',
        'a valid compiled part rig',
        'document'
      )
    };
  }

  const resolved = resolveMotions(compiled.parts, payload);
  if (!resolved.ok) return resolved;
  const durationSeconds = payload.durationSeconds ?? 1;
  const frameCount = Math.max(
    1,
    Math.round(durationSeconds * MOTION_AUTHORING_FPS)
  );
  const loops =
    payload.role === 'idle' ||
    payload.role === 'loop';
  const built = buildMotionChannels(
    compiled.parts,
    payload,
    resolved.motions,
    durationSeconds,
    frameCount,
    loops
  );
  if (!built.ok) return built;

  const name = animationName(
    document,
    payload.clipId,
    payload.role
  );
  const nameIssue = conflictingNameIssue(
    document,
    payload.clipId,
    name
  );
  if (nameIssue) return { ok: false, issue: nameIssue };

  const current = document.animations[payload.clipId];
  const clip: AnimationClip = {
    id: payload.clipId,
    name,
    durationSeconds,
    fps: MOTION_AUTHORING_FPS,
    loop: loops ? 'loop' : 'once',
    channels: Object.fromEntries(
      built.channels.map((channel) => [
        channel.id,
        channel
      ])
    ),
    triggers: {}
  };
  const nextChannelIds = new Set(
    Object.keys(clip.channels)
  );
  return {
    ok: true,
    clip,
    current,
    removedTrackIds: current
      ? [
          ...Object.keys(current.channels).filter(
            (id) => !nextChannelIds.has(id)
          ),
          ...Object.keys(current.triggers)
        ]
      : []
  };
};

export const compileCanonicalStaticIdle = (
  document: ProjectDocument
): CompileAnimationMotionResult =>
  compileAnimationMotion(document, {
    clipId: 'idle',
    role: 'idle'
  });
