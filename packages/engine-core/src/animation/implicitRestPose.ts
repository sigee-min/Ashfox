import type {
  AnimationClip,
  ProjectDocument
} from '../model';
import { resourceToken } from '../resourceToken';
import {
  compileCanonicalStaticIdle
} from './motionAuthoring';

export const IMPLICIT_REST_POSE_CLIP_ID =
  'animation-rest-pose';

const implicitRestPoseName = (
  document: ProjectDocument
): string => {
  const modelPath =
    'modelPath' in document.formatProfile
      ? document.formatProfile.modelPath
      : document.name;
  return (
    'animation.' +
    `${resourceToken(
      modelPath.split('/').join('.'),
      'model'
    )}.rest_pose`
  );
};

export const createImplicitRestPose = (
  document: ProjectDocument
): AnimationClip => ({
  id: IMPLICIT_REST_POSE_CLIP_ID,
  name: implicitRestPoseName(document),
  durationSeconds: 1,
  fps: 20,
  loop: 'loop',
  channels: {},
  triggers: {}
});

export const isImplicitRestPose = (
  id: string,
  clip: AnimationClip
): boolean =>
  id === IMPLICIT_REST_POSE_CLIP_ID &&
  Object.keys(clip.channels).length === 0 &&
  Object.keys(clip.triggers).length === 0;

export const withoutImplicitRestPose = (
  animations: ProjectDocument['animations']
): ProjectDocument['animations'] =>
  Object.fromEntries(
    Object.entries(animations).filter(
      ([id, clip]) => !isImplicitRestPose(id, clip)
    )
  );

export interface RequiredAnimationFallback {
  document: ProjectDocument;
  createdClipId: string | null;
  createdChannelIds: readonly string[];
}

export const ensureRequiredAnimationFallback = (
  document: ProjectDocument
): RequiredAnimationFallback => {
  if (
    document.formatProfile.id !==
      'minecraft.java.geckolib5' ||
    Object.keys(document.animations).length > 0
  ) {
    return {
      document,
      createdClipId: null,
      createdChannelIds: []
    };
  }
  const staticIdle = compileCanonicalStaticIdle(document);
  const clip = staticIdle.ok
    ? staticIdle.clip
    : createImplicitRestPose(document);
  return {
    document: {
      ...document,
      animations: {
        [clip.id]: clip
      }
    },
    createdClipId: clip.id,
    createdChannelIds: Object.keys(clip.channels)
  };
};
