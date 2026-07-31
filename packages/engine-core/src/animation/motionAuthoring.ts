import type {
  AnimationClip,
  AnimationTriggerTrack,
  ProjectDocument,
  TransformChannel
} from '../model';
import { compiledPartBoneId } from '../modeling/provenance';
import { resourceToken } from '../resourceToken';
import { compareStableText } from '../stableOrder';
import {
  MOTION_AUTHORING_FPS,
  MOTION_AUTHORING_LIMITS,
  motionAuthoringIssue,
  type AnimationMotionUpsertInput,
  type ResolvedAnimationMotionInput,
  type MotionAuthoringIssue
} from './motionContract';
import {
  compileMotionTracks
} from './motionPoseCompiler';
import {
  CANONICAL_IDLE_CLIP_ID,
  idleClipNumericallyCloses
} from './idleContract';
import {
  transformChannelClosesLoop
} from './loopClosure';

export { MOTION_AUTHORING_FPS };

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

const animationName = (
  document: ProjectDocument,
  clipId: string,
  role: ResolvedAnimationMotionInput['role']
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

interface ResolvedMotionRequest {
  payload: ResolvedAnimationMotionInput;
  name: string;
  durationSeconds: number;
  fps: number;
  loop: AnimationClip['loop'];
  roleSpecified: boolean;
  durationSpecified: boolean;
}

type ResolveMotionRequestResult =
  | {
      ok: true;
      value: ResolvedMotionRequest;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

const existingMotionRole = (
  clip: AnimationClip
): ResolvedAnimationMotionInput['role'] =>
  clip.loop !== 'loop'
    ? 'once'
    : clip.id === CANONICAL_IDLE_CLIP_ID
      ? 'idle'
      : 'loop';

const resolveMotionRequest = (
  document: ProjectDocument,
  input: AnimationMotionUpsertInput,
  current: AnimationClip | undefined
): ResolveMotionRequestResult => {
  if (!current && input.role === undefined) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        'A new animation clip requires an explicit role.',
        'payload.role',
        'idle | loop | once'
      )
    };
  }
  if (!current && input.durationFrames === undefined) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        'A new animation clip requires an explicit duration.',
        'payload.durationFrames',
        `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`
      )
    };
  }
  if (
    current &&
    input.durationFrames === undefined &&
    current.fps !== MOTION_AUTHORING_FPS
  ) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_state',
        `Clip "${current.id}" uses ${current.fps} FPS instead of the canonical 20 FPS grid.`,
        `animations.${current.id}.fps`,
        'an explicit durationFrames to retime this clip at 20 FPS',
        'document'
      )
    };
  }

  const role = input.role ?? existingMotionRole(current!);
  const inferredFrames = current
    ? current.durationSeconds * MOTION_AUTHORING_FPS
    : Number.NaN;
  const durationFrames =
    input.durationFrames ?? inferredFrames;
  if (
    !Number.isSafeInteger(durationFrames) ||
    durationFrames < 1 ||
    durationFrames > MOTION_AUTHORING_LIMITS.maxDurationFrames
  ) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        current && input.durationFrames === undefined
          ? 'invalid_state'
          : 'invalid_payload',
        current && input.durationFrames === undefined
          ? `Clip "${current.id}" is not aligned to the canonical 20 FPS frame grid.`
          : 'Animation duration must use the canonical frame grid.',
        current && input.durationFrames === undefined
          ? `animations.${current.id}.durationSeconds`
          : 'payload.durationFrames',
        current && input.durationFrames === undefined
          ? 'an explicit durationFrames to retime this clip'
          : `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`,
        current && input.durationFrames === undefined
          ? 'document'
          : undefined
      )
    };
  }

  const roleSpecified = input.role !== undefined;
  const durationSpecified = input.durationFrames !== undefined;
  return {
    ok: true,
    value: {
      payload: {
        ...input,
        role,
        durationFrames
      },
      name:
        current && !roleSpecified
          ? current.name
          : animationName(document, input.clipId, role),
      durationSeconds:
        current && !durationSpecified
          ? current.durationSeconds
          : durationFrames / MOTION_AUTHORING_FPS,
      fps:
        current && !durationSpecified
          ? current.fps
          : MOTION_AUTHORING_FPS,
      loop:
        current && !roleSpecified
          ? current.loop
          : role === 'once'
            ? 'once'
            : 'loop',
      roleSpecified,
      durationSpecified
    }
  };
};

const identityIssue = (
  payload: ResolvedAnimationMotionInput
): MotionAuthoringIssue | null => {
  if (
    payload.role === 'idle' &&
    payload.clipId !== 'idle'
  ) {
    return motionAuthoringIssue(
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
    return motionAuthoringIssue(
      'invalid_payload',
      `Clip ID "${payload.clipId}" is reserved for the idle role.`,
      'payload.clipId',
      'a non-idle ID that does not end in ".idle"'
    );
  }
  return null;
};

const payloadPolicyIssue = (
  payload: ResolvedAnimationMotionInput
): MotionAuthoringIssue | null => {
  if (
    !Number.isSafeInteger(payload.durationFrames) ||
    payload.durationFrames < 1 ||
    payload.durationFrames >
      MOTION_AUTHORING_LIMITS.maxDurationFrames
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      'Animation duration must use the canonical frame grid.',
      'payload.durationFrames',
      `a whole frame count from 1 to ${MOTION_AUTHORING_LIMITS.maxDurationFrames}`
    );
  }
  if (payload.static && payload.role !== 'idle') {
    return motionAuthoringIssue(
      'invalid_payload',
      'Only the canonical idle clip may be explicitly static.',
      'payload.static',
      'omit static, or use role "idle"'
    );
  }
  if (
    payload.static &&
    (
      (payload.poses?.length ?? 0) > 0 ||
      (payload.spins?.length ?? 0) > 0
    )
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      'A static idle cannot also author poses or spins.',
      'payload.static',
      'static: true without poses or spins'
    );
  }
  if (
    payload.role === 'idle' &&
    (payload.spins?.length ?? 0) > 0
  ) {
    return motionAuthoringIssue(
      'invalid_payload',
      'The canonical idle must close numerically and cannot contain continuous spins.',
      'payload.spins',
      'pose motion for idle, or a separate loop clip for spins'
    );
  }
  const duplicateRemoval = (payload.removePartIds ?? [])
    .find((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateRemoval) {
    return motionAuthoringIssue(
      'invalid_payload',
      `Part "${duplicateRemoval}" is removed more than once.`,
      'payload.removePartIds',
      'unique part IDs'
    );
  }
  return null;
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
    ? motionAuthoringIssue(
        'invalid_state',
        `Animation name "${name}" is already owned by clip ` +
          `"${conflict.id}".`,
        'payload.clipId',
        `reuse clip ID "${conflict.id}"`
      )
    : null;
};

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
      Math.round(
        timeSeconds * scale * MOTION_AUTHORING_FPS
      )
    )
  );
  return frame === durationFrames
    ? durationSeconds
    : frame / MOTION_AUTHORING_FPS;
};

const scaledFramePosition = (
  timeSeconds: number,
  scale: number,
  durationSeconds: number
): number =>
  Math.min(
    durationSeconds * MOTION_AUTHORING_FPS,
    Math.max(
      0,
      timeSeconds * scale * MOTION_AUTHORING_FPS
    )
  );

const isCanonicalFramePosition = (
  frame: number
): boolean =>
  Math.abs(frame - Math.round(frame)) <= 0.000001;

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
  switch (trigger.type) {
    case 'sound':
      return {
        ...trigger,
        keys: trigger.keys.map((key) => ({
          ...key,
          timeSeconds: scaledFrameTime(
            key.timeSeconds,
            scale,
            durationSeconds
          )
        }))
      };
    case 'particle':
      return {
        ...trigger,
        keys: trigger.keys.map((key) => ({
          ...key,
          timeSeconds: scaledFrameTime(
            key.timeSeconds,
            scale,
            durationSeconds
          )
        }))
      };
    case 'timeline':
      return {
        ...trigger,
        keys: trigger.keys.map((key) => ({
          ...key,
          timeSeconds: scaledFrameTime(
            key.timeSeconds,
            scale,
            durationSeconds
          )
        }))
      };
  }
};

const patchedChannels = (
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[],
  removePartIds: readonly string[],
  durationSeconds: number,
  canonicalizeTiming: boolean
): Readonly<Record<string, TransformChannel>> => {
  const authoredTargets = new Set(
    authored.map((channel) => channel.targetNodeId)
  );
  const removedTargets = new Set(
    removePartIds.map(compiledPartBoneId)
  );
  const scale =
    current && current.durationSeconds > 0
      ? durationSeconds / current.durationSeconds
      : 1;
  const preserved = Object.values(
    current?.channels ?? {}
  ).filter(
    (channel) =>
      !(
        channel.property === 'rotation' &&
        (
          authoredTargets.has(channel.targetNodeId) ||
          removedTargets.has(channel.targetNodeId)
        )
      )
  ).map((channel) =>
    scaleChannelTime(
      channel,
      scale,
      durationSeconds,
      canonicalizeTiming
    )
  );
  return Object.fromEntries(
    [...preserved, ...authored]
      .sort((left, right) =>
        compareStableText(left.id, right.id)
      )
      .map((channel) => [channel.id, channel])
  );
};

const patchedTriggers = (
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
      .sort((left, right) =>
        compareStableText(left.id, right.id)
      )
      .map((trigger) => [trigger.id, trigger])
  );
};

const preservedTimingIssue = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[]
): MotionAuthoringIssue | null => {
  if (!current || !request.durationSpecified) return null;
  const authoredTargets = new Set(
    authored.map((channel) => channel.targetNodeId)
  );
  const removedTargets = new Set(
    (request.payload.removePartIds ?? []).map(
      compiledPartBoneId
    )
  );
  const scale = request.durationSeconds /
    current.durationSeconds;
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

const valueSignature = (
  value: TransformChannel['keys'][number]['value']
): string =>
  JSON.stringify(value);

const channelMoves = (
  channel: TransformChannel
): boolean => {
  if (channel.keys.length < 2) return false;
  const opening = valueSignature(channel.keys[0].value);
  return channel.keys.some(
    (key) => valueSignature(key.value) !== opening
  );
};

const clipMoves = (
  channels: AnimationClip['channels']
): boolean =>
  Object.values(channels).some(channelMoves);

const loopClosureIssue = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  clip: AnimationClip
): MotionAuthoringIssue | null => {
  if (clip.loop !== 'loop') return null;
  const unclosed = Object.values(clip.channels).find(
    (channel) => !transformChannelClosesLoop(
      channel,
      clip.durationSeconds
    )
  );
  return unclosed
    ? motionAuthoringIssue(
        'invalid_payload',
        `Resulting loop clip "${clip.id}" preserves an open ` +
          `${unclosed.property} track for ` +
          `"${unclosed.targetNodeId}".`,
        current &&
          current.loop !== 'loop' &&
          request.roleSpecified
          ? 'payload.role'
          : 'payload.poses',
        'a closed transform track at the requested duration, or role "once"'
      )
    : null;
};

const canonicalIdleIssue = (
  clip: AnimationClip
): MotionAuthoringIssue | null => {
  if (clip.id !== CANONICAL_IDLE_CLIP_ID) return null;
  return idleClipNumericallyCloses(clip)
    ? null
    : motionAuthoringIssue(
        'invalid_payload',
        'The resulting canonical idle must be a numerically closed loop on every transform channel.',
        'payload.poses',
        'exactly matching numeric opening and closing transforms, or static: true'
      );
};

const movementIssue = (
  payload: ResolvedAnimationMotionInput,
  channels: AnimationClip['channels']
): MotionAuthoringIssue | null => {
  const moves = clipMoves(channels);
  if (payload.static && moves) {
    return motionAuthoringIssue(
      'invalid_state',
      'The resulting idle still contains moving tracks.',
      'payload.removePartIds',
      'remove every moving part track, or omit static',
      'document'
    );
  }
  if (!payload.static && !moves) {
    return motionAuthoringIssue(
      'invalid_payload',
      `${payload.role} motion must contain at least two distinct poses.`,
      'payload.poses',
      payload.role === 'idle'
        ? 'actual idle movement, or static: true'
        : 'actual pose movement or a spin'
    );
  }
  return null;
};

const removalIssue = (
  current: AnimationClip | undefined,
  payload: AnimationMotionUpsertInput
): MotionAuthoringIssue | null => {
  const channels = Object.values(current?.channels ?? {});
  for (const [
    index,
    partId
  ] of (payload.removePartIds ?? []).entries()) {
    const targetNodeId = compiledPartBoneId(partId);
    const exists = channels.some(
      (channel) =>
        channel.property === 'rotation' &&
        channel.targetNodeId === targetNodeId
    );
    if (!exists) {
      return motionAuthoringIssue(
        'invalid_payload',
        `Clip "${payload.clipId}" has no rotation track for part "${partId}".`,
        `payload.removePartIds[${index}]`,
        'a part ID with an existing rotation track in this clip'
      );
    }
  }
  return null;
};

const buildClip = (
  request: ResolvedMotionRequest,
  current: AnimationClip | undefined,
  authored: readonly TransformChannel[]
): AnimationClip => {
  const { payload } = request;
  return {
    ...(current ?? {}),
    id: payload.clipId,
    name: request.name,
    durationSeconds: request.durationSeconds,
    fps: request.fps,
    loop: request.loop,
    channels: patchedChannels(
      current,
      authored,
      payload.removePartIds ?? [],
      request.durationSeconds,
      request.durationSpecified
    ),
    triggers: patchedTriggers(
      current,
      request.durationSeconds,
      request.durationSpecified
    )
  };
};

export const compileAnimationMotion = (
  document: ProjectDocument,
  input: AnimationMotionUpsertInput
): CompileAnimationMotionResult => {
  const current = document.animations[input.clipId];
  const resolved = resolveMotionRequest(
    document,
    input,
    current
  );
  if (!resolved.ok) return resolved;
  const request = resolved.value;
  const { payload } = request;
  const contractIssue =
    identityIssue(payload) ??
    payloadPolicyIssue(payload);
  if (contractIssue) {
    return { ok: false, issue: contractIssue };
  }
  const invalidRemoval = removalIssue(current, payload);
  if (invalidRemoval) {
    return { ok: false, issue: invalidRemoval };
  }
  const hasAuthoredTracks =
    payload.static === true ||
    (payload.poses?.length ?? 0) > 0 ||
    (payload.spins?.length ?? 0) > 0;
  const hasRemoval =
    (payload.removePartIds?.length ?? 0) > 0;
  const durationChanges =
    current !== undefined &&
    request.durationSpecified &&
    (
      current.durationSeconds !== request.durationSeconds ||
      current.fps !== request.fps
    );
  const roleChanges =
    current !== undefined &&
    request.roleSpecified &&
    (
      current.loop !== request.loop ||
      current.name !== request.name
    );
  if (
    current !== undefined &&
    !hasAuthoredTracks &&
    !hasRemoval &&
    !durationChanges &&
    !roleChanges
  ) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        'Motion patch does not change any track, role, or timing.',
        'payload',
        'poses, spins, removePartIds, static: true, a changed role, or changed durationFrames'
      )
    };
  }

  const compiled = compileMotionTracks(document, payload);
  if (!compiled.ok) return compiled;
  const invalidPreservedTiming = preservedTimingIssue(
    request,
    current,
    compiled.value.channels
  );
  if (invalidPreservedTiming) {
    return { ok: false, issue: invalidPreservedTiming };
  }
  const nameIssue = conflictingNameIssue(
    document,
    payload.clipId,
    request.name
  );
  if (nameIssue) return { ok: false, issue: nameIssue };

  const clip = buildClip(
    request,
    current,
    compiled.value.channels
  );
  const invalidLoop = loopClosureIssue(
    request,
    current,
    clip
  );
  if (invalidLoop) {
    return { ok: false, issue: invalidLoop };
  }
  const finalIdleIssue = canonicalIdleIssue(clip);
  if (finalIdleIssue) {
    return { ok: false, issue: finalIdleIssue };
  }
  const finalMovementIssue = movementIssue(
    payload,
    clip.channels
  );
  if (finalMovementIssue) {
    return { ok: false, issue: finalMovementIssue };
  }
  const nextChannelIds = new Set(
    Object.keys(clip.channels)
  );
  return {
    ok: true,
    clip,
    current,
    removedTrackIds: current
      ? Object.keys(current.channels).filter(
          (id) => !nextChannelIds.has(id)
        )
      : []
  };
};

export const compileCanonicalStaticIdle = (
  document: ProjectDocument
): CompileAnimationMotionResult =>
  compileAnimationMotion(document, {
    clipId: 'idle',
    role: 'idle',
    durationFrames: MOTION_AUTHORING_FPS,
    static: true
  });
