import {
  GENERATED_PART_PRIMITIVES,
  IDENTITY_TRANSFORM,
  type BoneNode,
  type CubeNode,
  type GeneratedNodeProvenance,
  type ProjectDocument,
  type SurfacePixelDensity
} from '../model';
import { compareStableText } from '../stableOrder';
import {
  cellKey,
  createOccupancyGrid,
  parseCellKey,
  worldToLattice
} from './lattice';
import { isSixConnected } from './connectivity';
import {
  compiledPartBoneId,
  compiledPartCubeId
} from './provenance';
import { isCompiledPartNode } from './provenance';
import {
  worldBoundsOverlap,
  worldCubeBounds
} from './worldCubeBounds';
import type {
  LatticeBounds,
  LatticePoint,
  OccupancyGrid
} from './types';
import {
  isPartId,
  PART_CONTRACT_LIMITS
} from './partContract';

export type PartInvariantCode =
  | 'provenance'
  | 'grid'
  | 'hierarchy'
  | 'connectivity'
  | 'attachment'
  | 'overlap'
  | 'silhouette'
  | 'rig'
  | 'budget'
  | 'projection';

export interface PartInvariantIssue {
  code: PartInvariantCode;
  path: string;
  message: string;
  entityIds: readonly string[];
  clipIds?: readonly string[];
}

export interface CompiledPartState {
  partId: string;
  parentPartId: string | null;
  materialId: string;
  primitive: GeneratedNodeProvenance['primitive'];
  joint: GeneratedNodeProvenance['joint'];
  bone: BoneNode;
  cubes: readonly CubeNode[];
  occupancy: OccupancyGrid;
}

export type ReadCompiledPartsResult =
  | {
      ok: true;
      parts: ReadonlyMap<string, CompiledPartState>;
    }
  | {
      ok: false;
      issues: readonly PartInvariantIssue[];
    };

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

const isValidJoint = (
  value: GeneratedNodeProvenance['joint'] | undefined
): value is GeneratedNodeProvenance['joint'] =>
  value?.kind === 'fixed' ||
  value?.kind === 'ball' ||
  (
    value?.kind === 'hinge' &&
    (value.axis === 'x' || value.axis === 'y' || value.axis === 'z')
  );

const readPart = (
  document: ProjectDocument,
  partId: string,
  nodes: readonly (BoneNode | CubeNode)[],
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
      provenance.primitive !== 'feature' &&
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
      message:
        'A compiled part requires one stable bone and identity geometry children.',
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
        message:
          'Compiled cube bounds and stable ID must match the project lattice.',
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
        message:
          'Compiled part bounds exceed the safe validation budget.',
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
          message:
            'Compiled cuboids within one part must not overlap.',
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
    cubes: cubes.sort((left, right) =>
      compareStableText(left.id, right.id)
    ),
    occupancy: createOccupancyGrid(
      document.settings.surfacePixelDensity,
      cells
    )
  };
};

const validateHierarchy = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const roots = [...parts.values()].filter(
    (part) => part.parentPartId === null
  );
  if (parts.size > 0 && roots.length !== 1) {
    issues.push({
      code: 'hierarchy',
      path: 'scene.parts',
      message: 'A compiled model must contain exactly one root part.',
      entityIds: roots.map((part) => part.bone.id)
    });
  }
  for (const part of parts.values()) {
    const expectedParentId =
      part.parentPartId === null
        ? null
        : compiledPartBoneId(part.parentPartId);
    if (
      part.bone.parentId !== expectedParentId ||
      (
        part.parentPartId !== null &&
        !parts.has(part.parentPartId)
      )
    ) {
      issues.push({
        code: 'hierarchy',
        path: `scene.nodes.${part.bone.id}.parentId`,
        message:
          'Compiled part parent must reference the stable parent-part bone.',
        entityIds: [part.bone.id]
      });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (partId: string): void => {
    if (visited.has(partId)) return;
    if (visiting.has(partId)) {
      issues.push({
        code: 'hierarchy',
        path: `scene.parts.${partId}`,
        message: 'Compiled part hierarchy contains a cycle.',
        entityIds: [compiledPartBoneId(partId)]
      });
      return;
    }
    visiting.add(partId);
    const parentId = parts.get(partId)?.parentPartId;
    if (parentId && parts.has(parentId)) visit(parentId);
    visiting.delete(partId);
    visited.add(partId);
  };
  [...parts.keys()].sort().forEach(visit);
};

const validateMaterials = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const colors = new Map<string, {
    color: string;
    partId: string;
  }>();
  for (const part of parts.values()) {
    const color = part.cubes[0].baseColor.toLowerCase();
    const existing = colors.get(part.materialId);
    if (existing && existing.color !== color) {
      issues.push({
        code: 'provenance',
        path: `scene.parts.${part.partId}.materialId`,
        message:
          `Material "${part.materialId}" has conflicting base colors.`,
        entityIds: [
          compiledPartBoneId(existing.partId),
          part.bone.id
        ]
      });
      continue;
    }
    colors.set(part.materialId, {
      color,
      partId: part.partId
    });
  }
};

const shareFaceAtAnchor = (
  left: OccupancyGrid,
  right: OccupancyGrid,
  anchor: LatticePoint
): boolean => {
  const offsets: readonly LatticePoint[] = [
    { x: -1, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: -1, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 }
  ];
  for (const key of left.cells) {
    const cell = parseCellKey(key);
    for (const offset of offsets) {
      if (
        !right.cells.has(
          cellKey({
            x: cell.x + offset.x,
            y: cell.y + offset.y,
            z: cell.z + offset.z
          })
        )
      ) {
        continue;
      }
      const axis =
        offset.x !== 0 ? 'x' : offset.y !== 0 ? 'y' : 'z';
      const plane = offset[axis] > 0
        ? cell[axis] + 1
        : cell[axis];
      const otherAxes = ['x', 'y', 'z'].filter(
        (candidate) => candidate !== axis
      ) as readonly ('x' | 'y' | 'z')[];
      if (
        anchor[axis] === plane &&
        otherAxes.every(
          (otherAxis) =>
            anchor[otherAxis] >= cell[otherAxis] &&
            anchor[otherAxis] <= cell[otherAxis] + 1
        )
      ) {
        return true;
      }
    }
  }
  return false;
};

const projectedKey = (
  cell: LatticePoint,
  axis: 'x' | 'y' | 'z'
): string =>
  axis === 'x'
    ? `${cell.y},${cell.z}`
    : axis === 'y'
      ? `${cell.x},${cell.z}`
      : `${cell.x},${cell.y}`;

const visiblePartIds = (
  parts: ReadonlyMap<string, CompiledPartState>
): ReadonlySet<string> => {
  const cells = [...parts.values()].flatMap((part) =>
    [...part.occupancy.cells].map((key) => ({
      partId: part.partId,
      cell: parseCellKey(key)
    }))
  );
  const visible = new Set<string>();
  for (const axis of ['x', 'y', 'z'] as const) {
    for (const direction of [-1, 1] as const) {
      const front = new Map<string, {
        coordinate: number;
        partId: string;
      }>();
      for (const entry of cells) {
        const key = projectedKey(entry.cell, axis);
        const coordinate = entry.cell[axis] * direction;
        const current = front.get(key);
        if (
          !current ||
          coordinate > current.coordinate ||
          (
            coordinate === current.coordinate &&
            entry.partId < current.partId
          )
        ) {
          front.set(key, {
            coordinate,
            partId: entry.partId
          });
        }
      }
      for (const entry of front.values()) visible.add(entry.partId);
    }
  }
  return visible;
};

const validateOccupancy = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const owners = new Map<string, string>();
  for (const part of [...parts.values()].sort((left, right) =>
    compareStableText(left.partId, right.partId)
  )) {
    if (!isSixConnected(part.occupancy)) {
      issues.push({
        code: 'connectivity',
        path: `scene.parts.${part.partId}`,
        message: 'Each compiled part must be one 6-connected volume.',
        entityIds: part.cubes.map((cube) => cube.id)
      });
    }
    for (const key of part.occupancy.cells) {
      const owner = owners.get(key);
      if (owner) {
        issues.push({
          code: 'overlap',
          path: `scene.parts.${part.partId}`,
          message:
            `Compiled parts "${owner}" and "${part.partId}" overlap.`,
          entityIds: [
            compiledPartBoneId(owner),
            compiledPartBoneId(part.partId)
          ]
        });
        break;
      }
      owners.set(key, part.partId);
    }
    if (part.parentPartId) {
      const parent = parts.get(part.parentPartId);
      const pivot: LatticePoint = {
        x: worldToLattice(
          part.bone.transform.pivot[0],
          part.occupancy.density
        ),
        y: worldToLattice(
          part.bone.transform.pivot[1],
          part.occupancy.density
        ),
        z: worldToLattice(
          part.bone.transform.pivot[2],
          part.occupancy.density
        )
      };
      if (
        parent &&
        !shareFaceAtAnchor(parent.occupancy, part.occupancy, pivot)
      ) {
        issues.push({
          code: 'attachment',
          path: `scene.parts.${part.partId}`,
          message:
            'A child part must share a full lattice face with its parent.',
          entityIds: [part.bone.id, parent.bone.id]
        });
      }
    }
  }
  const visible = visiblePartIds(parts);
  for (const part of parts.values()) {
    if (!visible.has(part.partId)) {
      issues.push({
        code: 'silhouette',
        path: `scene.parts.${part.partId}`,
        message:
          'Every compiled part must contribute to an orthographic silhouette.',
        entityIds: [part.bone.id]
      });
    }
  }
};

const validateForeignGeometry = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const generated = [...parts.values()].flatMap((part) => part.cubes);
  const foreign = Object.values(document.scene.nodes).filter(
    (node): node is CubeNode =>
      node.kind === 'cube' && !isCompiledPartNode(node)
  );
  try {
    for (const cube of generated) {
      const bounds = worldCubeBounds(document, cube);
      const overlap = foreign.find((candidate) =>
        worldBoundsOverlap(bounds, worldCubeBounds(document, candidate))
      );
      if (!overlap) continue;
      issues.push({
        code: 'overlap',
        path: `scene.nodes.${cube.id}.bounds`,
        message:
          `Compiled cube world bounds overlap foreign cube "${overlap.id}".`,
        entityIds: [cube.id, overlap.id]
      });
      return;
    }
  } catch (error) {
    issues.push({
      code: 'hierarchy',
      path: 'scene.nodes',
      message:
        error instanceof Error
          ? error.message
          : 'World cube bounds could not be evaluated.',
      entityIds: []
    });
  }
};

export const readCompiledParts = (
  document: ProjectDocument
): ReadCompiledPartsResult => {
  const issues: PartInvariantIssue[] = [];
  const grouped = new Map<string, (BoneNode | CubeNode)[]>();
  for (const node of Object.values(document.scene.nodes)) {
    if (node.generation === undefined) continue;
    const generation = node.generation;
    if (
      generation.authority !== 'ashfox.part-compiler' ||
      !isPartId(generation.partId) ||
      !isPartId(generation.materialId) ||
      !GENERATED_PART_PRIMITIVES.includes(generation.primitive) ||
      !isValidJoint(generation.joint) ||
      (generation.role !== 'bone' && generation.role !== 'geometry') ||
      (
        generation.parentPartId !== null &&
        !isPartId(generation.parentPartId)
      ) ||
      (node.kind !== 'bone' && node.kind !== 'cube')
    ) {
      issues.push({
        code: 'provenance',
        path: `scene.nodes.${node.id}.generation`,
        message: 'Generated node provenance is malformed.',
        entityIds: [node.id]
      });
      continue;
    }
    const entries = grouped.get(generation.partId) ?? [];
    entries.push(node);
    grouped.set(generation.partId, entries);
  }
  if (
    grouped.size > 0 &&
    document.settings.coordinateSystem.unit !== 'pixel'
  ) {
    return {
      ok: false,
      issues: [{
        code: 'grid',
        path: 'settings.coordinateSystem.unit',
        message:
          'Compiled parts require pixel model units so one lattice cell maps to one generated surface pixel.',
        entityIds: []
      }]
    };
  }
  if (grouped.size > PART_CONTRACT_LIMITS.maxPartsPerDocument) {
    return {
      ok: false,
      issues: [{
        code: 'budget',
        path: 'scene.parts',
        message:
          `Compiled model exceeds ${PART_CONTRACT_LIMITS.maxPartsPerDocument} parts.`,
        entityIds: []
      }]
    };
  }

  const parts = new Map<string, CompiledPartState>();
  let totalCells = 0;
  for (const [partId, nodes] of [...grouped].sort(([left], [right]) =>
    compareStableText(left, right)
  )) {
    const part = readPart(document, partId, nodes, issues);
    if (!part) continue;
    totalCells += part.occupancy.cells.size;
    if (
      totalCells > PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument
    ) {
      issues.push({
        code: 'budget',
        path: 'scene.parts',
        message:
          `Compiled model exceeds ${PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument} occupied cells.`,
        entityIds: [part.bone.id]
      });
      break;
    }
    parts.set(partId, part);
  }
  const compiledBoneIds = new Set(
    [...parts.values()].map((part) => part.bone.id)
  );
  for (const node of Object.values(document.scene.nodes)) {
    if (
      node.parentId &&
      compiledBoneIds.has(node.parentId) &&
      node.generation === undefined &&
      node.kind !== 'locator'
    ) {
      issues.push({
        code: 'provenance',
        path: `scene.nodes.${node.id}.parentId`,
        message:
          'Only generated geometry or locators may be children of a compiled part bone.',
        entityIds: [node.id, node.parentId]
      });
    }
  }
  if (issues.length === 0) {
    validateHierarchy(parts, issues);
    validateMaterials(parts, issues);
    validateOccupancy(parts, issues);
  }
  return issues.length === 0
    ? { ok: true, parts }
    : { ok: false, issues };
};

export const validateCompiledPartEnvironment = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>
): readonly PartInvariantIssue[] => {
  const issues: PartInvariantIssue[] = [];
  validateForeignGeometry(document, parts, issues);
  return issues;
};
