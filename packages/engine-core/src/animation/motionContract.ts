import type {
  AnimationMotionRole,
  AnimationPoseInput,
  AnimationRotationDegrees,
  AnimationSpinInput,
  CommandPayloadMap
} from '../commands/types';

export const MOTION_AUTHORING_FPS = 20;

export const MOTION_AUTHORING_LIMITS = Object.freeze({
  maxDurationFrames: 1_200,
  maxPosesPerOperation: 64,
  maxPartTracksPerOperation: 128,
  maxSpinsPerOperation: 128,
  maxKeysPerOperation: 1_024,
  maxKeysPerBatch: 2_048
});

export type {
  AnimationMotionRole,
  AnimationPoseInput,
  AnimationRotationDegrees,
  AnimationSpinInput
};

export type AnimationMotionUpsertInput =
  CommandPayloadMap['animation.motion.upsert'];

export type ResolvedAnimationMotionInput =
  Omit<
    AnimationMotionUpsertInput,
    'role' | 'durationFrames'
  > & {
    role: AnimationMotionRole;
    durationFrames: number;
  };

export interface MotionAuthoringIssue {
  code: 'invalid_payload' | 'invalid_state';
  message: string;
  path: string;
  expected: string;
  pathScope?: 'document';
}

export const motionAuthoringIssue = (
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
