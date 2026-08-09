import { compareStableText } from '../../stableOrder';

/** Canonical coplanar component ownership for generated appearance fields. */
export interface SurfacePatternDraft {
  readonly id: string;
  readonly ownerKey: string;
  readonly groupKey: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SurfacePatternComponent {
  readonly seedKey: string;
  readonly bounds: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  };
  readonly occupiedSpans: readonly SurfacePatternSpan[];
  readonly texelCount: number;
}

export interface SurfacePatternSpan {
  readonly y: number;
  readonly x: number;
  readonly width: number;
}

interface Edge {
  index: number;
  minimum: number;
  maximum: number;
}

const positiveOverlap = (
  left: Edge,
  right: Edge
): boolean =>
  Math.max(left.minimum, right.minimum) <
  Math.min(left.maximum, right.maximum);

const orderedEdges = (
  edges: readonly Edge[]
): Edge[] =>
  [...edges].sort(
    (left, right) =>
      left.minimum - right.minimum ||
      left.maximum - right.maximum ||
      left.index - right.index
  );

const unionOverlappingEdges = (
  edges: readonly Edge[],
  sets: DisjointSet
): void => {
  const ordered = orderedEdges(edges);
  let representative = ordered[0];
  let maximum = representative?.maximum ?? Number.NEGATIVE_INFINITY;
  for (const edge of ordered.slice(1)) {
    if (edge.minimum < maximum && representative) {
      sets.union(representative.index, edge.index);
      maximum = Math.max(maximum, edge.maximum);
      continue;
    }
    representative = edge;
    maximum = edge.maximum;
  }
};

class DisjointSet {
  private readonly parents: number[];

  constructor(size: number) {
    this.parents = Array.from({ length: size }, (_, index) => index);
  }

  find(index: number): number {
    const parent = this.parents[index];
    if (parent === index) return index;
    const root = this.find(parent);
    this.parents[index] = root;
    return root;
  }

  union(left: number, right: number): void {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;
    this.parents[Math.max(leftRoot, rightRoot)] =
      Math.min(leftRoot, rightRoot);
  }
}

const appendEdge = (
  edges: Map<number, Edge[]>,
  coordinate: number,
  edge: Edge
): void => {
  const entries = edges.get(coordinate) ?? [];
  entries.push(edge);
  edges.set(coordinate, entries);
};

const unionOppositeEdges = (
  first: ReadonlyMap<number, readonly Edge[]>,
  second: ReadonlyMap<number, readonly Edge[]>,
  sets: DisjointSet
): void => {
  for (const [coordinate, leftEdges] of first) {
    const rightEdges = second.get(coordinate);
    if (!rightEdges) continue;
    unionOverlappingEdges(leftEdges, sets);
    unionOverlappingEdges(rightEdges, sets);
    const orderedLeft = orderedEdges(leftEdges);
    const orderedRight = orderedEdges(rightEdges);
    let leftIndex = 0;
    let rightIndex = 0;
    while (
      leftIndex < orderedLeft.length &&
      rightIndex < orderedRight.length
    ) {
      const left = orderedLeft[leftIndex];
      const right = orderedRight[rightIndex];
      if (positiveOverlap(left, right)) {
        sets.union(left.index, right.index);
      }
      if (left.maximum <= right.maximum) leftIndex += 1;
      if (right.maximum <= left.maximum) rightIndex += 1;
    }
  }
};

const connectGroup = (
  drafts: readonly SurfacePatternDraft[],
  indexes: readonly number[],
  sets: DisjointSet
): void => {
  const left = new Map<number, Edge[]>();
  const right = new Map<number, Edge[]>();
  const top = new Map<number, Edge[]>();
  const bottom = new Map<number, Edge[]>();

  for (const index of indexes) {
    const draft = drafts[index];
    const maximumX = draft.x + draft.width;
    const maximumY = draft.y + draft.height;
    appendEdge(left, draft.x, {
      index,
      minimum: draft.y,
      maximum: maximumY
    });
    appendEdge(right, maximumX, {
      index,
      minimum: draft.y,
      maximum: maximumY
    });
    appendEdge(top, draft.y, {
      index,
      minimum: draft.x,
      maximum: maximumX
    });
    appendEdge(bottom, maximumY, {
      index,
      minimum: draft.x,
      maximum: maximumX
    });
  }

  unionOppositeEdges(left, right, sets);
  unionOppositeEdges(top, bottom, sets);
};

interface HorizontalInterval {
  minimum: number;
  maximum: number;
}

const appendInterval = (
  rows: Map<number, HorizontalInterval[]>,
  y: number,
  interval: HorizontalInterval
): void => {
  const intervals = rows.get(y) ?? [];
  intervals.push(interval);
  rows.set(y, intervals);
};

const occupiedSurfaceSpans = (
  members: readonly SurfacePatternDraft[]
): readonly SurfacePatternSpan[] => {
  const rows = new Map<number, HorizontalInterval[]>();
  for (const member of members) {
    for (let y = member.y; y < member.y + member.height; y += 1) {
      appendInterval(rows, y, {
        minimum: member.x,
        maximum: member.x + member.width
      });
    }
  }
  const spans: SurfacePatternSpan[] = [];
  for (const [y, intervals] of [...rows].sort(
    ([left], [right]) => left - right
  )) {
    const ordered = [...intervals].sort(
      (left, right) =>
        left.minimum - right.minimum ||
        left.maximum - right.maximum
    );
    let active = ordered[0];
    if (!active) continue;
    for (const interval of ordered.slice(1)) {
      if (interval.minimum <= active.maximum) {
        active = {
          minimum: active.minimum,
          maximum: Math.max(active.maximum, interval.maximum)
        };
        continue;
      }
      spans.push({
        y,
        x: active.minimum,
        width: active.maximum - active.minimum
      });
      active = interval;
    }
    spans.push({
      y,
      x: active.minimum,
      width: active.maximum - active.minimum
    });
  }
  return spans;
};

export const buildSurfacePatternComponents = (
  drafts: readonly SurfacePatternDraft[]
): ReadonlyMap<string, SurfacePatternComponent> => {
  const sets = new DisjointSet(drafts.length);
  const indexesByGroup = new Map<string, number[]>();

  drafts.forEach((draft, index) => {
    const indexes = indexesByGroup.get(draft.groupKey) ?? [];
    indexes.push(index);
    indexesByGroup.set(draft.groupKey, indexes);
  });
  for (const indexes of indexesByGroup.values()) {
    connectGroup(drafts, indexes, sets);
  }

  const indexesByComponent = new Map<number, number[]>();
  drafts.forEach((_, index) => {
    const root = sets.find(index);
    const indexes = indexesByComponent.get(root) ?? [];
    indexes.push(index);
    indexesByComponent.set(root, indexes);
  });

  const components = new Map<string, SurfacePatternComponent>();
  for (const indexes of indexesByComponent.values()) {
    const members = indexes.map((index) => drafts[index]);
    const first = members[0];
    if (!first) continue;
    let minimumX = first.x;
    let minimumY = first.y;
    let maximumX = first.x + first.width;
    let maximumY = first.y + first.height;
    for (const member of members.slice(1)) {
      minimumX = Math.min(minimumX, member.x);
      minimumY = Math.min(minimumY, member.y);
      maximumX = Math.max(maximumX, member.x + member.width);
      maximumY = Math.max(maximumY, member.y + member.height);
    }
    const groupKey = first.groupKey;
    const ownerKey = [...new Set(
      members.map((member) => member.ownerKey)
    )].sort(compareStableText).join('|');
    const bounds = Object.freeze({
      x: minimumX,
      y: minimumY,
      width: maximumX - minimumX,
      height: maximumY - minimumY
    });
    const occupiedSpans = Object.freeze(
      occupiedSurfaceSpans(members).map((span) => Object.freeze({ ...span }))
    );
    const component = Object.freeze({
      seedKey:
        `${groupKey}:${ownerKey}:${minimumX},${minimumY}:` +
        `${bounds.width}x${bounds.height}`,
      bounds,
      occupiedSpans,
      texelCount: occupiedSpans.reduce(
        (count, span) => count + span.width,
        0
      )
    });
    for (const member of members) {
      components.set(member.id, component);
    }
  }
  return components;
};
