import assert from 'node:assert/strict';

import {
  CUBE_FACE_DIRECTIONS,
  composeTextureRaster,
  createProjectFromInput,
  executeCommandBatch,
  getCommandDefinition,
  listCommandDefinitions,
  validateProjectDocument,
  type CommandBatch,
  type ProjectDocument
} from '../src';

const commandNames = listCommandDefinitions().map(
  (definition) => definition.name
);

assert.deepEqual(commandNames, [
  'project.create',
  'project.rename',
  'project.target.set',
  'scene.bones.create',
  'scene.locators.create',
  'scene.nodes.transform',
  'scene.nodes.visibility',
  'scene.cubes.create',
  'scene.cubes.geometry.update',
  'scene.nodes.rename',
  'scene.nodes.delete',
  'scene.cubes.duplicate',
  'scene.cubes.mirror',
  'scene.cubes.repeat',
  'scene.nodes.align',
  'scene.nodes.pivot',
  'scene.nodes.reparent',
  'scene.cubes.material',
  'textures.sync',
  'animation.clip.upsert',
  'animation.channels.upsert',
  'animation.triggers.upsert',
  'animation.tracks.delete',
  'animation.channels.phase',
  'animation.channels.mirror',
  'animation.clip.closeLoop',
  'animation.clip.delete'
]);
assert.equal(
  getCommandDefinition('scene.cubes.material')?.inputSchema.type,
  'object'
);

const createEmptyProject = (): ProjectDocument =>
  createProjectFromInput(
    {
      id: 'project-command-contract',
      name: 'Command contract',
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: 'command_contract',
      createdAt: '2026-07-30T00:00:00.000Z'
    },
    'revision-command-contract'
  );

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = executeCommandBatch(document, {
    batchId,
    baseRevision: document.revision,
    operations
  });
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ` +
      `${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const empty = createEmptyProject();
assert.deepEqual(empty.settings.textureResolution, {
  width: 16,
  height: 16
});
assert.deepEqual(empty.textures, {});

const modeled = execute(empty, 'batch-model', [
  {
    name: 'scene.bones.create',
    payload: {
      bones: [
        {
          id: 'bone-child',
          name: 'child',
          parentId: 'bone-root',
          transform: { pivot: [0, 4, 0] }
        },
        {
          id: 'bone-root',
          name: 'root',
          parentId: null
        }
      ]
    }
  },
  {
    name: 'scene.cubes.create',
    payload: {
      cubes: [
        {
          id: 'cube-body',
          name: 'body',
          parentId: 'bone-root',
          bounds: {
            from: [-2, 0, -3],
            to: [2, 4, 3]
          },
          baseColor: '#B45A2A'
        },
        {
          id: 'cube-head',
          name: 'head',
          parentId: 'bone-child',
          bounds: {
            from: [-2, 4, -2],
            to: [2, 8, 2]
          },
          baseColor: '#E1B36A'
        }
      ]
    }
  }
]);

assert.deepEqual(Object.keys(modeled.textures), ['texture-base']);
for (const nodeId of ['cube-body', 'cube-head']) {
  const node = modeled.scene.nodes[nodeId];
  assert.equal(node.kind, 'cube');
  if (node.kind !== 'cube') throw new Error(`${nodeId} missing`);
  assert.ok(
    CUBE_FACE_DIRECTIONS.every(
      (direction) => node.faces[direction].textureId === 'texture-base'
    )
  );
}

const synchronized = execute(modeled, 'batch-sync', [{
  name: 'textures.sync',
  payload: {}
}]);
assert.equal(synchronized.settings.uvPixelsPerUnit, 1);
assert.ok(
  synchronized.settings.textureResolution.width >= 16
);
assert.equal(
  synchronized.settings.textureResolution.width,
  synchronized.settings.textureResolution.height
);

const body = synchronized.scene.nodes['cube-body'];
if (body.kind !== 'cube') throw new Error('Body cube missing');
assert.deepEqual(
  [
    body.faces.north.uv?.[2] - (body.faces.north.uv?.[0] ?? 0),
    body.faces.north.uv?.[3] - (body.faces.north.uv?.[1] ?? 0)
  ],
  [4, 4]
);
assert.deepEqual(
  [
    body.faces.up.uv?.[2] - (body.faces.up.uv?.[0] ?? 0),
    body.faces.up.uv?.[3] - (body.faces.up.uv?.[1] ?? 0)
  ],
  [4, 6]
);

const texture = synchronized.textures['texture-base'];
const composition = composeTextureRaster(synchronized, texture);
const bodyRegions = composition.regions.filter(
  (region) => region.nodeId === 'cube-body'
);
assert.equal(bodyRegions.length, 6);
assert.ok(
  bodyRegions.every((region) => region.color === '#B45A2A')
);
assert.ok(bodyRegions.every((region) => !('tone' in region)));

const recolored = execute(synchronized, 'batch-material', [{
  name: 'scene.cubes.material',
  payload: {
    nodeIds: ['cube-body'],
    baseColor: '#2F6F45'
  }
}]);
const recoloredBody = recolored.scene.nodes['cube-body'];
assert.equal(recoloredBody.kind, 'cube');
if (recoloredBody.kind !== 'cube') {
  throw new Error('Recolored body missing');
}
assert.equal(recoloredBody.baseColor, '#2F6F45');
assert.ok(
  CUBE_FACE_DIRECTIONS.every(
    (direction) =>
      recoloredBody.faces[direction].textureId === 'texture-base'
  )
);

assert.ok(
  composeTextureRaster(
    recolored,
    recolored.textures['texture-base']
  ).regions
    .filter((region) => region.nodeId === 'cube-body')
    .every((region) => region.color === '#2F6F45')
);

const noChange = executeCommandBatch(recolored, {
  batchId: 'batch-sync-no-change',
  baseRevision: recolored.revision,
  operations: [{
    name: 'textures.sync',
    payload: {}
  }]
});
assert.equal(noChange.ok, false);
if (noChange.ok) throw new Error('Synchronized atlas must be a no-op');
assert.equal(noChange.error.code, 'no_change');

const fractionalBatch = executeCommandBatch(recolored, {
  batchId: 'batch-fractional-grid',
  baseRevision: recolored.revision,
  operations: [
    {
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: 'cube-body',
          bounds: {
            from: [-2, 0, -3],
            to: [2.5, 4, 3]
          }
        }]
      }
    },
    {
      name: 'textures.sync',
      payload: {}
    }
  ]
});
assert.equal(fractionalBatch.ok, false);
if (fractionalBatch.ok) {
  throw new Error('Fractional texel grid must be rejected');
}
assert.equal(fractionalBatch.error.code, 'invalid_state');
assert.match(fractionalBatch.error.message, /square-pixel grid/);
assert.deepEqual(
  recolored.scene.nodes['cube-body'],
  recoloredBody
);

const deterministic = execute(recolored, 'batch-tools', [
  {
    name: 'scene.cubes.duplicate',
    payload: {
      copies: [{
        sourceId: 'cube-body',
        id: 'cube-copy',
        offset: [8, 0, 0]
      }]
    }
  },
  {
    name: 'scene.cubes.repeat',
    payload: {
      nodeIds: ['cube-head'],
      count: 2,
      step: [0, 5, 0],
      idPrefix: 'repeat'
    }
  },
  {
    name: 'scene.cubes.mirror',
    payload: {
      nodeIds: ['cube-copy'],
      axis: 'x'
    }
  }
]);
const copy = deterministic.scene.nodes['cube-copy'];
assert.equal(copy.kind, 'cube');
if (copy.kind !== 'cube') throw new Error('Cube copy missing');
assert.equal(copy.baseColor, '#2F6F45');
assert.ok(deterministic.scene.nodes['repeat-cube-head-1']);
assert.ok(deterministic.scene.nodes['repeat-cube-head-2']);

const animated = execute(deterministic, 'batch-animation', [
  {
    name: 'animation.clip.upsert',
    payload: {
      id: 'animation-command-contract-idle',
      name: 'animation.command_contract.idle',
      durationSeconds: 1,
      fps: 20,
      loop: 'loop'
    }
  },
  {
    name: 'animation.channels.upsert',
    payload: {
      clipId: 'animation-command-contract-idle',
      channels: [{
        id: 'channel-root-idle',
        targetNodeId: 'bone-root',
        property: 'rotation',
        keys: [
          {
            id: 'key-root-start',
            timeSeconds: 0,
            value: [0, 0, 0]
          },
          {
            id: 'key-root-middle',
            timeSeconds: 0.5,
            value: [0, 4, 0]
          },
          {
            id: 'key-root-end',
            timeSeconds: 1,
            value: [0, 0, 0]
          }
        ]
      }]
    }
  }
]);
assert.equal(
  animated.animations['animation-command-contract-idle']
    .channels['channel-root-idle'].keys.length,
  3
);

const renamed = execute(animated, 'batch-project', [
  {
    name: 'project.rename',
    payload: { name: 'Finished command contract' }
  },
  {
    name: 'project.target.set',
    payload: {
      target: 'bedrock',
      namespace: 'ashfox',
      modelPath: 'command_contract'
    }
  }
]);
assert.equal(renamed.name, 'Finished command contract');
assert.equal(renamed.formatProfile.id, 'minecraft.bedrock');
assert.equal(validateProjectDocument(renamed).valid, true);

const invalidColor = executeCommandBatch(renamed, {
  batchId: 'batch-invalid-color',
  baseRevision: renamed.revision,
  operations: [{
    name: 'scene.cubes.material',
    payload: {
      nodeIds: ['cube-body'],
      baseColor: 'green'
    }
  }]
});
assert.equal(invalidColor.ok, false);
if (invalidColor.ok) throw new Error('Invalid color must fail');
assert.equal(invalidColor.error.code, 'invalid_payload');
