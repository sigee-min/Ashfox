import type { ConstrainedModelRecipe } from '../../model';
import { compareStableText } from '../../stableOrder';
import { PART_CONTRACT_LIMITS } from '../partContract';
import type {
  DeriveMirrorPartIdMapInput,
  PartIdMirrorMapping
} from './types';

export const partSubtreeIds = (
  recipe: ConstrainedModelRecipe,
  rootPartId: string
): readonly string[] => {
  if (!recipe.parts.some((part) => part.partId === rootPartId)) return [];
  const selected = new Set([rootPartId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const part of recipe.parts) {
      if (
        part.parentPartId !== null &&
        selected.has(part.parentPartId) &&
        !selected.has(part.partId)
      ) {
        selected.add(part.partId);
        changed = true;
      }
    }
  }
  return [...selected].sort(compareStableText);
};

const stablePartIdHash = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36).padStart(7, '0');
};

const fittedDerivedPartId = (
  preferred: string,
  prefix: string,
  hashSeed: string
): string => {
  if (preferred.length <= PART_CONTRACT_LIMITS.maxIdLength) return preferred;
  const suffix = `.part-${stablePartIdHash(hashSeed)}`;
  const available = PART_CONTRACT_LIMITS.maxIdLength - suffix.length;
  const fittedPrefix = prefix
    .slice(0, available)
    .replace(/[._-]+$/u, '');
  return `${fittedPrefix || 'part'}${suffix}`;
};

export const deriveMirrorPartIdMap = (
  recipe: ConstrainedModelRecipe,
  input: DeriveMirrorPartIdMapInput
): readonly PartIdMirrorMapping[] => {
  const sourcePartIds = partSubtreeIds(recipe, input.rootPartId);
  if (sourcePartIds.length === 0) return [];
  const planeToken =
    input.plane < 0 ? `n${-input.plane}` : `p${input.plane}`;
  const defaultRootSuffix = `.mirror-${input.axis}-${planeToken}`;
  const defaultRoot = fittedDerivedPartId(
    `${input.rootPartId}${defaultRootSuffix}`,
    input.rootPartId,
    `${input.rootPartId}|${input.axis}|${input.plane}`
  );
  const targetRootPartId = input.targetRootPartId ?? defaultRoot;
  return sourcePartIds.map((sourcePartId) => ({
    sourcePartId,
    targetPartId:
      sourcePartId === input.rootPartId
        ? targetRootPartId
        : fittedDerivedPartId(
            `${targetRootPartId}.${sourcePartId}`,
            targetRootPartId,
            `${targetRootPartId}|${sourcePartId}`
          )
  }));
};
