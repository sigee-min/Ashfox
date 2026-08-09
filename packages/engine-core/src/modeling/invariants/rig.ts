import type {
  AnimationVec3,
  ProjectDocument,
  TransformChannel
} from '../../model';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './index';

const HINGE_AXIS_INDEX = {
  x: 0,
  y: 1,
  z: 2
} as const;

const isZero = (value: AnimationVec3[number]): boolean =>
  typeof value === 'number' && Math.abs(value) <= 0.000001;

const channelVectors = (
  channel: TransformChannel
): readonly AnimationVec3[] =>
  channel.keys.flatMap((key) => [
    key.value,
    ...(key.preValue ? [key.preValue] : []),
    ...(key.postValue ? [key.postValue] : [])
  ]);

const followsHingeAxis = (
  channel: TransformChannel,
  axis: keyof typeof HINGE_AXIS_INDEX
): boolean => {
  if (channel.property !== 'rotation') return false;
  const allowedIndex = HINGE_AXIS_INDEX[axis];
  return channelVectors(channel).every((value) =>
    value.every(
      (component, index) =>
        index === allowedIndex || isZero(component)
    )
  );
};

export const validateCompiledPartRig = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const partsByBoneId = new Map(
    [...parts.values()].map((part) => [part.bone.id, part])
  );
  for (const [clipId, clip] of Object.entries(document.animations)) {
    for (const [channelId, channel] of Object.entries(clip.channels)) {
      const target = document.scene.nodes[channel.targetNodeId];
      if (
        target?.generation?.authority === 'ashfox.part-compiler' &&
        target.generation.role === 'geometry'
      ) {
        issues.push({
          code: 'rig',
          path: `animations.${clipId}.channels.${channelId}.targetNodeId`,
          message:
            'Compiled geometry cannot be animated directly; target its stable part bone.',
          entityIds: [target.id],
          clipIds: [clipId]
        });
        continue;
      }
      const part = partsByBoneId.get(channel.targetNodeId);
      if (!part || part.parentPartId === null) continue;
      const valid =
        part.joint.kind === 'fixed'
          ? false
          : part.joint.kind === 'ball'
            ? channel.property === 'rotation'
            : followsHingeAxis(channel, part.joint.axis);
      if (valid) continue;
      issues.push({
        code: 'rig',
        path: `animations.${clipId}.channels.${channelId}`,
        message:
          part.joint.kind === 'fixed'
            ? `Fixed part "${part.partId}" cannot have a transform channel.`
            : part.joint.kind === 'ball'
              ? `Ball part "${part.partId}" accepts rotation channels only.`
              : `Hinge part "${part.partId}" accepts rotation only on its ${part.joint.axis}-axis.`,
        entityIds: [part.bone.id],
        clipIds: [clipId]
      });
    }
  }
};
