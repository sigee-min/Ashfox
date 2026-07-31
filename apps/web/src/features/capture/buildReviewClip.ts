import {
  analyzeAnimationPreview,
  isProductionIdleClipName,
  type AnimationClip,
  type ProjectDocument
} from '@ashfox/engine-core';

const compareReviewPriority = (
  left: AnimationClip,
  right: AnimationClip
): number => {
  const leftIdle = isProductionIdleClipName(left.name);
  const rightIdle = isProductionIdleClipName(right.name);
  if (leftIdle !== rightIdle) return leftIdle ? -1 : 1;
  return left.id.localeCompare(right.id);
};

export const resolveBuildReviewClip = (
  document: ProjectDocument
): AnimationClip | null => {
  const preferred = Object.values(document.animations)
    .sort(compareReviewPriority)[0];
  if (
    !preferred ||
    Object.keys(preferred.channels).length === 0 ||
    analyzeAnimationPreview(preferred).length > 0
  ) {
    return null;
  }
  return preferred;
};
