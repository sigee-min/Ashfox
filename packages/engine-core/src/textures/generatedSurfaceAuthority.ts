import {
  CUBE_FACE_DIRECTIONS,
  type CubeFaceDirection,
  type CubeNode,
  type ProjectDocument
} from '../model';
import {
  cellKey,
  worldToLattice
} from '../modeling/lattice';
import {
  PART_CONTRACT_LIMITS
} from '../modeling/partContract';
import type {
  LatticeBounds,
  LatticePoint
} from '../modeling/types';

export interface GeneratedSurfacePattern {
  seedKey: string;
  origin: readonly [number, number];
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface CompiledFaceAuthority {
  external: boolean;
  pattern?: GeneratedSurfacePattern;
}

export interface CompiledSurfaceAuthority {
  faces: ReadonlyMap<string, CompiledFaceAuthority>;
  nodeIds: ReadonlySet<string>;
}

export interface GeneratedSurfaceGrid {
  texelsPerModelUnit: number;
  faceSize: (
    cube: CubeNode,
    direction: CubeFaceDirection
  ) => { width: number; height: number } | null;
}

interface PatternDraft {
  faceKey: string;
  seedKey: string;
  origin: readonly [number, number];
  width: number;
  height: number;
}

export const generatedSurfaceFaceKey = (
  nodeId: string,
  direction: CubeFaceDirection
): string => `${nodeId}:${direction}`;

const compiledLatticeBounds = (
  document: ProjectDocument,
  cube: CubeNode
): LatticeBounds | null => {
  try {
    const density = document.settings.surfacePixelDensity;
    return {
      min: {
        x: worldToLattice(cube.bounds.from[0], density),
        y: worldToLattice(cube.bounds.from[1], density),
        z: worldToLattice(cube.bounds.from[2], density)
      },
      max: {
        x: worldToLattice(cube.bounds.to[0], density),
        y: worldToLattice(cube.bounds.to[1], density),
        z: worldToLattice(cube.bounds.to[2], density)
      }
    };
  } catch {
    return null;
  }
};

const boundsVolume = (bounds: LatticeBounds): number =>
  (bounds.max.x - bounds.min.x) *
  (bounds.max.y - bounds.min.y) *
  (bounds.max.z - bounds.min.z);

const addBoundsCells = (
  bounds: LatticeBounds,
  occupancy: Set<string>
): void => {
  for (let x = bounds.min.x; x < bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y < bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z < bounds.max.z; z += 1) {
        occupancy.add(cellKey({ x, y, z }));
      }
    }
  }
};

const faceCellRanges = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection
): {
  firstAxis: 'x' | 'y' | 'z';
  firstMin: number;
  firstMax: number;
  secondAxis: 'x' | 'y' | 'z';
  secondMin: number;
  secondMax: number;
  boundary: LatticePoint;
  neighbor: LatticePoint;
} => {
  switch (direction) {
    case 'north':
      return {
        firstAxis: 'x',
        firstMin: bounds.min.x,
        firstMax: bounds.max.x,
        secondAxis: 'y',
        secondMin: bounds.min.y,
        secondMax: bounds.max.y,
        boundary: { x: 0, y: 0, z: bounds.min.z },
        neighbor: { x: 0, y: 0, z: -1 }
      };
    case 'south':
      return {
        firstAxis: 'x',
        firstMin: bounds.min.x,
        firstMax: bounds.max.x,
        secondAxis: 'y',
        secondMin: bounds.min.y,
        secondMax: bounds.max.y,
        boundary: { x: 0, y: 0, z: bounds.max.z - 1 },
        neighbor: { x: 0, y: 0, z: 1 }
      };
    case 'east':
      return {
        firstAxis: 'z',
        firstMin: bounds.min.z,
        firstMax: bounds.max.z,
        secondAxis: 'y',
        secondMin: bounds.min.y,
        secondMax: bounds.max.y,
        boundary: { x: bounds.max.x - 1, y: 0, z: 0 },
        neighbor: { x: 1, y: 0, z: 0 }
      };
    case 'west':
      return {
        firstAxis: 'z',
        firstMin: bounds.min.z,
        firstMax: bounds.max.z,
        secondAxis: 'y',
        secondMin: bounds.min.y,
        secondMax: bounds.max.y,
        boundary: { x: bounds.min.x, y: 0, z: 0 },
        neighbor: { x: -1, y: 0, z: 0 }
      };
    case 'up':
      return {
        firstAxis: 'x',
        firstMin: bounds.min.x,
        firstMax: bounds.max.x,
        secondAxis: 'z',
        secondMin: bounds.min.z,
        secondMax: bounds.max.z,
        boundary: { x: 0, y: bounds.max.y - 1, z: 0 },
        neighbor: { x: 0, y: 1, z: 0 }
      };
    case 'down':
      return {
        firstAxis: 'x',
        firstMin: bounds.min.x,
        firstMax: bounds.max.x,
        secondAxis: 'z',
        secondMin: bounds.min.z,
        secondMax: bounds.max.z,
        boundary: { x: 0, y: bounds.min.y, z: 0 },
        neighbor: { x: 0, y: -1, z: 0 }
      };
  }
};

const faceIsExternal = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection,
  occupancy: ReadonlySet<string>
): boolean => {
  // CubeFace owns one rectangular UV. A partially covered face must remain
  // enabled; only a face whose every boundary cell has a neighbor is hidden.
  const ranges = faceCellRanges(bounds, direction);
  for (
    let first = ranges.firstMin;
    first < ranges.firstMax;
    first += 1
  ) {
    for (
      let second = ranges.secondMin;
      second < ranges.secondMax;
      second += 1
    ) {
      const boundary = { ...ranges.boundary };
      boundary[ranges.firstAxis] = first;
      boundary[ranges.secondAxis] = second;
      if (
        !occupancy.has(
          cellKey({
            x: boundary.x + ranges.neighbor.x,
            y: boundary.y + ranges.neighbor.y,
            z: boundary.z + ranges.neighbor.z
          })
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

const facePlane = (
  bounds: LatticeBounds,
  direction: CubeFaceDirection
): number => {
  switch (direction) {
    case 'north':
      return bounds.min.z;
    case 'south':
      return bounds.max.z;
    case 'east':
      return bounds.max.x;
    case 'west':
      return bounds.min.x;
    case 'up':
      return bounds.max.y;
    case 'down':
      return bounds.min.y;
  }
};

const patternOrigin = (
  cube: CubeNode,
  direction: CubeFaceDirection,
  texelsPerModelUnit: number
): readonly [number, number] => {
  const from = cube.bounds.from.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  const to = cube.bounds.to.map((value) =>
    Math.round(value * texelsPerModelUnit)
  );
  switch (direction) {
    case 'north':
      return [1 - to[0], 1 - to[1]];
    case 'south':
      return [from[0], 1 - to[1]];
    case 'east':
      return [1 - to[2], 1 - to[1]];
    case 'west':
      return [from[2], 1 - to[1]];
    case 'up':
      return [from[0], from[2]];
    case 'down':
      return [from[0], 1 - to[2]];
  }
};

const emptyAuthority = (
  nodeIds: ReadonlySet<string> = new Set()
): CompiledSurfaceAuthority => ({
  faces: new Map(),
  nodeIds
});

export const buildCompiledSurfaceAuthority = (
  document: ProjectDocument,
  grid: GeneratedSurfaceGrid
): CompiledSurfaceAuthority => {
  const cubes = Object.values(document.scene.nodes).filter(
    (node): node is CubeNode =>
      node.kind === 'cube' &&
      node.generation?.authority === 'ashfox.part-compiler' &&
      node.generation.role === 'geometry'
  );
  if (cubes.length === 0) return emptyAuthority();
  const nodeIds = new Set(cubes.map((cube) => cube.id));

  const boundsByNode = new Map<string, LatticeBounds>();
  const occupancy = new Set<string>();
  let cellCount = 0;
  for (const cube of cubes) {
    const bounds = compiledLatticeBounds(document, cube);
    if (!bounds) return emptyAuthority(nodeIds);
    const spans = [
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z
    ];
    const volume = boundsVolume(bounds);
    if (
      spans.some(
        (span) =>
          span <= 0 ||
          span > PART_CONTRACT_LIMITS.maxAxisSpan
      ) ||
      !Number.isSafeInteger(volume) ||
      cellCount + volume >
        PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument
    ) {
      return emptyAuthority(nodeIds);
    }
    cellCount += volume;
    boundsByNode.set(cube.id, bounds);
    addBoundsCells(bounds, occupancy);
  }

  const faces = new Map<string, CompiledFaceAuthority>();
  const drafts: PatternDraft[] = [];
  for (const cube of cubes) {
    const bounds = boundsByNode.get(cube.id);
    const generation = cube.generation;
    if (!bounds || !generation) continue;
    for (const direction of CUBE_FACE_DIRECTIONS) {
      const key = generatedSurfaceFaceKey(cube.id, direction);
      const external = faceIsExternal(bounds, direction, occupancy);
      faces.set(key, { external });
      if (!external) continue;
      const size = grid.faceSize(cube, direction);
      if (!size) continue;
      const seedKey = [
        generation.partId,
        generation.materialId,
        direction,
        facePlane(bounds, direction)
      ].join(':');
      drafts.push({
        faceKey: key,
        seedKey,
        origin: patternOrigin(
          cube,
          direction,
          grid.texelsPerModelUnit
        ),
        width: size.width,
        height: size.height
      });
    }
  }

  const boundsBySeed = new Map<string, {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }>();
  for (const draft of drafts) {
    const current = boundsBySeed.get(draft.seedKey);
    boundsBySeed.set(draft.seedKey, {
      minX: Math.min(current?.minX ?? Infinity, draft.origin[0]),
      minY: Math.min(current?.minY ?? Infinity, draft.origin[1]),
      maxX: Math.max(
        current?.maxX ?? -Infinity,
        draft.origin[0] + draft.width
      ),
      maxY: Math.max(
        current?.maxY ?? -Infinity,
        draft.origin[1] + draft.height
      )
    });
  }
  for (const draft of drafts) {
    const surfaceBounds = boundsBySeed.get(draft.seedKey);
    if (!surfaceBounds) continue;
    faces.set(draft.faceKey, {
      external: true,
      pattern: {
        seedKey: draft.seedKey,
        origin: draft.origin,
        bounds: {
          x: surfaceBounds.minX,
          y: surfaceBounds.minY,
          width: surfaceBounds.maxX - surfaceBounds.minX,
          height: surfaceBounds.maxY - surfaceBounds.minY
        }
      }
    });
  }
  return { faces, nodeIds };
};

export const effectiveGeneratedFaceEnabled = (
  node: CubeNode,
  direction: CubeFaceDirection,
  authority: CompiledSurfaceAuthority
): boolean =>
  authority.faces.get(
    generatedSurfaceFaceKey(node.id, direction)
  )?.external ?? node.faces[direction].enabled;
