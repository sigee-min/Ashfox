import { compareStableText } from '../../stableOrder';
import type { SurfacePatternComponent } from './components';
import type { AppearanceToneSample } from './sampling';

interface BoundaryFlags {
  readonly left: boolean;
  readonly right: boolean;
  readonly top: boolean;
  readonly bottom: boolean;
}

interface RankedSample {
  readonly rank: number;
  readonly sample: AppearanceToneSample;
}

class RankHeap {
  readonly #items: RankedSample[] = [];

  get size(): number {
    return this.#items.length;
  }

  push(entry: RankedSample): void {
    this.#items.push(entry);
    let index = this.#items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentEntry = this.#items[parent];
      if (!parentEntry || parentEntry.rank <= entry.rank) break;
      this.#items[index] = parentEntry;
      index = parent;
    }
    this.#items[index] = entry;
  }

  pop(): RankedSample | undefined {
    const first = this.#items[0];
    const last = this.#items.pop();
    if (!first || !last || this.#items.length === 0) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.#items.length) break;
      const leftEntry = this.#items[left];
      const rightEntry = this.#items[right];
      const child = rightEntry && leftEntry && rightEntry.rank < leftEntry.rank
        ? right
        : left;
      const childEntry = this.#items[child];
      if (!childEntry || childEntry.rank >= last.rank) break;
      this.#items[index] = childEntry;
      index = child;
    }
    this.#items[index] = last;
    return first;
  }
}

const neighborKeys = (sample: AppearanceToneSample): readonly string[] => [
  `${sample.u - 1},${sample.v}`,
  `${sample.u + 1},${sample.v}`,
  `${sample.u},${sample.v - 1}`,
  `${sample.u},${sample.v + 1}`
];

const flagsFor = (
  sample: AppearanceToneSample,
  bounds: SurfacePatternComponent['bounds']
): BoundaryFlags => ({
  left: sample.u === bounds.x,
  right: sample.u === bounds.x + bounds.width - 1,
  top: sample.v === bounds.y,
  bottom: sample.v === bounds.y + bounds.height - 1
});

const mergedFlags = (
  flags: BoundaryFlags,
  sample: AppearanceToneSample,
  bounds: SurfacePatternComponent['bounds']
): BoundaryFlags => {
  const next = flagsFor(sample, bounds);
  return {
    left: flags.left || next.left,
    right: flags.right || next.right,
    top: flags.top || next.top,
    bottom: flags.bottom || next.bottom
  };
};

const bridgesOppositeBoundaries = (
  flags: BoundaryFlags,
  bounds: SurfacePatternComponent['bounds']
): boolean => (
  bounds.width > 1 && flags.left && flags.right
) || (
  bounds.height > 1 && flags.top && flags.bottom
);

const orderedSamples = (
  samples: readonly AppearanceToneSample[],
  descending: boolean
): readonly AppearanceToneSample[] => [...samples].sort((left, right) =>
  (descending ? right.score - left.score : left.score - right.score) ||
  left.v - right.v ||
  left.u - right.u
);

const selectRole = (
  ordered: readonly AppearanceToneSample[],
  target: number,
  blocked: ReadonlySet<string>,
  component: SurfacePatternComponent
): ReadonlySet<string> => {
  if (target === 0) return new Set();
  const byKey = new Map(ordered.map((sample) => [sample.key, sample]));
  const rankByKey = new Map(ordered.map((sample, rank) => [sample.key, rank]));
  const selected = new Set<string>();
  const maximumCluster = Math.max(1, Math.floor(component.texelCount * 0.2));
  let seedIndex = 0;

  while (selected.size < target) {
    let seed: AppearanceToneSample | undefined;
    while (seedIndex < ordered.length) {
      const candidate = ordered[seedIndex];
      seedIndex += 1;
      if (
        candidate &&
        !blocked.has(candidate.key) &&
        !selected.has(candidate.key) &&
        neighborKeys(candidate).every((key) => !selected.has(key))
      ) {
        seed = candidate;
        break;
      }
    }
    if (!seed) break;

    const island = new Set<string>([seed.key]);
    selected.add(seed.key);
    let flags = flagsFor(seed, component.bounds);
    const heap = new RankHeap();
    const queued = new Set<string>();
    const queueNeighbors = (sample: AppearanceToneSample): void => {
      for (const key of neighborKeys(sample)) {
        const neighbor = byKey.get(key);
        const rank = rankByKey.get(key);
        if (
          !neighbor ||
          rank === undefined ||
          blocked.has(key) ||
          selected.has(key) ||
          queued.has(key)
        ) continue;
        queued.add(key);
        heap.push({ rank, sample: neighbor });
      }
    };
    queueNeighbors(seed);

    const islandTarget = Math.min(
      maximumCluster,
      island.size + target - selected.size
    );
    while (island.size < islandTarget && heap.size > 0) {
      const entry = heap.pop();
      const candidate = entry?.sample;
      if (!candidate || selected.has(candidate.key)) continue;
      if (neighborKeys(candidate).some((key) =>
        selected.has(key) && !island.has(key)
      )) continue;
      const nextFlags = mergedFlags(flags, candidate, component.bounds);
      if (bridgesOppositeBoundaries(nextFlags, component.bounds)) continue;
      selected.add(candidate.key);
      island.add(candidate.key);
      flags = nextFlags;
      queueNeighbors(candidate);
    }
  }
  return selected;
};

export interface AppearanceRoleKeys {
  readonly shadow: readonly string[];
  readonly light: readonly string[];
}

export const selectAppearanceRoleKeys = (
  samples: readonly AppearanceToneSample[],
  shadowTarget: number,
  lightTarget: number,
  protectedKeys: ReadonlySet<string>,
  component: SurfacePatternComponent
): AppearanceRoleKeys => {
  const shadow = selectRole(
    orderedSamples(samples, false),
    shadowTarget,
    protectedKeys,
    component
  );
  const byKey = new Map(samples.map((sample) => [sample.key, sample]));
  const lightBlocked = new Set(protectedKeys);
  for (const key of shadow) {
    lightBlocked.add(key);
    const sample = byKey.get(key);
    if (sample) neighborKeys(sample).forEach((neighbor) =>
      lightBlocked.add(neighbor)
    );
  }
  const light = selectRole(
    orderedSamples(samples, true),
    lightTarget,
    lightBlocked,
    component
  );
  return {
    shadow: Object.freeze([...shadow].sort(compareStableText)),
    light: Object.freeze([...light].sort(compareStableText))
  };
};
