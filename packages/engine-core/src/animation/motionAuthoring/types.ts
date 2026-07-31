import type { AnimationClip } from '../../model';
import type {
  MotionAuthoringIssue,
  ResolvedAnimationMotionInput
} from '../motionContract';

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

export interface ResolvedMotionRequest {
  payload: ResolvedAnimationMotionInput;
  name: string;
  durationSeconds: number;
  fps: number;
  loop: AnimationClip['loop'];
  roleSpecified: boolean;
  durationSpecified: boolean;
}

export type ResolveMotionRequestResult =
  | {
      ok: true;
      value: ResolvedMotionRequest;
    }
  | {
      ok: false;
      issue: MotionAuthoringIssue;
    };
