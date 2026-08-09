import { compareStableText } from '../../stableOrder';
import type { SurfacePatternComponent } from './components';
import type {
  SurfaceAppearanceMarkingPlan,
  SurfaceAppearanceV1
} from './contract';
import {
  surfaceMarkingCanonicalPointTwice,
  surfaceMarkingContains
} from './marks';
import { appearanceSampleKey } from './sampling';

const SEMANTIC_SHARE_PERCENT = 35;

const MOTIF_CLASS: Readonly<
  Record<SurfaceAppearanceMarkingPlan['motif'], number>
> = {
  wash: 0,
  band: 1,
  stripe: 2,
  bars: 2,
  spots: 3,
  patch: 3,
  rim: 3
};

export interface GeneratedSurfaceMarkingMask {
  readonly marking: SurfaceAppearanceMarkingPlan;
  readonly keys: readonly string[];
}

interface MarkingPoint {
  readonly key: string;
  readonly u: number;
  readonly v: number;
  readonly order: readonly [number, number, number];
  readonly material: boolean;
  readonly rank: number;
}

interface ComponentStream {
  readonly points: readonly MarkingPoint[];
  index: number;
  blocked: boolean;
}

interface MarkingStream {
  readonly marking: SurfaceAppearanceMarkingPlan;
  readonly components: readonly ComponentStream[];
  componentIndex: number;
  readonly selected: Set<string>;
}

interface PendingPoint {
  readonly component: ComponentStream;
  readonly point: MarkingPoint;
}

const compareMarkings = (
  left: SurfaceAppearanceMarkingPlan,
  right: SurfaceAppearanceMarkingPlan
): number => MOTIF_CLASS[left.motif] - MOTIF_CLASS[right.motif] ||
  compareStableText(left.id, right.id);

const pointRank = (seed: number, u: number, v: number): number => {
  let hash = (
    seed ^
    Math.imul(u, 0x9e3779b1) ^
    Math.imul(v, 0x85ebca6b)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

const reflectedPointRank = (
  seed: number,
  point: readonly [number, number, number]
): number => {
  let hash = (
    seed ^
    Math.imul(point[0], 0x9e3779b1) ^
    Math.imul(point[1], 0x85ebca6b) ^
    Math.imul(point[2], 0xc2b2ae35)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

const comparePointOrder = (
  left: MarkingPoint,
  right: MarkingPoint
): number => left.order[0] - right.order[0] ||
  left.order[1] - right.order[1] ||
  left.order[2] - right.order[2];

const neighbors = (point: MarkingPoint): readonly string[] => [
  appearanceSampleKey(point.u - 1, point.v),
  appearanceSampleKey(point.u + 1, point.v),
  appearanceSampleKey(point.u, point.v - 1),
  appearanceSampleKey(point.u, point.v + 1)
];

const connectedComponents = (
  points: readonly MarkingPoint[]
): readonly (readonly MarkingPoint[])[] => {
  const byKey = new Map(points.map((point) => [point.key, point]));
  const visited = new Set<string>();
  const components: MarkingPoint[][] = [];
  for (const start of [...points].sort((left, right) =>
    comparePointOrder(left, right)
  )) {
    if (visited.has(start.key)) continue;
    const component: MarkingPoint[] = [];
    const pending = [start];
    visited.add(start.key);
    while (pending.length > 0) {
      const point = pending.pop();
      if (!point) continue;
      component.push(point);
      for (const key of neighbors(point)) {
        const neighbor = byKey.get(key);
        if (!neighbor || visited.has(key)) continue;
        visited.add(key);
        pending.push(neighbor);
      }
    }
    components.push(component);
  }
  return components;
};

const growthSeed = (
  points: readonly MarkingPoint[]
): MarkingPoint => {
  const seed = [...points].sort((left, right) =>
    left.rank - right.rank || comparePointOrder(left, right)
  )[0];
  if (!seed) throw new RangeError('A marking component cannot be empty.');
  return seed;
};

/** Every prefix is connected because all graph-distance parents sort first. */
const coherentOrder = (
  points: readonly MarkingPoint[]
): readonly MarkingPoint[] => {
  const byKey = new Map(points.map((point) => [point.key, point]));
  const distance = new Map<string, number>();
  const seed = growthSeed(points);
  const pending = [seed];
  distance.set(seed.key, 0);
  for (let index = 0; index < pending.length; index += 1) {
    const point = pending[index];
    if (!point) continue;
    const nextDistance = (distance.get(point.key) ?? 0) + 1;
    for (const key of neighbors(point)) {
      const neighbor = byKey.get(key);
      if (!neighbor || distance.has(key)) continue;
      distance.set(key, nextDistance);
      pending.push(neighbor);
    }
  }
  return [...points].sort((left, right) =>
    (distance.get(left.key) ?? 0) - (distance.get(right.key) ?? 0) ||
    Number(right.material) - Number(left.material) ||
    left.rank - right.rank ||
    comparePointOrder(left, right)
  );
};

const pointsFor = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan,
  material: ReadonlySet<string>
): readonly MarkingPoint[] => {
  const points: MarkingPoint[] = [];
  for (const span of component.occupiedSpans) {
    for (let u = span.x; u < span.x + span.width; u += 1) {
      if (!surfaceMarkingContains(appearance, marking, u, span.y)) continue;
      const key = appearanceSampleKey(u, span.y);
      const reflected = appearance.semanticRegion === 'membrane' &&
        marking.reflection !== null;
      const order = reflected
        ? surfaceMarkingCanonicalPointTwice(
            appearance,
            marking,
            u,
            span.y
          )
        : [span.y, u, 0] as const;
      points.push({
        key,
        u,
        v: span.y,
        order,
        // A reflected semantic mask cannot consume independent material-field
        // placement as an ordering input or its two sides would diverge.
        material: reflected ? false : material.has(key),
        rank: reflected
          ? reflectedPointRank(marking.maskSeed, order)
          : pointRank(marking.maskSeed, u, span.y)
      });
    }
  }
  return points;
};

const markingStream = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan,
  material: ReadonlySet<string>
): MarkingStream => ({
  marking,
  components: connectedComponents(
    pointsFor(component, appearance, marking, material)
  ).map((points) => ({
    points: coherentOrder(points),
    index: 0,
    blocked: false
  })),
  componentIndex: 0,
  selected: new Set()
});

const pendingPoint = (stream: MarkingStream): PendingPoint | null => {
  for (let offset = 0; offset < stream.components.length; offset += 1) {
    const index = (stream.componentIndex + offset) % stream.components.length;
    const component = stream.components[index];
    const point = component?.points[component.index];
    if (!component || component.blocked || !point) continue;
    stream.componentIndex = (index + 1) % stream.components.length;
    return { component, point };
  }
  return null;
};

const maximumCombinedCoverage = (texelCount: number): number =>
  Math.max(0, Math.ceil(texelCount / 2) - 1);

const composedMasks = (
  streams: readonly MarkingStream[],
  semantic: ReadonlySet<string>
): readonly GeneratedSurfaceMarkingMask[] => {
  const keysByMarking = new Map(streams.map((stream) => [
    stream.marking.id,
    [] as string[]
  ]));
  for (const key of semantic) {
    let selected: MarkingStream | undefined;
    for (const stream of streams) {
      if (stream.selected.has(key)) selected = stream;
    }
    if (selected) keysByMarking.get(selected.marking.id)?.push(key);
  }
  return Object.freeze(streams.flatMap((stream) => {
    const keys = keysByMarking.get(stream.marking.id) ?? [];
    return keys.length === 0 ? [] : [Object.freeze({
      marking: stream.marking,
      keys: Object.freeze(keys.sort(compareStableText))
    })];
  }));
};

/**
 * Applies exact component-wide budgets through coherent analytic-mask growth.
 * A selected component is always a connected prefix of the original motif;
 * no post-composition per-texel thinning can create salt-and-pepper holes.
 */
export const buildSurfaceMarkingMasks = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1,
  materialKeys: readonly string[]
): readonly GeneratedSurfaceMarkingMask[] | undefined => {
  if (appearance.markings === undefined) return undefined;
  const markings = [...appearance.markings].sort(compareMarkings);
  if (markings.length === 0 || component.texelCount === 0) {
    return Object.freeze([]);
  }
  const material = new Set(materialKeys);
  const streams = markings.map((marking) => markingStream(
    component,
    appearance,
    marking,
    material
  ));
  const semanticLimit = Math.floor(
    component.texelCount * SEMANTIC_SHARE_PERCENT / 100
  );
  const nonMaterialLimit = Math.max(
    0,
    maximumCombinedCoverage(component.texelCount) - material.size
  );
  const semantic = new Set<string>();
  const nonMaterial = new Set<string>();
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const stream of streams) {
      const pending = pendingPoint(stream);
      if (!pending) continue;
      const isNew = !semantic.has(pending.point.key);
      const isNewNonMaterial = isNew && !pending.point.material;
      if (
        (isNew && semantic.size >= semanticLimit) ||
        (isNewNonMaterial && nonMaterial.size >= nonMaterialLimit)
      ) {
        pending.component.blocked = true;
        progressed = true;
        continue;
      }
      pending.component.index += 1;
      stream.selected.add(pending.point.key);
      semantic.add(pending.point.key);
      if (!pending.point.material) nonMaterial.add(pending.point.key);
      progressed = true;
    }
  }
  return composedMasks(streams, semantic);
};

const includesSorted = (entries: readonly string[], key: string): boolean => {
  let minimum = 0;
  let maximum = entries.length - 1;
  while (minimum <= maximum) {
    const index = Math.floor((minimum + maximum) / 2);
    const candidate = entries[index];
    if (candidate === key) return true;
    if (candidate !== undefined && candidate < key) minimum = index + 1;
    else maximum = index - 1;
  }
  return false;
};

export const selectedSurfaceMarkingAt = (
  masks: readonly GeneratedSurfaceMarkingMask[],
  u: number,
  v: number
): SurfaceAppearanceMarkingPlan | null => {
  const key = appearanceSampleKey(u, v);
  return masks.find((mask) => includesSorted(mask.keys, key))?.marking ?? null;
};
