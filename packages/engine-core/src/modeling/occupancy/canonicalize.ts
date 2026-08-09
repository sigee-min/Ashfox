import { compareStableText } from '../../stableOrder';
import { isSixConnected } from '../connectivity';
import {
  parseCellKey
} from '../lattice';
import {
  isGeometryPartSpec,
  type GeometryPartSpec,
  type PartSpec
} from '../part';
import {
  compileSemanticPartCuboids,
  occupancyForCuboids,
  subtractCuboidsForSeamOwnership
} from '../cuboid/grammar';
import type {
  CellKey,
  Cuboid,
  SurfacePixelDensity
} from '../contract';
import {
  PART_OCCUPANCY_POLICY,
  type CanonicalizationFailure,
  type CanonicalPartOccupancy
} from './contract';

const compareParts = (left: PartSpec, right: PartSpec): number =>
  compareStableText(left.partId, right.partId);

const pushReadyPart = (ready: PartSpec[], part: PartSpec): void => {
  let index = ready.length;
  ready.push(part);
  while (index > 0) {
    const parentIndex = Math.floor((index - 1) / 2);
    const parent = ready[parentIndex]!;
    if (compareParts(parent, part) <= 0) break;
    ready[index] = parent;
    index = parentIndex;
  }
  ready[index] = part;
};

const popReadyPart = (ready: PartSpec[]): PartSpec | undefined => {
  const first = ready[0];
  const last = ready.pop();
  if (!first || !last || ready.length === 0) return first;
  let index = 0;
  while (true) {
    const leftIndex = index * 2 + 1;
    if (leftIndex >= ready.length) break;
    const rightIndex = leftIndex + 1;
    const childIndex = rightIndex < ready.length &&
      compareParts(ready[rightIndex]!, ready[leftIndex]!) < 0
      ? rightIndex
      : leftIndex;
    const child = ready[childIndex]!;
    if (compareParts(last, child) <= 0) break;
    ready[index] = child;
    index = childIndex;
  }
  ready[index] = last;
  return first;
};

/** Stable parent-before-child order without repeated full scans or sorts. */
export const canonicalPartOrder = (
  parts: readonly PartSpec[]
): readonly PartSpec[] | null => {
  const ids = new Set<string>();
  for (const part of parts) {
    if (ids.has(part.partId)) return null;
    ids.add(part.partId);
  }

  const childrenByParent = new Map<string, PartSpec[]>();
  const ready: PartSpec[] = [];
  for (const part of parts) {
    const parentPartId = part.parentPartId;
    if (parentPartId === null) {
      pushReadyPart(ready, part);
      continue;
    }
    if (!ids.has(parentPartId)) return null;
    const children = childrenByParent.get(parentPartId);
    if (children) children.push(part);
    else childrenByParent.set(parentPartId, [part]);
  }

  const ordered: PartSpec[] = [];
  while (ready.length > 0) {
    const next = popReadyPart(ready);
    if (!next) break;
    ordered.push(next);
    const children = childrenByParent.get(next.partId);
    if (!children) continue;
    for (const child of children) pushReadyPart(ready, child);
  }
  return ordered.length === parts.length ? ordered : null;
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
    const key = queue[cursor]!;
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
    if (owner === undefined) retainedKeys.push(key);
    else {
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

export const canonicalizeGeometry = (
  ordered: readonly PartSpec[],
  density: SurfacePixelDensity
): readonly CanonicalPartOccupancy[] | CanonicalizationFailure => {
  const ownerByCell = new Map<CellKey, string>();
  const ownedCuboids: Cuboid[] = [];
  const canonical: CanonicalPartOccupancy[] = [];
  for (const spec of ordered) {
    if (!isGeometryPartSpec(spec)) continue;
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
