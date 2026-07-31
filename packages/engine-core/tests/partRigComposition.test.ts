import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  type CommandBatch,
  type PartSpec,
  type ProjectDocument
} from '../src';

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

const limb = (axis: 'x' | 'y' | 'z'): PartSpec => ({
  kind: 'mass',
  partId: 'limb',
  parentPartId: 'body',
  materialId: 'gold',
  joint: { kind: 'hinge', axis },
  attachment: {
    parentAnchor: [0, 4, 1],
    partAnchor: [0, 4, 1]
  },
  center: [0, 5, 1],
  radii: [1, 1, 1],
  profile: 'hard'
});

const upsert = (
  parts: readonly PartSpec[],
  includeMaterial = false
): CommandBatch['operations'][number] => ({
  name: 'model.parts.upsert',
  payload: {
    parts: parts.map(({ attachment: _attachment, ...part }) => part),
    materials: includeMaterial
      ? [{ id: 'gold', baseColor: '#C58A32' }]
      : []
  }
});

const channel = (
  axis: 'x' | 'y' | 'z'
): CommandBatch['operations'][number] => {
  const middle = axis === 'x'
    ? [20, 0, 0] as const
    : axis === 'y'
      ? [0, 20, 0] as const
      : [0, 0, 20] as const;
  return {
    name: 'animation.channels.upsert',
    payload: {
      clipId: 'idle',
      channels: [{
        id: 'limb.rotation',
        targetNodeId: 'bone:limb',
        property: 'rotation',
        keys: [
          { id: 'start', timeSeconds: 0, value: [0, 0, 0] },
          { id: 'middle', timeSeconds: 0.5, value: middle },
          { id: 'end', timeSeconds: 1, value: [0, 0, 0] }
        ]
      }]
    }
  };
};

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'agent' }
  );

const empty = createProjectFromInput(
  {
    id: 'part-rig-composition',
    name: 'Part rig composition',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'part_rig_composition',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'rig-0001'
);

const initial = execute(empty, 'author-hinge-x', [
  upsert([root, limb('x')], true),
  {
    name: 'animation.clip.upsert',
    payload: {
      id: 'idle',
      name: 'animation.part_rig.idle',
      durationSeconds: 1,
      fps: 20,
      loop: 'loop'
    }
  },
  channel('x')
]);
assert.equal(initial.ok, true);
if (!initial.ok) throw new Error(initial.error.message);

const invalidTransient = execute(
  initial.document,
  'joint-without-channel-update',
  [upsert([limb('y')])]
);
assert.equal(invalidTransient.ok, false);
if (!invalidTransient.ok) {
  assert.equal(invalidTransient.error.code, 'invalid_state');
  assert.match(invalidTransient.error.path ?? '', /animations\./);
}
assert.deepEqual(
  initial.document.scene.nodes['bone:limb'].generation?.joint,
  { kind: 'hinge', axis: 'x' }
);

const partFirst = execute(initial.document, 'joint-y-part-first', [
  upsert([limb('y')]),
  channel('y')
]);
assert.equal(partFirst.ok, true);
if (!partFirst.ok) throw new Error(partFirst.error.message);

const animationFirst = execute(initial.document, 'joint-y-animation-first', [
  channel('y'),
  upsert([limb('y')])
]);
assert.equal(animationFirst.ok, true);
if (!animationFirst.ok) throw new Error(animationFirst.error.message);

assert.deepEqual(
  animationFirst.document,
  partFirst.document,
  'cross-domain invariants must validate the final atomic state, not operation order'
);
