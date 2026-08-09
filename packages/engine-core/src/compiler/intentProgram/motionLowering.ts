import type {
  AnimationClip,
  ProjectDocument
} from '../../model';
import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  type AuthoringAuthorityClaim,
  type AuthoringBinding,
  type SpecialistReference
} from '../../authoring/authoringTypes';
import type { IntentProgramMotion } from '../../project/intentProgramTypes';

const staticLoopSpecialist: SpecialistReference = {
  id: 'specialist.static-loop',
  version: AUTHORING_PROFILE_SCHEMA_VERSION
};

const animationKeys = (
  id: string,
  midpoint: readonly [number, number, number],
  rest: readonly [number, number, number]
) => [{
  id: `${id}:0`,
  timeSeconds: 0,
  value: rest,
  interpolation: 'linear' as const
}, {
  id: `${id}:10`,
  timeSeconds: 0.5,
  value: midpoint,
  interpolation: 'linear' as const
}, {
  id: `${id}:20`,
  timeSeconds: 1,
  value: rest,
  interpolation: 'linear' as const
}];

const idleChannel = (
  rootPartId: string,
  motion: IntentProgramMotion
): AnimationClip['channels'] => {
  const channelId = `animation:idle:channel:${rootPartId}:${motion.mode}`;
  if (motion.mode === 'breathe') {
    return {
      [channelId]: {
        id: channelId,
        targetNodeId: `bone:${rootPartId}`,
        property: 'scale',
        keys: animationKeys(channelId, [1.025, 1.05, 1.025], [1, 1, 1])
      }
    };
  }
  if (motion.mode === 'scan') {
    return {
      [channelId]: {
        id: channelId,
        targetNodeId: `bone:${rootPartId}`,
        property: 'rotation',
        rotationSpace: 'bone',
        keys: animationKeys(channelId, [0, 14, 0], [0, 0, 0])
      }
    };
  }
  return {
    [channelId]: {
      id: channelId,
      targetNodeId: `bone:${rootPartId}`,
      property: 'rotation',
      rotationSpace: 'bone',
      keys: animationKeys(channelId, [0, 0, 0], [0, 0, 0])
    }
  };
};

/** Creates the only canonical idle clip; source modes never expose keyframes. */
export const compileCanonicalIdle = (
  document: ProjectDocument,
  motion: IntentProgramMotion
): AnimationClip | null => {
  const root = document.modeling?.parts.find(
    (part) => part.parentPartId === null
  );
  if (!root) return null;
  return {
    id: 'idle',
    name: `animation.${document.id}.idle`,
    durationSeconds: 1,
    fps: 20,
    loop: 'loop',
    channels: idleChannel(root.partId, motion),
    triggers: {}
  };
};

export const motionAuthoringSelection = (): {
  specialists: readonly SpecialistReference[];
  claims: readonly AuthoringAuthorityClaim[];
  bindings: readonly AuthoringBinding[];
} => ({
  specialists: [staticLoopSpecialist],
  claims: [{
    authority: staticLoopSpecialist,
    criterionId: 'criterion.presentation-motion',
    basis: 'requested',
    referenceIds: ['intent.subject'],
    rationale: 'The confirmed Intent Program explicitly owns the canonical idle motion.'
  }],
  bindings: [{
    type: 'motion',
    specialist: staticLoopSpecialist,
    clipId: 'idle',
    role: 'idle'
  }]
});
