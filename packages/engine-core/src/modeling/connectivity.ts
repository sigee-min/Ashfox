import {
  assertDensity,
  cellKey,
  comparePoints,
  parseCellKey,
  sortCells
} from './lattice';
import type { LatticePoint, OccupancyGrid } from './contract';

const SIX_NEIGHBOR_OFFSETS: readonly LatticePoint[] = [
  { x: -1, y: 0, z: 0 },
  { x: 0, y: -1, z: 0 },
  { x: 0, y: 0, z: -1 },
  { x: 0, y: 0, z: 1 },
  { x: 0, y: 1, z: 0 },
  { x: 1, y: 0, z: 0 }
];

export const findSixConnectedComponents = (
  grid: OccupancyGrid
): readonly (readonly LatticePoint[])[] => {
  assertDensity(grid.density);
  const unseen = new Set(grid.cells);
  const components: LatticePoint[][] = [];

  for (const seed of sortCells(grid.cells)) {
    const seedKey = cellKey(seed);
    if (!unseen.delete(seedKey)) {
      continue;
    }

    const queue: LatticePoint[] = [seed];
    const component: LatticePoint[] = [];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const current = queue[cursor];
      component.push(current);
      for (const offset of SIX_NEIGHBOR_OFFSETS) {
        const neighbor = {
          x: current.x + offset.x,
          y: current.y + offset.y,
          z: current.z + offset.z
        };
        const neighborKey = cellKey(neighbor);
        if (unseen.delete(neighborKey)) {
          queue.push(neighbor);
        }
      }
    }
    component.sort(comparePoints);
    components.push(component);
  }

  return components;
};

export const isSixConnected = (grid: OccupancyGrid): boolean =>
  grid.cells.size > 0 && findSixConnectedComponents(grid).length === 1;

export const componentCellKeys = (
  component: readonly LatticePoint[]
): readonly string[] =>
  component
    .map(cellKey)
    .sort((left, right) =>
      comparePoints(parseCellKey(left), parseCellKey(right))
    );
