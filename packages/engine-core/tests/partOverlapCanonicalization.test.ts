import assert from 'node:assert/strict';

import {
  canonicalizePartOccupancies,
  createProjectFromInput,
  executeCommandBatch,
  parseProjectDocument,
  readCompiledParts,
  readPartRecipe,
  validateProjectDocument,
  type CellKey,
  type CommandBatch,
  type CubeNode,
  type PartSpec,
  type ProjectDocument,
  type SurfacePixelDensity
} from '../src';

const materialDefinitions = [
  { id: 'body', baseColor: '#A85F2B' },
  { id: 'join', baseColor: '#37434A' }
] as const;

const rootPart = (
  size = 4
): PartSpec => ({
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'body',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'yz',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [size, 0],
    [size, size],
    [0, size]
  ],
  thickness: size
});

const joinedPart = (
  depth: number
): PartSpec => ({
  kind: 'plate',
  partId: 'join',
  parentPartId: 'body',
  materialId: 'join',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [4, 2, 2],
    partAnchor: [4, 2, 2]
  },
  plane: 'yz',
  origin: [4 - depth, 0, 0],
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4]
  ],
  thickness: 4
});

const createProject = (
  id: string,
  density: SurfacePixelDensity = 1
): ProjectDocument => {
  const project = createProjectFromInput(
    {
      id,
      name: id,
      target: 'glb',
      namespace: 'ashfox',
      modelPath: id.replaceAll('-', '_'),
      createdAt: '2026-07-31T00:00:00.000Z'
    },
    'overlap-0001'
  );
  return {
    ...project,
    settings: {
      ...project.settings,
      surfacePixelDensity: density
    }
  };
};

const executeParts = (
  document: ProjectDocument,
  batchId: string,
  parts: readonly PartSpec[]
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations: [{
        name: 'model.parts.upsert',
        payload: {
          parts: parts.map(
            ({ attachment: _attachment, ...part }) => part
          ),
          materials: materialDefinitions
        }
      }]
    },
    { source: 'agent' }
  );

const union = (
  sets: readonly ReadonlySet<CellKey>[]
): ReadonlySet<CellKey> =>
  new Set(sets.flatMap((set) => [...set]));

for (const density of [1, 2, 4] as const) {
  for (const depth of [0, 1, 2, 3]) {
    const canonical = canonicalizePartOccupancies(
      [joinedPart(depth), rootPart()],
      density
    );
    assert.equal(canonical.ok, true);
    if (!canonical.ok) throw new Error(canonical.message);
    const authoredUnion = union(
      canonical.parts.map((part) => part.authored.cells)
    );
    const canonicalUnion = union(
      canonical.parts.map((part) => part.canonical.cells)
    );
    assert.deepEqual(canonicalUnion, authoredUnion);
    assert.equal(
      canonical.parts.reduce(
        (total, part) => total + part.canonical.cells.size,
        0
      ),
      canonicalUnion.size,
      'every canonical cell must have exactly one owner'
    );
    const join = canonical.parts.find(
      (part) => part.spec.partId === 'join'
    );
    assert.equal(join?.metric.maximumTrimDepthCells, depth);
  }
}

const ordered = executeParts(
  createProject('project-overlap-order'),
  'overlap-order',
  [rootPart(), joinedPart(2)]
);
const reversed = executeParts(
  createProject('project-overlap-order'),
  'overlap-order',
  [joinedPart(2), rootPart()]
);
assert.equal(ordered.ok, true);
assert.equal(reversed.ok, true);
if (!ordered.ok || !reversed.ok) {
  throw new Error('Shallow overlap fixture did not compile.');
}
assert.deepEqual(
  reversed.document,
  ordered.document,
  'payload order must not change canonical seam ownership'
);
const compiled = readCompiledParts(ordered.document);
assert.equal(compiled.ok, true);
if (!compiled.ok) throw new Error('Canonical overlap fixture is invalid.');
const bodyCells = compiled.parts.get('body')?.occupancy.cells;
const joinCells = compiled.parts.get('join')?.occupancy.cells;
assert.ok(bodyCells && joinCells);
assert.equal(
  [...joinCells].some((cell) => bodyCells.has(cell)),
  false
);
assert.equal(
  validateProjectDocument(ordered.document).valid,
  true
);
const recipe = readPartRecipe(ordered.document);
assert.equal(recipe.ok, true);
assert.deepEqual(
  recipe.ok
    ? recipe.recipe?.parts.find(
        (part) => part.partId === 'join'
      )
    : null,
  joinedPart(2),
  'the authored seam remains editable in the canonical recipe'
);
const reopened = parseProjectDocument(
  JSON.parse(JSON.stringify(ordered.document))
);
assert.deepEqual(
  JSON.parse(JSON.stringify(reopened)),
  JSON.parse(JSON.stringify(ordered.document))
);

const exactJoin = executeParts(
  createProject('project-overlap-transform'),
  'overlap-transform-start',
  [rootPart(), joinedPart(0)]
);
assert.equal(exactJoin.ok, true);
if (!exactJoin.ok) {
  throw new Error('Exact transform fixture did not compile.');
}
const translateJoin = (
  document: ProjectDocument,
  batchId: string
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations: [{
        name: 'model.parts.transform',
        payload: {
          rootPartId: 'join',
          by: [-1, 0, 0]
        }
      }]
    },
    { source: 'agent' }
  );
const oneCellTransform = translateJoin(
  exactJoin.document,
  'overlap-transform-one'
);
assert.equal(oneCellTransform.ok, true);
if (!oneCellTransform.ok) {
  throw new Error(oneCellTransform.error.message);
}
const twoCellTransform = translateJoin(
  oneCellTransform.document,
  'overlap-transform-two'
);
assert.equal(twoCellTransform.ok, true);
if (!twoCellTransform.ok) {
  throw new Error(twoCellTransform.error.message);
}
const transformedRecipe = readPartRecipe(twoCellTransform.document);
assert.equal(transformedRecipe.ok, true);
if (!transformedRecipe.ok || !transformedRecipe.recipe) {
  throw new Error('Transformed overlap recipe is unavailable.');
}
const transformedCanonical = canonicalizePartOccupancies(
  transformedRecipe.recipe.parts,
  twoCellTransform.document.settings.surfacePixelDensity
);
assert.equal(transformedCanonical.ok, true);
if (!transformedCanonical.ok) {
  throw new Error(transformedCanonical.message);
}
const transformedJoin = transformedCanonical.parts.find(
  (part) => part.spec.partId === 'join'
);
assert.deepEqual(
  transformedJoin?.metric.canonicalAttachmentAnchor,
  [4, 2, 2]
);
assert.equal(
  transformedJoin?.metric.attachmentSnapDistanceCells,
  0,
  'reprojection must persist the newly derived contact anchor'
);
const threeCellTransform = translateJoin(
  twoCellTransform.document,
  'overlap-transform-three'
);
assert.equal(threeCellTransform.ok, true);
if (!threeCellTransform.ok) {
  throw new Error(threeCellTransform.error.message);
}
const threeCellRecipe = readPartRecipe(threeCellTransform.document);
assert.equal(threeCellRecipe.ok, true);
if (!threeCellRecipe.ok || !threeCellRecipe.recipe) {
  throw new Error('Deep transformed overlap recipe is unavailable.');
}
const threeCellCanonical = canonicalizePartOccupancies(
  threeCellRecipe.recipe.parts,
  threeCellTransform.document.settings.surfacePixelDensity
);
assert.equal(threeCellCanonical.ok, true);
if (!threeCellCanonical.ok) {
  throw new Error(threeCellCanonical.message);
}
assert.equal(
  threeCellCanonical.parts.find(
    (part) => part.spec.partId === 'join'
  )?.metric.attachmentSnapDistanceCells,
  0,
  'deep semantic joins are re-anchored to their actual parent contact'
);

for (const depth of [4]) {
  const original = createProject(`project-overlap-reject-${depth}`);
  const before = structuredClone(original);
  const rejected = executeParts(
    original,
    `overlap-reject-${depth}`,
    [rootPart(), joinedPart(depth)]
  );
  assert.equal(rejected.ok, false);
  if (rejected.ok) {
    throw new Error(`Depth ${depth} unexpectedly compiled.`);
  }
  assert.equal(rejected.error.code, 'invalid_state');
  assert.match(
    rejected.error.message,
    /fully contained|retains only 0%/
  );
  assert.deepEqual(original, before);
}

const deletionRoot: PartSpec = {
  kind: 'plate',
  partId: 'root',
  parentPartId: null,
  materialId: 'body',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xz',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [8, 0],
    [8, 4],
    [0, 4]
  ],
  thickness: 1
};
const deletionOwner: PartSpec = {
  kind: 'plate',
  partId: 'alpha',
  parentPartId: 'root',
  materialId: 'body',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [2, 1, 2],
    partAnchor: [2, 1, 2]
  },
  plane: 'xz',
  origin: [0, 1, 0],
  outline: [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4]
  ],
  thickness: 2
};
const deletionSurvivor: PartSpec = {
  ...deletionOwner,
  partId: 'beta',
  materialId: 'join',
  attachment: {
    parentAnchor: [5, 1, 2],
    partAnchor: [5, 1, 2]
  },
  origin: [3, 1, 0]
};
const beforeOwnerDeletion = executeParts(
  createProject('project-overlap-delete'),
  'overlap-delete-setup',
  [deletionSurvivor, deletionRoot, deletionOwner]
);
assert.equal(beforeOwnerDeletion.ok, true);
if (!beforeOwnerDeletion.ok) {
  throw new Error(beforeOwnerDeletion.error.message);
}
const beforeDeleteCompiled = readCompiledParts(
  beforeOwnerDeletion.document
);
assert.equal(beforeDeleteCompiled.ok, true);
if (!beforeDeleteCompiled.ok) {
  throw new Error('Deletion overlap fixture is invalid.');
}
assert.equal(
  beforeDeleteCompiled.parts.get('beta')?.occupancy.cells.has(
    '3,1,0' as CellKey
  ),
  false,
  'the stable earlier sibling must own the authored seam before deletion'
);
const ownerDeletion = executeCommandBatch(
  beforeOwnerDeletion.document,
  {
    batchId: 'overlap-delete-owner',
    baseProjectId: beforeOwnerDeletion.document.id,
    baseRevision: beforeOwnerDeletion.document.revision,
    operations: [{
      name: 'model.parts.delete',
      payload: { partIds: ['alpha'] }
    }]
  },
  { source: 'agent' }
);
assert.equal(ownerDeletion.ok, true);
if (!ownerDeletion.ok) {
  throw new Error(ownerDeletion.error.message);
}
const afterDeleteCompiled = readCompiledParts(
  ownerDeletion.document
);
assert.equal(afterDeleteCompiled.ok, true);
if (!afterDeleteCompiled.ok) {
  throw new Error('Deleted overlap fixture is invalid.');
}
assert.equal(
  afterDeleteCompiled.parts.get('beta')?.occupancy.cells.has(
    '3,1,0' as CellKey
  ),
  true,
  'deleting the previous owner must restore the survivor authored seam'
);
assert.equal(
  afterDeleteCompiled.parts.get('beta')?.occupancy.cells.size,
  32
);

const partialRoot: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'body',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xz',
  origin: [0, 0, 0],
  outline: [
    [0, 0],
    [6, 0],
    [6, 6],
    [0, 6]
  ],
  thickness: 4
};
const partialJoin: PartSpec = {
  kind: 'plate',
  partId: 'join',
  parentPartId: 'body',
  materialId: 'join',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [3, 4, 3],
    partAnchor: [3, 4, 3]
  },
  plane: 'xz',
  origin: [2, 3, 2],
  outline: [
    [0, 0],
    [2, 0],
    [2, 2],
    [0, 2]
  ],
  thickness: 4
};
const partial = executeParts(
  createProject('project-partial-seam'),
  'partial-seam',
  [partialJoin, partialRoot]
);
assert.equal(partial.ok, true);
if (!partial.ok) {
  throw new Error(partial.error.message);
}
const partialCompiled = readCompiledParts(partial.document);
assert.equal(partialCompiled.ok, true);
if (!partialCompiled.ok) {
  throw new Error('Partial seam fixture is invalid.');
}

const faceOffsets = {
  north: [0, 0, -1],
  south: [0, 0, 1],
  east: [1, 0, 0],
  west: [-1, 0, 0],
  up: [0, 1, 0],
  down: [0, -1, 0]
} as const;
type FaceDirection = keyof typeof faceOffsets;
const faceKey = (
  cell: readonly [number, number, number],
  direction: FaceDirection
): string => `${cell.join(',')}:${direction}`;
const occupied = union(
  [...partialCompiled.parts.values()].map(
    (part) => part.occupancy.cells
  )
);
const expectedBoundary = new Set<string>();
for (const key of occupied) {
  const [x, y, z] = key.split(',').map(Number);
  for (const [direction, [dx, dy, dz]] of Object.entries(
    faceOffsets
  ) as [FaceDirection, readonly [number, number, number]][]) {
    const neighbor = `${x + dx},${y + dy},${z + dz}` as CellKey;
    if (!occupied.has(neighbor)) {
      expectedBoundary.add(faceKey([x, y, z], direction));
    }
  }
}

const emittedFaces: string[] = [];
const emitFace = (
  cube: CubeNode,
  direction: FaceDirection
): void => {
  if (!cube.faces[direction].enabled) return;
  const [fromX, fromY, fromZ] = cube.bounds.from;
  const [toX, toY, toZ] = cube.bounds.to;
  if (direction === 'north' || direction === 'south') {
    const z = direction === 'north' ? fromZ : toZ - 1;
    for (let x = fromX; x < toX; x += 1) {
      for (let y = fromY; y < toY; y += 1) {
        emittedFaces.push(faceKey([x, y, z], direction));
      }
    }
    return;
  }
  if (direction === 'east' || direction === 'west') {
    const x = direction === 'west' ? fromX : toX - 1;
    for (let y = fromY; y < toY; y += 1) {
      for (let z = fromZ; z < toZ; z += 1) {
        emittedFaces.push(faceKey([x, y, z], direction));
      }
    }
    return;
  }
  const y = direction === 'down' ? fromY : toY - 1;
  for (let x = fromX; x < toX; x += 1) {
    for (let z = fromZ; z < toZ; z += 1) {
      emittedFaces.push(faceKey([x, y, z], direction));
    }
  }
};
for (const part of partialCompiled.parts.values()) {
  for (const cube of part.cubes) {
    for (const direction of Object.keys(
      faceOffsets
    ) as FaceDirection[]) {
      emitFace(cube, direction);
    }
  }
}
assert.equal(
  new Set(emittedFaces).size,
  emittedFaces.length,
  'canonical export surfaces must not contain duplicate unit faces'
);
const emittedFaceSet = new Set(emittedFaces);
assert.ok(
  [...expectedBoundary].every((key) => emittedFaceSet.has(key)),
  'semantic cuboids must expose every true union-boundary face'
);
assert.ok(
  [...emittedFaceSet]
    .filter((key) => !expectedBoundary.has(key))
    .every((key) => {
      const [coordinate, direction] = key.split(':') as [
        string,
        FaceDirection
      ];
      const [x, y, z] = coordinate.split(',').map(Number);
      const [dx, dy, dz] = faceOffsets[direction];
      return occupied.has(
        `${x + dx},${y + dy},${z + dz}` as CellKey
      );
    }),
  'any rectangular face overdraw must remain hidden inside occupied volume'
);
