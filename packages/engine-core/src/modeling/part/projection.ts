import type { FeaturePartSpec, PartSpec } from './contract';

export interface PartProjectionMetric {
  readonly indexedFeatures: number;
  readonly featureLookups: number;
}

export interface MeasuredPartProjection {
  readonly parts: readonly PartSpec[];
  readonly metric: PartProjectionMetric;
}

/**
 * Restores compiler-projected features without repeatedly scanning the full
 * projected feature list. The first occurrence retains the legacy `find`
 * semantics for malformed internal input while canonical input remains unique.
 */
export const projectCompiledFeaturesMeasured = (
  parts: readonly PartSpec[],
  projectedFeatures: readonly FeaturePartSpec[]
): MeasuredPartProjection => {
  const firstFeatureById = new Map<string, FeaturePartSpec>();
  for (const feature of projectedFeatures) {
    if (!firstFeatureById.has(feature.partId)) {
      firstFeatureById.set(feature.partId, feature);
    }
  }
  let featureLookups = 0;
  const projectedParts = parts.map((part) => {
    if (part.kind !== 'feature') return part;
    featureLookups += 1;
    return firstFeatureById.get(part.partId) ?? part;
  });
  return {
    parts: projectedParts,
    metric: {
      indexedFeatures: projectedFeatures.length,
      featureLookups
    }
  };
};

export const projectCompiledFeatures = (
  parts: readonly PartSpec[],
  projectedFeatures: readonly FeaturePartSpec[]
): readonly PartSpec[] => projectCompiledFeaturesMeasured(
  parts,
  projectedFeatures
).parts;
