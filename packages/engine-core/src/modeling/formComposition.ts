import type {
  CubeNode,
  ProjectDocument,
  SceneNode,
  SurfacePixelDensity
} from '../model';

export interface FormPartComposition {
  partId: string;
  compiledCuboids: number;
  cellScaleCuboids: number;
}

export interface FormComposition {
  compiledCuboids: number;
  semanticParts: number;
  cellScaleCuboids: number;
  parts: readonly FormPartComposition[];
}

const isCompiledCube = (node: SceneNode): node is CubeNode =>
  node.kind === 'cube' &&
  node.generation?.authority === 'ashfox.part-compiler' &&
  node.generation.role === 'geometry';

const isCellScaleCuboid = (
  cube: CubeNode,
  density: SurfacePixelDensity
): boolean => {
  const latticeSpans = cube.bounds.to.map((value, axis) =>
    Math.round((value - cube.bounds.from[axis]) * density)
  );
  return latticeSpans.filter((span) => span === 1).length >= 2;
};

/**
 * Reports compiler output without treating implementation-level cuboid count
 * as an artistic score or an authoring limit.
 */
export const measureFormComposition = (
  nodes: readonly SceneNode[],
  density: SurfacePixelDensity
): FormComposition => {
  const cubes = nodes.filter(isCompiledCube);
  const byPart = new Map<
    string,
    { compiledCuboids: number; cellScaleCuboids: number }
  >();
  let cellScaleCuboids = 0;
  for (const cube of cubes) {
    const partId = cube.generation?.partId;
    if (!partId) continue;
    const current = byPart.get(partId) ?? {
      compiledCuboids: 0,
      cellScaleCuboids: 0
    };
    current.compiledCuboids += 1;
    if (isCellScaleCuboid(cube, density)) {
      current.cellScaleCuboids += 1;
      cellScaleCuboids += 1;
    }
    byPart.set(partId, current);
  }
  return {
    compiledCuboids: cubes.length,
    semanticParts: byPart.size,
    cellScaleCuboids,
    parts: [...byPart]
      .map(([partId, counts]) => ({ partId, ...counts }))
      .sort((left, right) => left.partId.localeCompare(right.partId))
  };
};

export const measureDocumentFormComposition = (
  document: ProjectDocument
): FormComposition =>
  measureFormComposition(
    Object.values(document.scene.nodes),
    document.settings.surfacePixelDensity
  );
