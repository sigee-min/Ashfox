import type { IntentProgramModule } from '../types';

interface MutableGraphMetrics {
  edges: number;
  pushes: number;
  pops: number;
  comparisons: number;
}

export interface IntentProgramBodyGraph {
  readonly order: readonly IntentProgramModule[];
  readonly cyclic: readonly IntentProgramModule[];
  readonly edges: number;
  readonly heapPushes: number;
  readonly heapPops: number;
  readonly heapComparisons: number;
}

class StableIndexHeap {
  readonly #values: number[] = [];
  readonly #metrics: MutableGraphMetrics;
  readonly #before: (left: number, right: number) => boolean;

  constructor(
    metrics: MutableGraphMetrics,
    before: (left: number, right: number) => boolean
  ) {
    this.#metrics = metrics;
    this.#before = before;
  }

  private before(left: number, right: number): boolean {
    this.#metrics.comparisons += 1;
    return this.#before(left, right);
  }

  push(value: number): void {
    this.#metrics.pushes += 1;
    const values = this.#values;
    values.push(value);
    let index = values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      const parentValue = values[parent];
      if (parentValue === undefined || !this.before(value, parentValue)) break;
      values[index] = parentValue;
      index = parent;
    }
    values[index] = value;
  }

  pop(): number | undefined {
    const values = this.#values;
    const first = values[0];
    const tail = values.pop();
    if (first === undefined) return undefined;
    this.#metrics.pops += 1;
    if (values.length === 0 || tail === undefined) return first;
    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      if (left >= values.length) break;
      const right = left + 1;
      const next = right < values.length && this.before(values[right]!, values[left]!)
        ? right
        : left;
      const nextValue = values[next];
      if (nextValue === undefined || !this.before(nextValue, tail)) break;
      values[index] = nextValue;
      index = next;
    }
    values[index] = tail;
    return first;
  }
}

/**
 * Kahn's residual includes descendants whose parents are cyclic. Follow the
 * single parent edge instead so only nodes inside a parent cycle are marked.
 */
const findCycleMembers = (
  parentIndexes: Int32Array,
  indegree: readonly number[]
): Uint8Array => {
  const states = new Uint8Array(parentIndexes.length);
  const positions = new Int32Array(parentIndexes.length);
  positions.fill(-1);
  const members = new Uint8Array(parentIndexes.length);

  for (let start = 0; start < parentIndexes.length; start += 1) {
    if (indegree[start] === 0 || states[start] !== 0) continue;
    const path: number[] = [];
    let current = start;
    while (
      current >= 0 &&
      indegree[current] !== 0 &&
      states[current] === 0
    ) {
      states[current] = 1;
      positions[current] = path.length;
      path.push(current);
      current = parentIndexes[current] ?? -1;
    }
    if (
      current >= 0 &&
      indegree[current] !== 0 &&
      states[current] === 1
    ) {
      const cycleStart = positions[current] ?? -1;
      for (let index = cycleStart; index >= 0 && index < path.length; index += 1) {
        const member = path[index];
        if (member !== undefined) members[member] = 1;
      }
    }
    for (const index of path) {
      states[index] = 2;
      positions[index] = -1;
    }
  }
  return members;
};

/** Stable Kahn traversal. Every module and graph edge is indexed once. */
export const resolveIntentProgramBodyGraph = (
  body: readonly IntentProgramModule[],
  moduleIndex: ReadonlyMap<string, number>
): IntentProgramBodyGraph => {
  const indegree = new Array<number>(body.length).fill(0);
  const parentIndexes = new Int32Array(body.length);
  parentIndexes.fill(-1);
  const children = new Map<number, number[]>();
  const metrics: MutableGraphMetrics = {
    edges: 0, pushes: 0, pops: 0, comparisons: 0
  };

  body.forEach((module, index) => {
    if (module.kind === 'core') return;
    const parentIndex = moduleIndex.get(module.parent);
    if (parentIndex === undefined) return;
    parentIndexes[index] = parentIndex;
    indegree[index] = 1;
    const siblings = children.get(parentIndex);
    if (siblings) siblings.push(index);
    else children.set(parentIndex, [index]);
    metrics.edges += 1;
  });

  const heap = new StableIndexHeap(metrics, (left, right) => {
    const leftId = body[left]?.id ?? '';
    const rightId = body[right]?.id ?? '';
    return leftId < rightId || (leftId === rightId && left < right);
  });
  indegree.forEach((value, index) => {
    if (value === 0) heap.push(index);
  });

  const order: IntentProgramModule[] = [];
  while (true) {
    const index = heap.pop();
    if (index === undefined) break;
    const module = body[index];
    if (module) order.push(module);
    for (const child of children.get(index) ?? []) {
      indegree[child] -= 1;
      if (indegree[child] === 0) heap.push(child);
    }
  }

  const cycleMembers = findCycleMembers(parentIndexes, indegree);
  const cyclic = body.filter((_, index) => cycleMembers[index] === 1);
  return {
    order,
    cyclic,
    edges: metrics.edges,
    heapPushes: metrics.pushes,
    heapPops: metrics.pops,
    heapComparisons: metrics.comparisons
  };
};
