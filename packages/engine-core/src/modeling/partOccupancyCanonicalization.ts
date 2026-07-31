import { compareStableText } from '../stableOrder';
import { isSixConnected } from './connectivity';
import {
  createOccupancyGrid,
  parseCellKey
} from './lattice';
import type {
  GeometryPartSpec,
  PartSpec
} from './partContract';
import {
  isGeometryPartSpec
} from './partContract';
import { rasterizePart } from './partPrimitiveAdapter';
import {
  orthographicContributionMetrics,
  resolveAttachmentAnchor
} from './partQualityMetrics';
import type {
  LatticePoint,
  CellKey,
  OccupancyGrid,
  SurfacePixelDensity
} from './types';
import {
  surfaceFeaturePixels,
  validateSurfaceFeaturePlacement
} from './surfaceFeature';

export const PART_OCCUPANCY_POLICY = {
  minimumRetainedNumerator: 1,
  minimumRetainedDenominator: 5,
  maximumTrimDepthCells: 2
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
  authored: OccupancyGrid;
  canonical: OccupancyGrid;
  canonicalAttachmentAnchor: LatticePoint | null;
  metric: PartOccupancyCanonicalizationMetric;
}

export type CanonicalizePartOccupanciesResult =
  | {
      ok: true;
      parts: readonly CanonicalPartOccupancy[];
    }
  | {
      ok: false;
      path: string;
      message: string;
    };

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
      if (!authored.has(neighbor) || distances.has(neighbor)) {
        continue;
      }
      distances.set(neighbor, nextDistance);
      queue.push(neighbor);
      if (trimmed.has(neighbor)) {
        maximum = Math.max(maximum, nextDistance);
      }
    }
  }
  return maximum;
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
      message:
        'Part hierarchy must contain unique IDs, existing parents, and no cycles.'
    };
  }

  const ownerByCell = new Map<CellKey, string>();
  const canonical: CanonicalPartOccupancy[] = [];
  for (const spec of ordered.filter(isGeometryPartSpec)) {
    const authored = rasterizePart(density, spec);
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
        message:
          `Part "${spec.partId}" retains only ${retainedPercent}% of its authored cells after deterministic seam ownership. Move or resize it so more than 20% remains.`
      };
    }
    const trimDepth = maximumTrimDepth(
      authored.cells,
      retainedKeys,
      trimmedKeys
    );
    if (trimDepth > PART_OCCUPANCY_POLICY.maximumTrimDepthCells) {
      return {
        ok: false,
        path: `parts.${spec.partId}`,
        message:
          `Part "${spec.partId}" penetrates ${trimDepth} surface cells into earlier geometry. Keep authored seam overlap within ${PART_OCCUPANCY_POLICY.maximumTrimDepthCells} cells.`
      };
    }

    const canonicalGrid = createOccupancyGrid(
      density,
      retainedKeys.map(parseCellKey)
    );
    if (!isSixConnected(canonicalGrid)) {
      return {
        ok: false,
        path: `parts.${spec.partId}`,
        message:
          `Canonical seam ownership disconnects part "${spec.partId}". Move or resize the join so the retained cells remain one volume.`
      };
    }
    for (const key of canonicalGrid.cells) {
      ownerByCell.set(key, spec.partId);
    }
    canonical.push({
      spec,
      authored,
      canonical: canonicalGrid,
      canonicalAttachmentAnchor: null,
      metric: {
        partId: spec.partId,
        authoredCellCount: authored.cells.size,
        canonicalCellCount: canonicalGrid.cells.size,
        trimmedCellCount:
          authored.cells.size - canonicalGrid.cells.size,
        retainedFraction:
          canonicalGrid.cells.size / authored.cells.size,
        maximumTrimDepthCells: trimDepth,
        canonicalAttachmentAnchor: null,
        attachmentSnapDistanceCells: 0,
        trimmedByPartIds: [...trimmedBy].sort(compareStableText)
      }
    });
  }

  const canonicalByPart = new Map(
    canonical.map((part) => [part.spec.partId, part])
  );
  const resolved: CanonicalPartOccupancy[] = [];
  for (const part of canonical) {
    const parentPartId = part.spec.parentPartId;
    if (parentPartId === null) {
      resolved.push(part);
      continue;
    }
    const parent = canonicalByPart.get(parentPartId);
    const attachment = part.spec.attachment;
    if (!parent || !attachment) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message:
          `Part "${part.spec.partId}" requires an existing parent and attachment anchors.`
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
    if (
      !anchor ||
      anchor.distanceCells >
        PART_OCCUPANCY_POLICY.maximumTrimDepthCells
    ) {
      return {
        ok: false,
        path: `parts.${part.spec.partId}.attachment`,
        message:
          `Part "${part.spec.partId}" has no parent contact within ${PART_OCCUPANCY_POLICY.maximumTrimDepthCells} surface cells of its requested attachment anchor.`
      };
    }
    const canonicalAttachmentAnchor = {
      x: anchor.anchor.x,
      y: anchor.anchor.y,
      z: anchor.anchor.z
    };
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

  const visiblePartIds = new Set(
    orthographicContributionMetrics(
      new Map(
        resolved.map((part) => [
          part.spec.partId,
          {
            partId: part.spec.partId,
            occupancy: part.canonical
          }
        ])
      )
    )
      .filter((metric) => metric.visibleCellCount > 0)
      .map((metric) => metric.partId)
  );
  const hidden = resolved.find(
    (part) => !visiblePartIds.has(part.spec.partId)
  );
  if (hidden) {
    return {
      ok: false,
      path: `parts.${hidden.spec.partId}`,
      message:
        `Canonical seam ownership leaves part "${hidden.spec.partId}" without an orthographic silhouette contribution.`
    };
  }

  const environment = new Set<CellKey>(
    resolved.flatMap((part) => [...part.canonical.cells])
  );
  const featurePixelOwners = new Map<string, string>();
  for (const feature of ordered.filter(
    (part): part is Extract<PartSpec, { kind: 'feature' }> =>
      part.kind === 'feature'
  )) {
    const parent = feature.parentPartId === null
      ? undefined
      : canonicalByPart.get(feature.parentPartId);
    if (!parent) {
      return {
        ok: false,
        path: `parts.${feature.partId}.parentPartId`,
        message:
          `Surface feature "${feature.partId}" requires a geometric parent.`
      };
    }
    const placementIssue = validateSurfaceFeaturePlacement(
      feature,
      parent.canonical,
      environment
    );
    if (placementIssue) {
      return {
        ok: false,
        path: placementIssue.path,
        message: placementIssue.message
      };
    }
    for (const pixel of surfaceFeaturePixels(feature)) {
      const owner = featurePixelOwners.get(pixel.key);
      if (owner) {
        return {
          ok: false,
          path: `parts.${feature.partId}.anchor`,
          message:
            `Surface features "${owner}" and "${feature.partId}" ` +
            'overlap on the same generated surface pixels.'
        };
      }
      featurePixelOwners.set(pixel.key, feature.partId);
    }
  }
  return { ok: true, parts: resolved };
};
