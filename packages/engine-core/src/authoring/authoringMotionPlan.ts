import type {
  AnimationClip,
  ProjectDocument,
  TransformChannel
} from '../model';
import { canonicalJsonString } from '../canonicalJson';
import { idleClipNumericallyCloses } from '../animation/idleContract';
import { authoringPlanIssue } from './authoringIssueFactories';
import type {
  AuthoringMotionBinding,
  AuthoringProfile
} from './authoringTypes';
import type { AuthoringPlanIssue } from './authoringPlanTypes';

const channelMoves = (channel: TransformChannel): boolean => {
  const opening = channel.keys[0];
  return opening !== undefined && channel.keys.some(
    (key) => canonicalJsonString(key.value) !==
      canonicalJsonString(opening.value)
  );
};

const clipRoleMatches = (
  clip: AnimationClip,
  binding: AuthoringMotionBinding
): boolean =>
  binding.role === 'once' ? clip.loop === 'once' : clip.loop === 'loop';

export const motionIssues = (
  document: ProjectDocument,
  profile: AuthoringProfile
): readonly AuthoringPlanIssue[] =>
  profile.bindings.flatMap((binding, index) => {
    if (binding.type !== 'motion') return [];
    const path = `authoringProfile.bindings[${index}]`;
    const clip = document.animations[binding.clipId];
    if (!clip) {
      return [authoringPlanIssue(
        'authoring.plan.motion_clip_missing',
        `${path}.clipId`,
        `Bound motion clip "${binding.clipId}" is missing.`,
        'recompile the reviewed Intent Program source',
        { authority: binding.specialist, clipIds: [binding.clipId] }
      )];
    }
    const issues: AuthoringPlanIssue[] = [];
    if (!clipRoleMatches(clip, binding)) {
      issues.push(authoringPlanIssue(
        'authoring.plan.motion_role_invalid',
        `${path}.role`,
        `Clip "${clip.id}" does not realize bound role "${binding.role}".`,
        binding.role,
        { authority: binding.specialist, clipIds: [clip.id] }
      ));
    }
    if (binding.role === 'idle' && !idleClipNumericallyCloses(clip)) {
      issues.push(authoringPlanIssue(
        'authoring.plan.motion_idle_rest_invalid',
        `animations.${clip.id}`,
        `Canonical idle "${clip.id}" does not begin and end at identity rest rotation.`,
        'numeric [0,0,0] opening and closing rotation deltas on every canonical idle rotation channel',
        { authority: binding.specialist, clipIds: [clip.id] }
      ));
    }
    if (
      binding.role !== 'idle' &&
      !Object.values(clip.channels).some(channelMoves)
    ) {
      issues.push(authoringPlanIssue(
        'authoring.plan.motion_static',
        `animations.${clip.id}.channels`,
        `Non-idle bound clip "${clip.id}" contains no changing motion.`,
        'at least one changing transform channel',
        { authority: binding.specialist, clipIds: [clip.id] }
      ));
    }
    return issues;
  });
