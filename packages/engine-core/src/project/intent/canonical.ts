import { canonicalJsonString } from '../../canonicalJson';
import type { ProjectIntent } from '../../model';

/** Identity is the only mutation-safe cache for externally owned intent data. */
export const projectIntentsEqual = (
  left: ProjectIntent | undefined,
  right: ProjectIntent | undefined
): boolean => {
  if (left === right) return true;
  if (left === undefined || right === undefined) return false;
  return canonicalJsonString(left) === canonicalJsonString(right);
};
