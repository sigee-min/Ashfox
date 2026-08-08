import { compareStableText } from '../stableOrder';
import {
  findSixConnectedComponents,
  isSixConnected
} from './connectivity';
import {
  createOccupancyGrid,
  parseCellKey
} from './lattice';
import {
  isGeometryPartSpec,
  type GeometryPartSpec,
  type PartSpec
} from './partContract';
import {
  compileSemanticPartCuboids,
  occupancyForCuboids,
  subtractCuboidsForSeamOwnership
} from './semanticCuboidGrammar';
import {
  orthographicContributionMetrics,
  resolveAttachmentAnchor
} from './partQualityMetrics';
import {
  projectSurfaceFeaturePlacement,
  surfaceFeaturePixels,
  validateSurfaceFeaturePlacement
} from './surfaceFeature';
import type {
  CellKey,
  LatticePoint,
  OccupancyGrid,
  SurfacePixelDensity,
  Cuboid
} from './types';

export const PART_OCCUPANCY_POLICY = {
  minimumRetainedNumerator: 1,
  minimumRetainedDenominator: 5,
  maximumAttachmentSnapDistanceBlocks: 2
} as const;

export interface PartOccupancyCanonicalizationMetric {
  partId: string;
  authoredCellCount: number;
  canonicalCellCount: number;
  trimmedCellCount: number;
  retainedFraction: number;
  maximumTrimDepthCells: number;
  canonicalAttachmentAnchor:
    | readonly [number, number, number]
    | null;
  attachmentSnapDistanceCells: number;
  trimmedByPartIds: readonly string[];
}

export interface CanonicalPartOccupancy {
  spec: GeometryPartSpec;
  /** Compiler-selected form before cross-part seam ownership. */
  authoredCuboids: readonly Cuboid[];
  /** Final emitted form after bounded parent/seam adjustment. */
  cuboids: readonly Cuboid[];
  authored: OccupancyGrid;
  canonical: OccupancyGrid;
  canonicalAttachmentAnchor: LatticePoint | null;
  metric: PartOccupancyCanonicalizationMetric;
}

export type CanonicalizePartOccupanciesResult =
  | {
      ok: true;
      parts: readonly CanonicalPartOccupancy[];
      features: readonly Extract<PartSpec, { kind: 'feature' }>[];
    }
  | { ok: false; path: string; message: string };

type CanonicalizationFailure = Extract<
  CanonicalizePartOccupanciesResult,
  { ok: false }
>;

export const canonicalPartOrder = (
  parts: readonly PartSpec[]
): readonly PartSpec[] | null => {
  const remaining = new Map(
    parts.map((part) => [part.partId, part] as const)
  );
  if (remaining.size !== parts.length) return null;
  const resolved = new Set<string>();
  const ordered: PartSpec[] = [];
  while (remaining.size > 0) {
    const next = [...remaining.values()]
      .filter(
        (part) =>
          part.parentPartId === null ||
          resolved.has(part.parentPartId)
      )
      .sort((left, right) =>
        compareStableText(left.partId, right.partId)
      )[0];
    if (!next) return null;
    ordered.push(next);
    remaining.delete(next.partId);
    resolved.add(next.partId);
  }
  return ordered;
};

const isMostlyConsumed = (
  authoredCellCount: number,
  canonicalCellCount: number
): boolean =>
  canonicalCellCount *
    PART_OCCUPANCY_POLICY.minimumRetainedDenominator <=
  authoredCellCount *
    PART_OCCUPANCY_POLICY.minimumRetainedNumerator;

const NEIGHBOR_OFFSETS = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [0, 0, -1],
  [0, 0, 1]
] as const;

const maximumTrimDepth = (
  authored: ReadonlySet<CellKey>,
  retained: readonly CellKey[],
  trimmed: ReadonlySet<CellKey>
): number => {
  if (trimmed.size === 0) return 0;
  const distances = new Map<CellKey, number>();
  const queue = [...retained];
  for (const key of retained) distances.set(key, 0);
  let cursor = 0;
  let maximum = 0;
  while (cursor < queue.length) {
    const key = queue[cursor];
    cursor += 1;
    const cell = parseCellKey(key);
    const nextDistance = (distances.get(key) ?? 0) + 1;
    for (const [x, y, z] of NEIGHBOR_OFFSETS) {
      const neighbor =
        `${cell.x + x},${cell.y + y},${cell.z + z}` as CellKey;
      if (!authored.has(neighbor) || distances.has(neighbor)) continue;
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
      if (trimmed.has(neighbor)) maximum = Math.max(maximum, nextDistance);
    }
  }
  return maximum;
};

const canonicalizeGeometryPart = (
  spec: GeometryPartSpec,
  density: SurfacePixelDensity,
  ownerByCell: Map<CellKey, string>,
  ownedCuboids: Cuboid[]
): CanonicalPartOccupancy | CanonicalizationFailure => {
  const authoredCuboids = compileSemanticPartCuboids(spec);
  const authored = occupancyForCuboids(authoredCuboids, density);
  if (authored.cells.size === 0) {
    return {
      ok: false,
      path: `parts.${spec.partId}`,
      message: 'Part primitive produced no occupied cells.'
    };
  }
  const retainedKeys: CellKey[] = [];
  const trimmedKeys = new Set<CellKey>();
  const trimmedBy = new Set<string>();
  for (const key of authored.cells) {
    const owner = ownerByCell.get(key);
    if (owner === undefined) {
      retainedKeys.push(key);
    } else {
      trimmedKeys.add(key);
      trimmedBy.add(owner);
    }
  }
  if (isMostlyConsumed(authored.cells.size, retainedKeys.length)) {
    const retainedPercent = Math.round(
      (retainedKeys.length / authored.cells.size) * 100
    );
    return {
      ok: false,
      path: `parts.${spec.partId}`,
      message: `Part "${spec.partId}" retains only ${retainedPercent}% of its authored cells after deterministic seam ownership. Move or resize it so more than 20% remains.`
    };
  }
  const trimDepth = maximumTrimDepth(
    authored.cells,
    retainedKeys,
    trimmedKeys
  );
  const cuboids = subtractCuboidsForSeamOwnership(
    authoredCuboids,
    ownedCuboids
  );
  const canonical = occupancyForCuboids(cuboids, density);
  if (
    canonical.cells.size !== retainedKeys.length ||
    retainedKeys.some((key) => !canonical.cells.has(key))
  ) {
    return {
      ok: false,
      path: `parts.${spec.partId}`,
      message:
        `Part "${spec.partId}" seam adjustment did not preserve exact ` +
        'single-owner template occupancy.'
    };
  }
  if (spec.parentPartId === null && !isSixConnected(canonical)) {
    return {
      ok: false,
      path: `parts.${spec.partId}`,
      message: `Root part "${spec.partId}" must remain one connected semantic form.`
    };
  }
  for (const key of canonical.cells) ownerByCell.set(key, spec.partId);
  ownedCuboids.push(...cuboids);
  return {
    spec,
    authoredCuboids,
    cuboids,
    authored,
    canonical,
    canonicalAttachmentAnchor: null,
    metric: {
      partId: spec.partId,
      authoredCellCount: authored.cells.size,
      canonicalCellCount: canonical.cells.size,
      trimmedCellCount: authored.cells.size - canonical.cells.size,
      retainedFraction: canonical.cells.size / authored.cells.size,
      maximumTrimDepthCells: trimDepth,
      canonicalAttachmentAnchor: null,
      attachmentSnapDistanceCells: 0,
      trimmedByPartIds: [...trimmedBy].sort(compareStableText)
    }
  };
};

const canonicalizeGeometry = (
  ordered: readonly PartSpec[],
  density: SurfacePixelDensity
): readonly CanonicalPartOccupancy[] | CanonicalizationFailure => {
  const ownerByCell = new Map<CellKey, string>();
  const ownedCuboids: Cuboid[] = [];
  const canonical: CanonicalPartOccupancy[] = [];
  for (const spec of ordered.filter(isGeometryPartSpec)) {
    const result = canonicalizeGeometryPart(
      spec,
      density,
      ownerByCell,
      ownedCuboids
    );
    if ('ok' in result) return result;
    canonical.push(result);
  }
  return canonical;
};

const resolveAttachments = (
  canonical: readonly CanonicalPartOccupancy[]
): readonly CanonicalPartOccupancy[] | CanonicalizationFailure => {
  const byPart = new Map(
    canonical.map((part) => [part.spec.partId, part])
  );
  const resolved: CanonicalPartOccupancy[] = [];
  for (const part of canonical) {
    const parentPartId = part.spec.parentPartId;
    if (parentPartId === null) {
      resolved.push(part);
      continue;
    }
    const parent = byPart.get(parentPartId);
    const attachment = part.spec.attachment;
    if (!parent || !attachment) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message: `Part "${part.spec.partId}" requires an existing parent and attachment anchors.`
      };
    }
    const anchor = resolveAttachmentAnchor(
      part.spec.partId,
      parentPartId,
      part.canonical,
      parent.canonical,
      {
        x: attachment.parentAnchor[0],
        y: attachment.parentAnchor[1],
        z: attachment.parentAnchor[2]
      }
    );
    if (!anchor) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message: `Part "${part.spec.partId}" has no face contact with its parent after semantic seam ownership.`
      };
    }
    const detachedComponent = findSixConnectedComponents(
      part.canonical
    ).find((component) =>
      resolveAttachmentAnchor(
        part.spec.partId,
        parentPartId,
        createOccupancyGrid(part.canonical.density, component),
        parent.canonical,
        {
          x: attachment.parentAnchor[0],
          y: attachment.parentAnchor[1],
          z: attachment.parentAnchor[2]
        }
      ) === null
    );
    if (detachedComponent) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message:
          `Every cuboid group in child part "${part.spec.partId}" ` +
          'must contact its semantic parent.'
      };
    }
    const canonicalAttachmentAnchor = { ...anchor.anchor };
    resolved.push({
      ...part,
      canonicalAttachmentAnchor,
      metric: {
        ...part.metric,
        canonicalAttachmentAnchor: [
          canonicalAttachmentAnchor.x,
          canonicalAttachmentAnchor.y,
          canonicalAttachmentAnchor.z
        ],
        attachmentSnapDistanceCells: anchor.distanceCells
      }
    });
  }
  return resolved;
};

const validateSilhouette = (
  parts: readonly CanonicalPartOccupancy[]
): CanonicalizationFailure | null => {
  const visiblePartIds = new Set(
    orthographicContributionMetrics(
      new Map(
        parts.map((part) => [
          part.spec.partId,
          { partId: part.spec.partId, occupancy: part.canonical }
        ])
      )
    )
      .filter((metric) => metric.visibleCellCount > 0)
      .map((metric) => metric.partId)
  );
  const hidden = parts.find(
    (part) => !visiblePartIds.has(part.spec.partId)
  );
  return hidden
    ? {
        ok: false,
        path: `parts.${hidden.spec.partId}`,
        message: `Canonical seam ownership leaves part "${hidden.spec.partId}" without an orthographic silhouette contribution.`
      }
    : null;
};

const projectAndValidateFeatures = (
  ordered: readonly PartSpec[],
  geometry: readonly CanonicalPartOccupancy[]
):
  | {
      ok: true;
      features: readonly Extract<PartSpec, { kind: 'feature' }>[];
    }
  | CanonicalizationFailure => {
  const byPart = new Map(
    geometry.map((part) => [part.spec.partId, part])
  );
  const environment = new Set<CellKey>(
    geometry.flatMap((part) => [...part.canonical.cells])
  );
  const featurePixelOwners = new Map<
    string,
    Extract<PartSpec, { kind: 'feature' }>[]
  >();
  const projectedFeatures: Extract<PartSpec, { kind: 'feature' }>[] = [];
  for (const feature of ordered.filter(
    (part): part is Extract<PartSpec, { kind: 'feature' }> =>
      part.kind === 'feature'
  )) {
    const parent =
      feature.parentPartId === null
        ? undefined
        : byPart.get(feature.parentPartId);
    if (!parent) {
      return {
        ok: false,
        path: `parts.${feature.partId}.parentPartId`,
        message: `Surface feature "${feature.partId}" requires a geometric parent.`
      };
    }
    const projected = feature.motif === 'eye'
      ? validateSurfaceFeaturePlacement(
          feature,
          parent.canonical,
          environment
        ) === null
        ? feature
        : null
      : projectSurfaceFeaturePlacement(
          feature,
          parent.canonical,
          environment
        );
    if (!projected) {
      return {
        ok: false,
        path: `parts.${feature.partId}.anchor`,
        message:
          `Surface feature "${feature.partId}" does not fit on an ` +
          `uncovered ${feature.face} face of parent ` +
          `"${feature.parentPartId}" at size ` +
          `${feature.size[0]}×${feature.size[1]}.` +
          (feature.motif === 'eye'
            ? ' Eye anchors are explicit and are never independently snapped.'
            : '')
      };
    }
    for (const pixel of surfaceFeaturePixels(projected)) {
      const owners = featurePixelOwners.get(pixel.key) ?? [];
      const conflict = owners.find(
        (owner) =>
          !(
            (owner.motif === 'patch') !==
            (projected.motif === 'patch')
          )
      );
      if (conflict) {
        return {
          ok: false,
          path: `parts.${projected.partId}.anchor`,
          message:
            `Surface features "${conflict.partId}" and ` +
            `"${projected.partId}" overlap on the same generated surface ` +
            'pixels. Only one broad patch may sit beneath a focal glyph.'
        };
      }
      featurePixelOwners.set(pixel.key, [...owners, projected]);
    }
    projectedFeatures.push(projected);
  }
  return { ok: true, features: projectedFeatures };
};

export const canonicalizePartOccupancies = (
  parts: readonly PartSpec[],
  density: SurfacePixelDensity
): CanonicalizePartOccupanciesResult => {
  const ordered = canonicalPartOrder(parts);
  if (!ordered) {
    return {
      ok: false,
      path: 'parts',
      message: 'Part hierarchy must contain unique IDs, existing parents, and no cycles.'
    };
  }
  const canonical = canonicalizeGeometry(ordered, density);
  if ('ok' in canonical) return canonical;
  const resolved = resolveAttachments(canonical);
  if ('ok' in resolved) return resolved;
  const silhouetteIssue = validateSilhouette(resolved);
  if (silhouetteIssue) return silhouetteIssue;
  const features = projectAndValidateFeatures(ordered, resolved);
  return features.ok
    ? { ok: true, parts: resolved, features: features.features }
    : features;
};
