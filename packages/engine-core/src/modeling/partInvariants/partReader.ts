import {
  IDENTITY_TRANSFORM,
  type BoneNode,
  type CubeNode,
  type GeneratedNodeProvenance,
  type ProjectDocument,
  type SurfacePixelDensity
} from '../../model';
import { compareStableText } from '../../stableOrder';
import {
  cellKey,
  createOccupancyGrid,
  worldToLattice
} from '../lattice';
import { PART_CONTRACT_LIMITS } from '../partContract';
import {
  compiledPartBoneId,
  compiledPartCubeId
} from '../provenance';
import type {
  LatticeBounds,
  LatticePoint
} from '../types';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './types';

export type CompiledPartNode = BoneNode | CubeNode;

const sameTransform = (
  left: CubeNode['transform'],
  right: CubeNode['transform']
): boolean =>
  left.position.every((value, index) => value === right.position[index]) &&
  left.rotation.every((value, index) => value === right.rotation[index]) &&
  left.scale.every((value, index) => value === right.scale[index]) &&
  left.pivot.every((value, index) => value === right.pivot[index]);

const latticeBoundsForCube = (
  cube: CubeNode,
  density: SurfacePixelDensity
): LatticeBounds | null => {
  try {
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

const cellsForBounds = (
  bounds: LatticeBounds
): readonly LatticePoint[] => {
  const cells: LatticePoint[] = [];
  for (let x = bounds.min.x; x < bounds.max.x; x += 1) {
    for (let y = bounds.min.y; y < bounds.max.y; y += 1) {
      for (let z = bounds.min.z; z < bounds.max.z; z += 1) {
        cells.push({ x, y, z });
      }
    }
  }
  return cells;
};

const provenanceSignature = (
  value: GeneratedNodeProvenance
): string =>
  [
    value.partId,
    value.parentPartId ?? '-',
    value.materialId,
    value.primitive,
    value.joint.kind,
    value.joint.kind === 'hinge' ? value.joint.axis : '-'
  ].join('|');

export const isValidJoint = (
  value: GeneratedNodeProvenance['joint'] | undefined
): value is GeneratedNodeProvenance['joint'] =>
  value?.kind === 'fixed' ||
  value?.kind === 'ball' ||
  (
    value?.kind === 'hinge' &&
    (value.axis === 'x' || value.axis === 'y' || value.axis === 'z')
  );

export const readPart = (
  document: ProjectDocument,
  partId: string,
  nodes: readonly CompiledPartNode[],
  issues: PartInvariantIssue[]
): CompiledPartState | null => {
  const issueCount = issues.length;
  const generations = nodes.flatMap((node) =>
    node.generation ? [node.generation] : []
  );
  const signature = generations[0]
    ? provenanceSignature(generations[0])
    : null;
  if (
    generations.length !== nodes.length ||
    !signature ||
    generations.some(
      (generation) => provenanceSignature(generation) !== signature
    )
  ) {
    issues.push({
      code: 'provenance',
      path: `scene.parts.${partId}`,
      message: 'Compiled part nodes must share one provenance record.',
      entityIds: nodes.map((node) => node.id)
    });
    return null;
  }
  const provenance = generations[0];
  const bones = nodes.filter((node): node is BoneNode =>
    node.kind === 'bone'
  );
  const cubes = nodes.filter((node): node is CubeNode =>
    node.kind === 'cube'
  );
  const boneId = compiledPartBoneId(partId);
  const boneTransformValid =
    bones.length === 1 &&
    bones[0].transform.position.every((value) => value === 0) &&
    bones[0].transform.rotation.every((value) => value === 0) &&
    bones[0].transform.scale.every((value) => value === 1) &&
    bones[0].transform.pivot.every((value) => {
      try {
        worldToLattice(value, document.settings.surfacePixelDensity);
        return true;
      } catch {
        return false;
      }
    });
  const rootContractValid =
    provenance.parentPartId !== null ||
    (
      provenance.joint.kind === 'fixed' &&
      bones[0]?.transform.pivot.every((value) => value === 0)
    );
  if (
    bones.length !== 1 ||
    bones[0].id !== boneId ||
    bones[0].name !== partId ||
    bones[0].generation?.role !== 'bone' ||
    !bones[0].visible ||
    !boneTransformValid ||
    !rootContractValid ||
    cubes.length === 0 ||
    cubes.some(
      (cube) =>
        cube.name !== partId ||
        cube.generation?.role !== 'geometry' ||
        cube.parentId !== boneId ||
        !cube.visible ||
        !sameTransform(cube.transform, IDENTITY_TRANSFORM) ||
        cube.inflate !== 0
    )
  ) {
    issues.push({
      code: 'provenance',
      path: `scene.parts.${partId}`,
      message: 'A compiled part requires one stable bone and identity geometry children.',
      entityIds: nodes.map((node) => node.id)
    });
    return null;
  }

  const cells: LatticePoint[] = [];
  const occupiedCells = new Set<string>();
  let enumeratedCells = 0;
  const baseColor = cubes[0]?.baseColor.toLowerCase();
  for (const cube of cubes) {
    const bounds = latticeBoundsForCube(
      cube,
      document.settings.surfacePixelDensity
    );
    if (
      !bounds ||
      bounds.min.x >= bounds.max.x ||
      bounds.min.y >= bounds.max.y ||
      bounds.min.z >= bounds.max.z ||
      cube.id !== compiledPartCubeId(
        partId,
        document.settings.surfacePixelDensity,
        bounds
      ) ||
      cube.baseColor.toLowerCase() !== baseColor
    ) {
      issues.push({
        code: 'grid',
        path: `scene.nodes.${cube.id}.bounds`,
        message: 'Compiled cube bounds and stable ID must match the project lattice.',
        entityIds: [cube.id]
      });
      continue;
    }
    const spans = {
      x: bounds.max.x - bounds.min.x,
      y: bounds.max.y - bounds.min.y,
      z: bounds.max.z - bounds.min.z
    };
    const volume = spans.x * spans.y * spans.z;
    if (
      Object.values(spans).some(
        (span) => span > PART_CONTRACT_LIMITS.maxAxisSpan
      ) ||
      !Number.isSafeInteger(volume) ||
      enumeratedCells + volume >
        PART_CONTRACT_LIMITS.maxOccupancyCellsPerPart
    ) {
      issues.push({
        code: 'budget',
        path: `scene.nodes.${cube.id}.bounds`,
        message: 'Compiled part bounds exceed the safe validation budget.',
        entityIds: [boneId, cube.id]
      });
      continue;
    }
    enumeratedCells += volume;
    for (const cell of cellsForBounds(bounds)) {
      const key = cellKey(cell);
      if (occupiedCells.has(key)) {
        issues.push({
          code: 'overlap',
          path: `scene.nodes.${cube.id}.bounds`,
          message: 'Canonical emitted cuboids within one part must have single-cell ownership.',
          entityIds: [boneId, cube.id]
        });
        break;
      }
      occupiedCells.add(key);
      cells.push(cell);
    }
  }
  if (issues.length > issueCount) return null;
  return {
    partId,
    parentPartId: provenance.parentPartId,
    materialId: provenance.materialId,
    primitive: provenance.primitive,
    joint: provenance.joint,
    bone: bones[0],
    cubes: cubes.sort((left, right) => compareStableText(left.id, right.id)),
    occupancy: createOccupancyGrid(
      document.settings.surfacePixelDensity,
      cells
    )
  };
};
