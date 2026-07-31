import assert from 'node:assert/strict';

import {
  CUBE_FACE_DIRECTIONS,
  composeTextureRaster,
  createProjectFromInput,
  executeCommandBatch,
  getCommandDefinition,
  listAgentCommandDefinitions,
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
  'project.resource.set',
  'project.intent.set',
  'model.parts.upsert',
  'model.parts.mirror',
  'model.parts.transform',
  'model.parts.material',
  'model.parts.delete',
  'scene.bones.create',
  'scene.locators.create',
  'scene.locators.update',
  'scene.locators.delete',
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
  'textures.density.set',
  'animation.clip.upsert',
  'animation.motion.upsert',
  'animation.channels.upsert',
  'animation.triggers.upsert',
  'animation.tracks.delete',
  'animation.channels.phase',
  'animation.channels.mirror',
  'animation.clip.closeLoop',
  'animation.clip.delete'
]);
assert.deepEqual(
  listAgentCommandDefinitions().map((definition) => definition.name),
  [
    'project.create',
    'project.rename',
    'project.target.set',
    'project.intent.set',
    'model.parts.upsert',
    'model.parts.mirror',
    'model.parts.transform',
    'model.parts.material',
    'model.parts.delete',
    'scene.locators.delete',
    'textures.density.set',
    'animation.motion.upsert',
    'animation.clip.delete'
  ]
);
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
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  }, { source: 'system' });
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
assert.equal(empty.settings.surfacePixelDensity, 1);
assert.deepEqual(empty.textures, {});

const wrongProject = executeCommandBatch(empty, {
  batchId: 'batch-wrong-project',
  baseProjectId: 'stale-project',
  baseRevision: empty.revision,
  operations: [{
    name: 'project.rename',
    payload: { name: 'Must not apply' }
  }]
}, { source: 'system' });
assert.equal(wrongProject.ok, false);
if (!wrongProject.ok) {
  assert.equal(wrongProject.error.code, 'project_mismatch');
  assert.equal(wrongProject.error.path, 'baseProjectId');
  assert.equal(wrongProject.error.expected, empty.id);
}
assert.equal(empty.name, 'Command contract');

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

assert.equal(modeled.settings.surfacePixelDensity, 1);
assert.ok(
  modeled.settings.textureResolution.width >= 16
);
assert.equal(
  modeled.settings.textureResolution.width,
  modeled.settings.textureResolution.height
);

const body = modeled.scene.nodes['cube-body'];
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

const texture = modeled.textures['texture-base'];
const composition = composeTextureRaster(modeled, texture);
const bodyRegions = composition.regions.filter(
  (region) => region.nodeId === 'cube-body'
);
assert.equal(bodyRegions.length, 6);
assert.ok(
  bodyRegions.every((region) => region.color === '#B45A2A')
);
assert.ok(bodyRegions.every((region) => !('tone' in region)));
assert.equal(composition.gutter, 1);

const detailed = execute(modeled, 'batch-density-2x', [{
  name: 'textures.density.set',
  payload: {
    density: 2
  }
}]);
assert.equal(detailed.settings.surfacePixelDensity, 2);
const detailedBody = detailed.scene.nodes['cube-body'];
if (detailedBody.kind !== 'cube') {
  throw new Error('Detailed body cube missing');
}
assert.deepEqual(
  [
    detailedBody.faces.north.uv?.[2] -
      (detailedBody.faces.north.uv?.[0] ?? 0),
    detailedBody.faces.north.uv?.[3] -
      (detailedBody.faces.north.uv?.[1] ?? 0)
  ],
  [8, 8]
);
assert.equal(
  composeTextureRaster(
    detailed,
    detailed.textures['texture-base']
  ).gutter,
  2
);
const detailedUvs = Object.values(detailed.scene.nodes)
  .flatMap((node) =>
    node.kind === 'cube'
      ? Object.values(node.faces).flatMap((face) =>
          face.textureId === 'texture-base' && face.uv
            ? [face.uv]
            : []
        )
      : []
  );
assert.equal(
  Math.min(...detailedUvs.map((uv) => uv[0])),
  2,
  'packed UVs must use the same density-scaled gutter as raster extrusion'
);
assert.equal(
  Math.min(...detailedUvs.map((uv) => uv[1])),
  2,
  'the first atlas row must reserve exactly one derived gutter'
);
const unchangedDensity = executeCommandBatch(detailed, {
  batchId: 'batch-density-unchanged',
  baseProjectId: detailed.id,
  baseRevision: detailed.revision,
  operations: [{
    name: 'textures.density.set',
    payload: { density: 2 }
  }]
}, { source: 'system' });
assert.equal(unchangedDensity.ok, false);
if (!unchangedDensity.ok) {
  assert.equal(unchangedDensity.error.code, 'no_change');
}
const invalidDensity = executeCommandBatch(detailed, {
  batchId: 'batch-density-invalid',
  baseProjectId: detailed.id,
  baseRevision: detailed.revision,
  operations: [{
    name: 'textures.density.set',
    payload: {
      density: 3
    } as { density: 1 }
  }]
}, { source: 'system' });
assert.equal(invalidDensity.ok, false);
if (!invalidDensity.ok) {
  assert.equal(invalidDensity.error.code, 'invalid_payload');
}

const materialInput = structuredClone(detailed);
const materialInputBody = materialInput.scene.nodes['cube-body'];
assert.equal(materialInputBody.kind, 'cube');
if (materialInputBody.kind !== 'cube') {
  throw new Error('Material input body missing');
}
materialInputBody.faces.north.enabled = false;
const disabledFaceRecolored = execute(
  materialInput,
  'batch-material-disabled-face',
  [{
    name: 'scene.cubes.material',
    payload: {
      nodeIds: ['cube-body'],
      baseColor: '#2F6F45'
    }
  }]
);
const disabledFaceBody =
  disabledFaceRecolored.scene.nodes['cube-body'];
assert.equal(disabledFaceBody.kind, 'cube');
if (disabledFaceBody.kind !== 'cube') {
  throw new Error('Disabled-face recolored body missing');
}
assert.equal(
  disabledFaceBody.faces.north.enabled,
  false,
  'material assignment must preserve intentionally disabled raw faces'
);

const recolored = execute(detailed, 'batch-material', [{
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

const scalable = execute(recolored, 'batch-scale-target', [{
  name: 'project.target.set',
  payload: {
    target: 'glb'
  }
}, {
  name: 'project.resource.set',
  payload: {
    namespace: 'ashfox',
    modelPath: 'command_contract'
  }
}]);
const scaled = executeCommandBatch(scalable, {
  batchId: 'batch-scale-derived-texture',
  baseProjectId: scalable.id,
  baseRevision: scalable.revision,
  operations: [{
    name: 'scene.nodes.transform',
    payload: {
      nodeIds: ['cube-body'],
      transform: {
        scale: [1.5, 1, 1]
      }
    }
  }]
}, { source: 'system' });
assert.equal(scaled.ok, true);
if (!scaled.ok) {
  throw new Error('Scale must derive generated surfaces automatically.');
}
const scaledBody = scaled.document.scene.nodes['cube-body'];
if (scaledBody.kind !== 'cube') {
  throw new Error('Scaled body cube missing');
}
assert.equal(
  scaledBody.faces.north.uv?.[2] -
    (scaledBody.faces.north.uv?.[0] ?? 0),
  12
);

const invalidScale = executeCommandBatch(scalable, {
  batchId: 'batch-invalid-scale-grid',
  baseProjectId: scalable.id,
  baseRevision: scalable.revision,
  operations: [{
    name: 'scene.nodes.transform',
    payload: {
      nodeIds: ['cube-body'],
      transform: {
        scale: [1.1, 1, 1]
      }
    }
  }]
}, { source: 'system' });
assert.equal(invalidScale.ok, false);
if (invalidScale.ok) {
  throw new Error('Off-grid scale must be rejected atomically.');
}
assert.equal(invalidScale.error.code, 'invalid_state');
assert.match(invalidScale.error.message, /square-pixel grid/);

const halfUnitBatch = executeCommandBatch(recolored, {
  batchId: 'batch-half-unit-grid',
  baseProjectId: recolored.id,
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
    }
  ]
}, { source: 'system' });
assert.equal(halfUnitBatch.ok, true);
if (!halfUnitBatch.ok) {
  throw new Error('2× density must accept half-unit geometry');
}

const invalidQuarterBatch = executeCommandBatch(recolored, {
  batchId: 'batch-invalid-quarter-grid',
  baseProjectId: recolored.id,
  baseRevision: recolored.revision,
  operations: [
    {
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: 'cube-body',
          bounds: {
            from: [-2, 0, -3],
            to: [2.25, 4, 3]
          }
        }]
      }
    }
  ]
}, { source: 'system' });
assert.equal(invalidQuarterBatch.ok, false);
if (invalidQuarterBatch.ok) {
  throw new Error('Off-grid geometry must be rejected');
}
assert.equal(invalidQuarterBatch.error.code, 'invalid_state');
assert.match(invalidQuarterBatch.error.message, /square-pixel grid/);
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
      target: 'bedrock'
    }
  },
  {
    name: 'project.resource.set',
    payload: {
      namespace: 'ashfox',
      modelPath: 'command_contract'
    }
  }
]);
assert.equal(renamed.name, 'Finished command contract');
assert.equal(renamed.formatProfile.id, 'minecraft.bedrock');
assert.equal(validateProjectDocument(renamed).valid, true);

const locatorBase = createProjectFromInput(
  {
    id: 'project-locator-lifecycle',
    name: 'Locator lifecycle',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'locator_lifecycle',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'locator-lifecycle-0001'
);
const withLocator = execute(locatorBase, 'batch-locator-create', [{
  name: 'scene.locators.create',
  payload: {
    locators: [{
      id: 'locator-muzzle',
      name: 'Muzzle',
      parentId: null
    }]
  }
}]);
const withLocatorBone = execute(
  withLocator,
  'batch-locator-bone',
  [{
    name: 'scene.bones.create',
    payload: {
      bones: [{
        id: 'bone-locator-root',
        name: 'locator_root',
        parentId: null
      }]
    }
  }]
);
const updatedLocatorProject = execute(
  withLocatorBone,
  'batch-locator-update',
  [{
    name: 'scene.locators.update',
    payload: {
      locators: [{
        id: 'locator-muzzle',
        name: 'Muzzle flash',
        parentId: 'bone-locator-root',
        transform: {
          position: [1, 2, 3]
        },
        visible: false,
        ignoreInheritedScale: true
      }]
    }
  }]
);
const updatedLocator =
  updatedLocatorProject.scene.nodes['locator-muzzle'];
assert.equal(updatedLocator.kind, 'locator');
if (updatedLocator.kind !== 'locator') {
  throw new Error('Updated locator is missing.');
}
assert.equal(updatedLocator.name, 'Muzzle flash');
assert.equal(updatedLocator.parentId, 'bone-locator-root');
assert.deepEqual(updatedLocator.transform.position, [1, 2, 3]);
assert.equal(updatedLocator.visible, false);
assert.equal(updatedLocator.ignoreInheritedScale, true);
assert.ok(
  !updatedLocatorProject.scene.roots.includes('locator-muzzle')
);

const clearedLocatorProject = execute(
  updatedLocatorProject,
  'batch-locator-clear',
  [{
    name: 'scene.locators.update',
    payload: {
      locators: [{
        id: 'locator-muzzle',
        parentId: null,
        visible: true,
        ignoreInheritedScale: null
      }]
    }
  }]
);
const clearedLocator =
  clearedLocatorProject.scene.nodes['locator-muzzle'];
assert.equal(clearedLocator.kind, 'locator');
if (clearedLocator.kind !== 'locator') {
  throw new Error('Cleared locator is missing.');
}
assert.equal(clearedLocator.ignoreInheritedScale, undefined);
assert.equal(clearedLocator.visible, true);
assert.ok(
  clearedLocatorProject.scene.roots.includes('locator-muzzle')
);

const withoutLocator = execute(
  clearedLocatorProject,
  'batch-locator-delete',
  [{
    name: 'scene.locators.delete',
    payload: {
      locatorIds: ['locator-muzzle']
    }
  }]
);
assert.equal(
  withoutLocator.scene.nodes['locator-muzzle'],
  undefined
);
assert.ok(!withoutLocator.scene.roots.includes('locator-muzzle'));

const invalidColor = executeCommandBatch(renamed, {
  batchId: 'batch-invalid-color',
  baseProjectId: renamed.id,
  baseRevision: renamed.revision,
  operations: [{
    name: 'scene.cubes.material',
    payload: {
      nodeIds: ['cube-body'],
      baseColor: 'green'
    }
  }]
}, { source: 'system' });
assert.equal(invalidColor.ok, false);

const missingSource = executeCommandBatch(
  renamed,
  {
    batchId: 'batch-missing-source',
    baseProjectId: renamed.id,
    baseRevision: renamed.revision,
    operations: [{
      name: 'project.rename',
      payload: { name: 'Must not apply' }
    }]
  },
  undefined as never
);
assert.equal(missingSource.ok, false);
if (!missingSource.ok) {
  assert.equal(missingSource.error.code, 'invalid_batch');
  assert.equal(missingSource.error.path, 'source');
}
if (invalidColor.ok) throw new Error('Invalid color must fail');
assert.equal(invalidColor.error.code, 'invalid_payload');
