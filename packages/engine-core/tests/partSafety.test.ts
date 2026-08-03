import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  validateProjectDocument,
  type CommandBatch,
  type CommandBatchResult,
  type PartSpec,
  type ProjectDocument
} from '../src';
import {
  compiledPartCubeId
} from '../src/modeling/provenance';

const root: PartSpec = {
  kind: 'plate',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  plane: 'xy',
  origin: [-2, 0, 0],
  outline: [[0, 0], [4, 0], [4, 4], [0, 4]],
  thickness: 4
};

const child: PartSpec = {
  kind: 'mass',
  partId: 'head',
  parentPartId: 'body',
  materialId: 'gold',
  joint: { kind: 'hinge', axis: 'x' },
  attachment: {
    parentAnchor: [0, 4, 1],
    partAnchor: [0, 4, 1]
  },
  center: [0, 5, 1],
  radii: [1, 1, 1],
  profile: 'hard'
};

const upsert = (
  parts: readonly PartSpec[]
): CommandBatch['operations'][number] => ({
  name: 'model.parts.upsert',
  payload: {
    parts: parts.map(({ attachment: _attachment, ...part }) => part),
    materials: [{ id: 'gold', baseColor: '#C58A32' }]
  }
});

const run = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations'],
  source: 'agent' | 'system' = 'agent'
): CommandBatchResult =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source }
  );

const committed = (
  result: CommandBatchResult
): ProjectDocument => {
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const empty = createProjectFromInput(
  {
    id: 'part-safety',
    name: 'Part safety',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'part_safety',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'safety-0001'
);

const authoredResult = run(
  empty,
  'author-safety-model',
  [upsert([root, child])]
);
const authored = committed(authoredResult);
if (!authoredResult.ok) throw new Error('unreachable');

const nonCanonicalRecipe = structuredClone(authored);
if (!nonCanonicalRecipe.modeling) {
  throw new Error('Authored recipe is unavailable.');
}
nonCanonicalRecipe.modeling.parts = [
  ...nonCanonicalRecipe.modeling.parts
].reverse();
const invalidRecipeDelete = run(
  nonCanonicalRecipe,
  'invalid-recipe-delete',
  [{
    name: 'model.parts.delete',
    payload: { partIds: ['head'] }
  }]
);
assert.equal(invalidRecipeDelete.ok, false);
if (!invalidRecipeDelete.ok) {
  assert.equal(invalidRecipeDelete.error.path, 'modeling');
  assert.doesNotMatch(
    invalidRecipeDelete.error.path ?? '',
    /^operations/
  );
}

const created = new Set(authoredResult.effects.createdEntityIds);
const changed = new Set(authoredResult.effects.changedEntityIds);
const removed = new Set(authoredResult.effects.removedEntityIds);
assert.ok([...created].every((id) => !changed.has(id) && !removed.has(id)));
assert.ok([...changed].every((id) => !removed.has(id)));

const densityInput = JSON.stringify(authored);
const densityChange = run(authored, 'density-after-model', [{
  name: 'textures.density.set',
  payload: { density: 2 }
}], 'system');
assert.equal(densityChange.ok, false);
if (!densityChange.ok) {
  assert.equal(densityChange.error.code, 'invalid_state');
  assert.equal(densityChange.error.path, 'operations[0].payload.density');
}
assert.equal(JSON.stringify(authored), densityInput);

const duplicateUpsert = run(
  empty,
  'duplicate-upsert',
  [upsert([root]), upsert([root])]
);
assert.equal(duplicateUpsert.ok, true);
if (!duplicateUpsert.ok) {
  throw new Error(duplicateUpsert.error.message);
}
assert.equal(
  validateProjectDocument(duplicateUpsert.document).valid,
  true,
  'sequential upserts in one atomic batch must remain canonical'
);

const bodyCube = Object.values(authored.scene.nodes).find(
  (node) =>
    node.kind === 'cube' &&
    node.generation?.partId === 'body'
);
assert.ok(bodyCube?.kind === 'cube');
if (!bodyCube || bodyCube.kind !== 'cube') {
  throw new Error('Body projection cube is missing.');
}

const directGeometryAnimation = run(
  authored,
  'direct-geometry-animation',
  [
    {
      name: 'animation.clip.upsert',
      payload: {
        id: 'bad',
        name: 'animation.part_safety.bad',
        durationSeconds: 1,
        fps: 20,
        loop: 'loop'
      }
    },
    {
      name: 'animation.channels.upsert',
      payload: {
        clipId: 'bad',
        channels: [{
          id: 'bad.geometry',
          targetNodeId: bodyCube.id,
          property: 'rotation',
          keys: [{
            id: 'bad.key',
            timeSeconds: 0,
            value: [0, 0, 0]
          }]
        }]
      }
    }
  ],
  'system'
);
assert.equal(directGeometryAnimation.ok, false);
if (!directGeometryAnimation.ok) {
  assert.equal(directGeometryAnimation.error.code, 'invalid_state');
}

const contained = structuredClone(authored);
const containedBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 1, y: 1, z: 1 }
};
const containedId = compiledPartCubeId(
  'body',
  contained.settings.surfacePixelDensity,
  containedBounds
);
contained.scene.nodes[containedId] = {
  ...structuredClone(bodyCube),
  id: containedId,
  bounds: {
    from: [0, 0, 0],
    to: [1, 1, 1]
  }
};
const containedReport = validateProjectDocument(contained);
assert.ok(
  containedReport.findings.some(
    (finding) => finding.code === 'model.part_overlap'
  )
);

const hidden = structuredClone(authored);
hidden.scene.nodes['bone:body'].visible = false;
assert.ok(
  validateProjectDocument(hidden).findings.some(
    (finding) => finding.code === 'model.part_provenance'
  )
);

const oversized = structuredClone(authored);
for (const [nodeId, node] of Object.entries(oversized.scene.nodes)) {
  if (node.kind === 'cube' && node.generation?.partId === 'body') {
    delete oversized.scene.nodes[nodeId];
  }
}
const oversizedBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 257, y: 1, z: 1 }
};
const oversizedId = compiledPartCubeId(
  'body',
  oversized.settings.surfacePixelDensity,
  oversizedBounds
);
oversized.scene.nodes[oversizedId] = {
  ...structuredClone(bodyCube),
  id: oversizedId,
  bounds: {
    from: [0, 0, 0],
    to: [257, 1, 1]
  }
};
assert.ok(
  validateProjectDocument(oversized).findings.some(
    (finding) => finding.code === 'model.part_budget'
  )
);

const animated = committed(run(authored, 'animate-head', [
  {
    name: 'animation.motion.upsert',
    payload: {
      clipId: 'idle',
      role: 'idle',
      durationFrames: 20,
      poses: [{
        rotations: { head: -10 }
      }, {
        rotations: { head: 10 }
      }]
    }
  }
]));
const deleted = run(animated, 'delete-animated-head', [{
  name: 'model.parts.delete',
  payload: { partIds: ['head'] }
}]);
assert.equal(deleted.ok, true);
if (!deleted.ok) throw new Error(deleted.error.message);
assert.ok(
  deleted.effects.removedEntityIds.includes(
    'animation:idle:channel:head:rotation'
  )
);
assert.ok(deleted.effects.removedEntityIds.includes('idle'));
assert.ok(!deleted.effects.changedEntityIds.includes('idle'));
assert.ok(deleted.effects.removedEntityIds.includes('bone:head'));
assert.deepEqual(
  deleted.document.animations,
  {},
  'part deletion must not invent replacement motion'
);
assert.equal(validateProjectDocument(deleted.document).valid, true);

const withForeign = committed(run(authored, 'foreign-far-away', [{
  name: 'scene.cubes.create',
  payload: {
    cubes: [{
      id: 'foreign-far',
      name: 'foreign far',
      parentId: null,
      bounds: {
        from: [100, 100, 100],
        to: [101, 101, 101]
      }
    }]
  }
}], 'system'));
const foreignOverlap = run(withForeign, 'move-foreign-into-model', [{
  name: 'scene.nodes.transform',
  payload: {
    nodeIds: ['foreign-far'],
    transform: {
      position: [-100, -100, -100]
    }
  }
}], 'system');
assert.equal(foreignOverlap.ok, false);
if (!foreignOverlap.ok) {
  assert.equal(foreignOverlap.error.code, 'invalid_state');
  assert.match(foreignOverlap.error.path ?? '', /^scene\.nodes\./);
}
