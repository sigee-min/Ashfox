import type { ProjectDocument } from '../model';
import {
  MOTION_AUTHORING_FPS,
  motionAuthoringIssue,
  type AnimationMotionUpsertInput
} from './motionContract';
import { compileMotionTracks } from './motionPoseCompiler';
import { buildMotionClip } from './motionAuthoring/buildClip';
import {
  conflictingNameIssue,
  identityIssue,
  patchChangesMotion,
  payloadPolicyIssue,
  removalIssue
} from './motionAuthoring/policy';
import {
  canonicalIdleIssue,
  loopClosureIssue,
  movementIssue
} from './motionAuthoring/quality';
import { resolveMotionRequest } from './motionAuthoring/resolveRequest';
import { preservedTimingIssue } from './motionAuthoring/timing';
import type { CompileAnimationMotionResult } from './motionAuthoring/types';

export { MOTION_AUTHORING_FPS };
export type { CompileAnimationMotionResult } from './motionAuthoring/types';

export const compileAnimationMotion = (
  document: ProjectDocument,
  input: AnimationMotionUpsertInput
): CompileAnimationMotionResult => {
  const current = document.animations[input.clipId];
  const resolved = resolveMotionRequest(document, input, current);
  if (!resolved.ok) return resolved;
  const request = resolved.value;
  const { payload } = request;
  const contractIssue =
    identityIssue(payload) ?? payloadPolicyIssue(payload);
  if (contractIssue) return { ok: false, issue: contractIssue };

  const invalidRemoval = removalIssue(current, payload);
  if (invalidRemoval) return { ok: false, issue: invalidRemoval };
  if (!patchChangesMotion(current, request)) {
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
  const invalidName = conflictingNameIssue(
    document,
    payload.clipId,
    request.name
  );
  if (invalidName) return { ok: false, issue: invalidName };

  const clip = buildMotionClip(
    request,
    current,
    compiled.value.channels
  );
  const invalidResult =
    loopClosureIssue(request, current, clip) ??
    canonicalIdleIssue(clip) ??
    movementIssue(payload, clip.channels);
  if (invalidResult) return { ok: false, issue: invalidResult };

  const nextChannelIds = new Set(Object.keys(clip.channels));
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
