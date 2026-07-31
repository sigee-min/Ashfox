import type {
  ProjectDocument,
  TransformChannel
} from '../model';
import {
  readCompiledParts,
  type CompiledPartState
} from '../modeling/partInvariants';
import {
  isPartId
} from '../modeling/partContract';
import { compareStableText } from '../stableOrder';
import {
  MOTION_AUTHORING_LIMITS,
  motionAuthoringIssue,
  type ResolvedAnimationMotionInput,
  type MotionAuthoringIssue
} from './motionContract';
import {
  channelForFrames,
  isMotionIssue,
  poseFrames,
  rotationForPart,
  spinChannel,
  unwrapSequence,
  zeroRotation,
  type Rotation
} from './motionFrames';

interface PartRotationSequence {
  part: CompiledPartState;
  values: readonly Rotation[];
}

interface ResolvedSpin {
  part: CompiledPartState;
  turns: number;
  direction: 1 | -1;
}

export interface CompiledMotionTracks {
  channels: readonly TransformChannel[];
  affectedPartIds: readonly string[];
}

export type CompileMotionTracksResult =
  | {
      ok: true;
      value: CompiledMotionTracks;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };

const hasOwn = (
  value: Readonly<Record<string, unknown>>,
  key: string
): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const readParts = (
  document: ProjectDocument
):
  | {
      ok: true;
      parts: ReadonlyMap<string, CompiledPartState>;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    } => {
  const compiled = readCompiledParts(document);
  if (compiled.ok) return compiled;
  return {
    ok: false,
    issue: motionAuthoringIssue(
      'invalid_state',
      compiled.issues[0]?.message ??
        'The compiled part rig is unavailable.',
      compiled.issues[0]?.path ?? 'modeling',
      'a valid compiled part rig',
      'document'
    )
  };
};

const explicitPosePartIds = (
  payload: ResolvedAnimationMotionInput
): readonly string[] =>
  [
    ...new Set(
      (payload.poses ?? []).flatMap(
        (pose) => Object.keys(pose.rotations)
      )
    )
  ].sort(compareStableText);

const resolveExplicitPoseSequences = (
  parts: ReadonlyMap<string, CompiledPartState>,
  payload: ResolvedAnimationMotionInput
):
  | {
      ok: true;
      sequences: Map<string, PartRotationSequence>;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    } => {
  const poses = payload.poses ?? [];
  const openingRotations = poses[0]?.rotations ?? {};
  const sequences = new Map<string, PartRotationSequence>();
  for (const partId of explicitPosePartIds(payload)) {
    if (!isPartId(partId)) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Pose rotation key "${partId}" is not a valid part ID.`,
          'payload.poses',
          'part IDs matching the canonical part ID pattern'
        )
      };
    }
    const part = parts.get(partId);
    if (!part) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Part "${partId}" does not exist in the compiled rig.`,
          'payload.poses',
          'existing compiled part IDs'
        )
      };
    }
    if (!hasOwn(openingRotations, partId)) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Part "${partId}" first appears after the opening pose.`,
          'payload.poses[0].rotations',
          `an explicit opening rotation for "${partId}"`
        )
      };
    }
    let previous = zeroRotation();
    const values: Rotation[] = [];
    for (const [poseIndex, pose] of poses.entries()) {
      if (hasOwn(pose.rotations, partId)) {
        const resolved = rotationForPart(
          part,
          pose.rotations[partId],
          `payload.poses[${poseIndex}].rotations.${partId}`
        );
        if (isMotionIssue(resolved)) {
          return { ok: false, issue: resolved };
        }
        previous = resolved;
      }
      values.push(previous);
    }
    sequences.set(partId, { part, values });
  }
  return { ok: true, sequences };
};

const explicitSpins = (
  parts: ReadonlyMap<string, CompiledPartState>,
  payload: ResolvedAnimationMotionInput
):
  | {
      ok: true;
      spins: Map<string, ResolvedSpin>;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    } => {
  const spins = new Map<string, ResolvedSpin>();
  for (const [index, input] of (payload.spins ?? []).entries()) {
    if (spins.has(input.partId)) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Part "${input.partId}" has more than one spin entry.`,
          `payload.spins[${index}].partId`,
          'one spin per part'
        )
      };
    }
    const part = parts.get(input.partId);
    if (!part) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Part "${input.partId}" does not exist in the compiled rig.`,
          `payload.spins[${index}].partId`,
          'an existing compiled hinge part ID'
        )
      };
    }
    if (part.joint.kind !== 'hinge') {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Spin part "${input.partId}" must use a hinge joint.`,
          `payload.spins[${index}].partId`,
          'a compiled hinge part ID'
        )
      };
    }
    if (
      payload.role !== 'once' &&
      !Number.isInteger(input.turns)
    ) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Loop spin for "${input.partId}" must complete whole turns.`,
          `payload.spins[${index}].turns`,
          'a positive whole number of turns'
        )
      };
    }
    if (
      input.turns * 360 / payload.durationFrames >= 180
    ) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Spin for "${input.partId}" exceeds the canonical 20 fps angular sampling limit.`,
          `payload.spins[${index}].turns`,
          `fewer than ${payload.durationFrames / 2} turns for ${payload.durationFrames} frames`
        )
      };
    }
    spins.set(input.partId, {
      part,
      turns: input.turns,
      direction: input.direction === 'negative' ? -1 : 1
    });
  }
  return { ok: true, spins };
};

const staticChannel = (
  clipId: string,
  durationFrames: number,
  parts: ReadonlyMap<string, CompiledPartState>
): TransformChannel | MotionAuthoringIssue => {
  const root = [...parts.values()]
    .filter((part) => part.parentPartId === null)
    .sort((left, right) =>
      compareStableText(left.partId, right.partId)
    )[0];
  return root
    ? channelForFrames(
        clipId,
        root,
        [0, durationFrames],
        [zeroRotation(), zeroRotation()]
      )
    : motionAuthoringIssue(
        'invalid_state',
        'A static idle requires one compiled root part.',
        'modeling',
        'one compiled root part',
        'document'
      );
};

export const compileMotionTracks = (
  document: ProjectDocument,
  payload: ResolvedAnimationMotionInput
): CompileMotionTracksResult => {
  const read = readParts(document);
  if (!read.ok) return read;
  if (payload.static) {
    const channel = staticChannel(
      payload.clipId,
      payload.durationFrames,
      read.parts
    );
    if ('code' in channel) {
      return { ok: false, issue: channel };
    }
    const rootPartId = [...read.parts.values()].find(
      (part) => part.bone.id === channel.targetNodeId
    )?.partId;
    if (
      rootPartId &&
      payload.removePartIds?.includes(rootPartId)
    ) {
      return {
        ok: false,
        issue: motionAuthoringIssue(
          'invalid_payload',
          `Static idle root "${rootPartId}" cannot be authored and removed together.`,
          'payload.removePartIds',
          `part IDs other than "${rootPartId}"`
        )
      };
    }
    return {
      ok: true,
      value: {
        channels: [channel],
        affectedPartIds: rootPartId ? [rootPartId] : []
      }
    };
  }

  const explicitSequences = resolveExplicitPoseSequences(
    read.parts,
    payload
  );
  if (!explicitSequences.ok) return explicitSequences;
  const resolvedSpins = explicitSpins(read.parts, payload);
  if (!resolvedSpins.ok) return resolvedSpins;

  const posePartIds = new Set(
    explicitSequences.sequences.keys()
  );
  const spinPartIds = new Set(resolvedSpins.spins.keys());
  const overlap = [...posePartIds].find((id) =>
    spinPartIds.has(id)
  );
  if (overlap) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        `Part "${overlap}" cannot have poses and a spin in one clip patch.`,
        'payload.spins',
        'distinct pose and spin part IDs'
      )
    };
  }
  const removed = new Set(payload.removePartIds ?? []);
  const removedOverlap = [
    ...new Set([...posePartIds, ...spinPartIds])
  ].find((id) => removed.has(id));
  if (removedOverlap) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        `Part "${removedOverlap}" cannot be authored and removed together.`,
        'payload.removePartIds',
        'part IDs omitted from poses and spins'
      )
    };
  }

  const channels: TransformChannel[] = [];
  const poses = payload.poses ?? [];
  if (poses.length > 0) {
    const frames = poseFrames(
      payload.role,
      payload.durationFrames,
      poses.length
    );
    if (isMotionIssue(frames)) {
      return { ok: false, issue: frames };
    }
    for (const sequence of [
      ...explicitSequences.sequences.values()
    ].sort((left, right) =>
      compareStableText(
        left.part.partId,
        right.part.partId
      )
    )) {
      const sourceValues =
        payload.role === 'once' &&
        sequence.values.length === 1
          ? [zeroRotation(), sequence.values[0]]
          : sequence.values;
      const values = unwrapSequence(
        sourceValues,
        payload.role,
        sequence.part.partId
      );
      if (isMotionIssue(values)) {
        return { ok: false, issue: values };
      }
      channels.push(
        channelForFrames(
          payload.clipId,
          sequence.part,
          frames,
          values
        )
      );
    }
  }
  for (const spin of [
    ...resolvedSpins.spins.values()
  ].sort((left, right) =>
    compareStableText(
      left.part.partId,
      right.part.partId
    )
  )) {
    channels.push(
      spinChannel(
        payload.clipId,
        payload.durationFrames,
        spin.part,
        spin.turns,
        spin.direction
      )
    );
  }

  const keyCount = channels.reduce(
    (count, channel) => count + channel.keys.length,
    0
  );
  if (keyCount > MOTION_AUTHORING_LIMITS.maxKeysPerOperation) {
    return {
      ok: false,
      issue: motionAuthoringIssue(
        'invalid_payload',
        `Animation motion compiles to ${keyCount} keys, exceeding the ` +
          `${MOTION_AUTHORING_LIMITS.maxKeysPerOperation}-key operation budget.`,
        'payload',
        `at most ${MOTION_AUTHORING_LIMITS.maxKeysPerOperation} compiled keys`
      )
    };
  }
  return {
    ok: true,
    value: {
      channels,
      affectedPartIds: channels.map((channel) =>
        [...read.parts.values()].find(
          (part) => part.bone.id === channel.targetNodeId
        )?.partId ?? ''
      ).filter(Boolean)
    }
  };
};
