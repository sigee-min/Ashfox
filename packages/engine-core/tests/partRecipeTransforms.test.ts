import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  readCompiledParts,
  type CommandBatch,
  type ProjectDocument
} from '../src';
import {
  attachmentContactMetrics,
  orthographicContributionMetrics
} from '../src/modeling/partQualityMetrics';
import {
  type LatticeVec3,
  type PartSpec
} from '../src/modeling/partContract';
import { cellKey, parseCellKey } from '../src/modeling/lattice';
import { rasterizePart } from '../src/modeling/partPrimitiveAdapter';
import { normalizePartRecipe } from '../src/modeling/partRecipe';
import {
  mirrorPartRecipeSubtree,
  reflectLatticeCell,
  translatePartRecipeSubtree
} from '../src/modeling/partRecipeTransforms';
import type { Axis } from '../src/modeling/types';

const materials = [
  { id: 'gold', baseColor: '#C58A32' },
  { id: 'teal', baseColor: '#287C7E' }
] as const;

const primitiveFixture: readonly PartSpec[] = [
  {
    kind: 'mass',
    partId: 'model.root',
    parentPartId: null,
    materialId: 'gold',
    joint: { kind: 'fixed' },
    attachment: null,
    center: [0, 0, 0],
    radii: [2, 3, 4],
    profile: 'balanced'
  },
  {
    kind: 'mass',
    partId: 'source.mass',
    parentPartId: 'model.root',
    materialId: 'teal',
    joint: { kind: 'hinge', axis: 'z' },
    attachment: {
      parentAnchor: [9, 2, -1],
      partAnchor: [1, -1, 0]
    },
    center: [2, -3, 1],
    radii: [2, 1, 3],
    profile: 'soft'
  },
  {
    kind: 'segment',
    partId: 'source.segment',
    parentPartId: 'source.mass',
    materialId: 'gold',
    joint: { kind: 'ball' },
    attachment: {
      parentAnchor: [11, -2, 4],
      partAnchor: [-2, 1, 3]
    },
    points: [
      [-3, 1, 2],
      [1, 4, -2],
      [5, 2, 1]
    ],
    radii: [
      [1, 2, 1],
      [2, 1, 2],
      [1, 1, 1]
    ],
    profile: 'hard'
  },
  {
    kind: 'plate',
    partId: 'source.plate',
    parentPartId: 'source.segment',
    materialId: 'teal',
    joint: { kind: 'fixed' },
    attachment: {
      parentAnchor: [6, 3, -5],
      partAnchor: [2, -2, 1]
    },
    plane: 'xy',
    origin: [2, -3, 5],
    outline: [
      [0, 0],
      [4, 0],
      [4, 3],
      [0, 3]
    ],
    thickness: 3
  },
  {
    kind: 'radial',
    partId: 'source.radial',
    parentPartId: 'source.plate',
    materialId: 'gold',
    joint: { kind: 'hinge', axis: 'x' },
    attachment: {
      parentAnchor: [-4, 7, 3],
      partAnchor: [1, -3, 2]
    },
    axis: 'y',
    center: [2, -4, 6],
    outerRadius: 4,
    innerRadius: 2,
    depth: 3
  },
  {
    kind: 'feature',
    partId: 'source.feature',
    parentPartId: 'source.radial',
    materialId: 'teal',
    joint: { kind: 'fixed' },
    attachment: {
      parentAnchor: [5, -6, 8],
      partAnchor: [-2, 3, 1]
    },
    face: 'east',
    anchor: [3, -1, 4],
    size: [3, 5],
    relief: 2
  }
];

const normalizedFixture = normalizePartRecipe(
  primitiveFixture,
  materials
);
assert.equal(normalizedFixture.ok, true);
if (!normalizedFixture.ok) {
  throw new Error('Primitive transform fixture is invalid.');
}
const primitiveRecipe = normalizedFixture.recipe;
const sourcePartIds = primitiveRecipe.parts
  .filter((part) => part.partId.startsWith('source.'))
  .map((part) => part.partId);

const reflectedCellKeys = (
  part: PartSpec,
  axis: Axis,
  plane: number
): readonly string[] =>
  [...rasterizePart(1, part).cells]
    .map((key) =>
      cellKey(reflectLatticeCell(parseCellKey(key), axis, plane))
    )
    .sort();

const reflectedVector = (
  value: LatticeVec3,
  axis: Axis,
  plane: number
): LatticeVec3 => {
  const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  const reflected: [number, number, number] = [...value];
  reflected[index] = plane * 2 - reflected[index];
  return reflected;
};

for (const axis of ['x', 'y', 'z'] as const) {
  const mappings = sourcePartIds.map((sourcePartId) => ({
    sourcePartId,
    targetPartId: sourcePartId.replace('source.', `mirror${axis}.`)
  }));
  const mirrored = mirrorPartRecipeSubtree(primitiveRecipe, {
    rootPartId: 'source.mass',
    axis,
    plane: 7,
    partIdMap: [...mappings].reverse()
  });
  assert.equal(mirrored.ok, true);
  if (!mirrored.ok) {
    throw new Error(`Primitive subtree did not mirror on ${axis}.`);
  }

  for (const mapping of mappings) {
    const source = primitiveRecipe.parts.find(
      (part) => part.partId === mapping.sourcePartId
    );
    const target = mirrored.recipe.parts.find(
      (part) => part.partId === mapping.targetPartId
    );
    assert.ok(source);
    assert.ok(target);
    assert.deepEqual(
      [...rasterizePart(1, target).cells].sort(),
      reflectedCellKeys(source, axis, 7),
      `${source.kind} occupancy must reflect exactly on ${axis}`
    );
    assert.equal(target.materialId, source.materialId);
    assert.deepEqual(target.joint, source.joint);
    assert.deepEqual(
      target.attachment,
      source.attachment === null
        ? null
        : {
            parentAnchor: reflectedVector(
              source.attachment.parentAnchor,
              axis,
              7
            ),
            partAnchor: reflectedVector(
              source.attachment.partAnchor,
              axis,
              0
            )
          },
      'global parent and local part anchors must use their correct planes'
    );
    if (target.kind === 'plate') {
      assert.equal(source.kind, 'plate');
      if (source.kind !== 'plate') {
        throw new Error('Primitive kind changed during reflection.');
      }
      const signedAreaTwice = target.outline.reduce(
        (area, point, index) => {
          const next = target.outline[
            (index + 1) % target.outline.length
          ];
          return area + point[0] * next[1] - next[0] * point[1];
        },
        0
      );
      assert.ok(
        signedAreaTwice > 0,
        'mirrored plate winding must remain canonical'
      );
      if (axis === 'z') {
        assert.equal(
          target.origin[2],
          -source.origin[2] - source.thickness,
          'normal reflection must retain positive plate extrusion'
        );
      }
    }
    if (target.kind === 'feature') {
      assert.equal(
        target.face,
        axis === 'x' ? 'west' : 'east',
        'feature face must flip only across its normal axis'
      );
    }
  }

  const restoreMappings = mappings.map((mapping) => ({
    sourcePartId: mapping.targetPartId,
    targetPartId: mapping.sourcePartId.replace(
      'source.',
      `restore${axis}.`
    )
  }));
  const restored = mirrorPartRecipeSubtree(mirrored.recipe, {
    rootPartId: `mirror${axis}.mass`,
    axis,
    plane: 7,
    partIdMap: restoreMappings
  });
  assert.equal(restored.ok, true);
  if (!restored.ok) {
    throw new Error(`Mirrored subtree did not restore on ${axis}.`);
  }
  const restoredToSource = new Map(
    mappings.map((mapping) => [
      mapping.sourcePartId.replace('source.', `restore${axis}.`),
      mapping.sourcePartId
    ])
  );
  for (const sourcePartId of sourcePartIds) {
    const source = primitiveRecipe.parts.find(
      (part) => part.partId === sourcePartId
    );
    const restoredPartId = sourcePartId.replace(
      'source.',
      `restore${axis}.`
    );
    const restoredPart = restored.recipe.parts.find(
      (part) => part.partId === restoredPartId
    );
    assert.ok(source);
    assert.ok(restoredPart);
    assert.deepEqual(
      {
        ...restoredPart,
        partId: sourcePartId,
        parentPartId:
          restoredPart.parentPartId === null
            ? null
            : restoredToSource.get(restoredPart.parentPartId) ??
              restoredPart.parentPartId
      },
      source,
      `reflecting ${source.kind} twice must be an involution on ${axis}`
    );
  }
}

const translationA: LatticeVec3 = [7, -3, 5];
const translationB: LatticeVec3 = [-2, 11, -4];
const translatedA = translatePartRecipeSubtree(primitiveRecipe, {
  rootPartId: 'source.mass',
  translation: translationA
});
assert.equal(translatedA.ok, true);
if (!translatedA.ok) {
  throw new Error('First translation unexpectedly failed.');
}
const translatedAB = translatePartRecipeSubtree(translatedA.recipe, {
  rootPartId: 'source.mass',
  translation: translationB
});
const translatedSum = translatePartRecipeSubtree(primitiveRecipe, {
  rootPartId: 'source.mass',
  translation: [
    translationA[0] + translationB[0],
    translationA[1] + translationB[1],
    translationA[2] + translationB[2]
  ]
});
assert.equal(translatedAB.ok, true);
assert.equal(translatedSum.ok, true);
if (translatedAB.ok && translatedSum.ok) {
  assert.deepEqual(
    translatedAB.recipe,
    translatedSum.recipe,
    'subtree translations must compose exactly'
  );
}

const createProject = (id: string): ProjectDocument =>
  createProjectFromInput(
    {
      id,
      name: 'Part recipe transforms',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'part_recipe_transforms',
      createdAt: '2026-07-31T00:00:00.000Z'
    },
    `${id}-revision`
  );

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'agent' }
  );
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ` +
      `${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const body: PartSpec = {
  kind: 'mass',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [0, 0, 0],
  radii: [2, 2, 2],
  profile: 'balanced'
};
const arm: PartSpec = {
  kind: 'mass',
  partId: 'arm.left',
  parentPartId: 'body',
  materialId: 'teal',
  joint: { kind: 'hinge', axis: 'z' },
  attachment: {
    parentAnchor: [2, 0, 0],
    partAnchor: [-1, 0, 0]
  },
  center: [0, 0, 0],
  radii: [1, 1, 1],
  profile: 'balanced'
};
const hand: PartSpec = {
  ...arm,
  partId: 'hand.left',
  parentPartId: 'arm.left',
  materialId: 'gold',
  joint: { kind: 'ball' },
  attachment: {
    parentAnchor: [4, 0, 0],
    partAnchor: [-1, 0, 0]
  }
};

const oneSided = execute(createProject('project-mirror-parts'), 'upsert-left', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [body, arm, hand],
    materials
  }
}]);
const oneSidedSnapshot = JSON.stringify(oneSided);
const incompleteMirror = executeCommandBatch(
  oneSided,
  {
    batchId: 'mirror-incomplete-map',
    baseProjectId: oneSided.id,
    baseRevision: oneSided.revision,
    operations: [{
      name: 'model.parts.mirror',
      payload: {
        rootPartId: 'arm.left',
        axis: 'x',
        plane: 0,
        partIdMap: [{
          sourcePartId: 'arm.left',
          targetPartId: 'arm.right'
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(incompleteMirror.ok, false);
if (!incompleteMirror.ok) {
  assert.equal(
    incompleteMirror.error.path,
    'operations[0].payload.partIdMap'
  );
}
assert.equal(JSON.stringify(oneSided), oneSidedSnapshot);

const bilateral = execute(oneSided, 'mirror-right', [{
  name: 'model.parts.mirror',
  payload: {
    rootPartId: 'arm.left',
    axis: 'x',
    plane: 0,
    partIdMap: [
      {
        sourcePartId: 'hand.left',
        targetPartId: 'hand.right'
      },
      {
        sourcePartId: 'arm.left',
        targetPartId: 'arm.right'
      }
    ]
  }
}]);
assert.deepEqual(
  bilateral.modeling?.parts.map((part) => part.partId),
  ['arm.left', 'arm.right', 'body', 'hand.left', 'hand.right']
);
assert.equal(
  bilateral.modeling?.parts.find(
    (part) => part.partId === 'hand.right'
  )?.parentPartId,
  'arm.right'
);
assert.ok(
  Object.values(bilateral.scene.nodes).every(
    (node) =>
      node.generation?.authority === 'ashfox.part-compiler'
  ),
  'mirror must project only through compiler-owned generated nodes'
);

const bilateralCompiled = readCompiledParts(bilateral);
assert.equal(bilateralCompiled.ok, true);
if (!bilateralCompiled.ok) {
  throw new Error('Mirrored command model violates part invariants.');
}
for (const [leftId, rightId] of [
  ['arm.left', 'arm.right'],
  ['hand.left', 'hand.right']
] as const) {
  const left = bilateralCompiled.parts.get(leftId);
  const right = bilateralCompiled.parts.get(rightId);
  assert.ok(left);
  assert.ok(right);
  assert.deepEqual(
    [...right.occupancy.cells].sort(),
    [...left.occupancy.cells]
      .map((key) =>
        cellKey(reflectLatticeCell(parseCellKey(key), 'x', 0))
      )
      .sort()
  );
}

const crossingBase: PartSpec = {
  kind: 'plate',
  partId: 'crossing.base',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xz',
  origin: [-4, 0, 0],
  outline: [
    [0, 0],
    [8, 0],
    [8, 2],
    [0, 2]
  ],
  thickness: 1
};
const crossingLeft: PartSpec = {
  kind: 'mass',
  partId: 'crossing.left',
  parentPartId: 'crossing.base',
  materialId: 'teal',
  joint: { kind: 'fixed' },
  attachment: {
    parentAnchor: [-1, 1, 1],
    partAnchor: [-1, 1, 1]
  },
  center: [-1, 2, 1],
  radii: [2, 1, 1],
  profile: 'hard'
};
const crossingOneSided = execute(
  createProject('project-mirror-center-crossing'),
  'upsert-center-crossing',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [crossingBase, crossingLeft],
      materials
    }
  }]
);
const crossingSnapshot = JSON.stringify(crossingOneSided);
const crossingMirror = executeCommandBatch(
  crossingOneSided,
  {
    batchId: 'mirror-center-crossing',
    baseProjectId: crossingOneSided.id,
    baseRevision: crossingOneSided.revision,
    operations: [{
      name: 'model.parts.mirror',
      payload: {
        rootPartId: 'crossing.left',
        axis: 'x',
        plane: 0,
        partIdMap: [{
          sourcePartId: 'crossing.left',
          targetPartId: 'crossing.right'
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(crossingMirror.ok, false);
if (!crossingMirror.ok) {
  assert.equal(crossingMirror.error.code, 'invalid_state');
  assert.equal(
    crossingMirror.error.path,
    'operations[0].payload.plane'
  );
  assert.match(
    crossingMirror.error.message,
    /not exact canonical lattice reflections/
  );
}
assert.equal(
  JSON.stringify(crossingOneSided),
  crossingSnapshot,
  'an inexact center-crossing mirror must fail atomically'
);

const contactMetrics = attachmentContactMetrics(
  bilateralCompiled.parts
);
const leftArmContact = contactMetrics.find(
  (metric) => metric.partId === 'arm.left'
);
assert.deepEqual(leftArmContact, {
  partId: 'arm.left',
  parentPartId: 'body',
  latticeFaceCount: 4,
  contactArea: 4,
  anchorFaceCount: 4
});

const densityTwoEmpty = execute(
  createProject('project-contact-area-density'),
  'set-density-two',
  [{
    name: 'textures.density.set',
    payload: { density: 2 }
  }]
);
const densityTwoModel = execute(
  densityTwoEmpty,
  'upsert-density-two-parts',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [body, arm],
      materials
    }
  }]
);
const densityTwoCompiled = readCompiledParts(densityTwoModel);
assert.equal(densityTwoCompiled.ok, true);
if (!densityTwoCompiled.ok) {
  throw new Error('Density-two contact fixture is invalid.');
}
assert.equal(
  attachmentContactMetrics(densityTwoCompiled.parts).find(
    (metric) => metric.partId === 'arm.left'
  )?.contactArea,
  1,
  'contact area must convert lattice faces to square model units'
);

const contributionMetrics = orthographicContributionMetrics(
  bilateralCompiled.parts
);
for (const view of [
  'west',
  'east',
  'down',
  'up',
  'north',
  'south'
] as const) {
  const entries = contributionMetrics.filter(
    (metric) => metric.view === view
  );
  assert.equal(
    entries.reduce(
      (total, metric) => total + metric.visibleCellCount,
      0
    ),
    entries[0]?.silhouetteCellCount
  );
  assert.ok(
    Math.abs(
      entries.reduce(
        (total, metric) => total + metric.contribution,
        0
      ) - 1
    ) < Number.EPSILON * entries.length
  );
}

const chainParts: readonly PartSpec[] = Array.from(
  { length: 70 },
  (_, index): PartSpec => ({
    kind: 'mass',
    partId: `chain.${index}`,
    parentPartId: index === 0 ? null : `chain.${index - 1}`,
    materialId: 'gold',
    joint: { kind: 'fixed' },
    attachment:
      index === 0
        ? null
        : {
            parentAnchor: [index * 2 - 1, 0, 0],
            partAnchor: [-1, 0, 0]
          },
    center: [0, 0, 0],
    radii: [1, 1, 1],
    profile: 'balanced'
  })
);
const chainStart = createProject('project-transform-parts');
const first64 = execute(chainStart, 'upsert-chain-first', [{
  name: 'model.parts.upsert',
  payload: {
    parts: chainParts.slice(0, 64),
    materials: [materials[0]]
  }
}]);
const fullChain = execute(first64, 'upsert-chain-rest', [{
  name: 'model.parts.upsert',
  payload: {
    parts: chainParts.slice(64),
    materials: []
  }
}]);
const fullChainSnapshot = JSON.stringify(fullChain);
const movedChain = execute(fullChain, 'transform-chain-70', [{
  name: 'model.parts.transform',
  payload: {
    rootPartId: 'chain.0',
    translation: [0, 10, 0]
  }
}]);
const movedCompiled = readCompiledParts(movedChain);
assert.equal(movedCompiled.ok, true);
if (!movedCompiled.ok) {
  throw new Error('Translated 70-part model violates part invariants.');
}
assert.equal(movedCompiled.parts.size, 70);
assert.ok(
  [...movedCompiled.parts.values()].every((part) =>
    [...part.occupancy.cells].every(
      (key) => parseCellKey(key).y >= 9
    )
  ),
  'all 70 descendants must move inside one command'
);
assert.equal(
  fullChain.modeling?.parts.find(
    (part) => part.partId === 'chain.0'
  )?.kind === 'mass' &&
    fullChain.modeling.parts.find(
      (part) => part.partId === 'chain.0'
    )?.center[1],
  0
);

const detachedTransform = executeCommandBatch(
  fullChain,
  {
    batchId: 'transform-detached-subtree',
    baseProjectId: fullChain.id,
    baseRevision: fullChain.revision,
    operations: [{
      name: 'model.parts.transform',
      payload: {
        rootPartId: 'chain.1',
        translation: [0, 10, 0]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(detachedTransform.ok, false);
if (!detachedTransform.ok) {
  assert.equal(
    detachedTransform.error.path,
    'operations[0].payload.translation'
  );
}
assert.equal(
  JSON.stringify(fullChain),
  fullChainSnapshot,
  'failed subtree projection must expose no intermediate document state'
);
