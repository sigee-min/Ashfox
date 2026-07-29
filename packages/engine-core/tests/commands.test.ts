import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  getCommandDefinition,
  listCommandDefinitions,
  type CommandBatch
} from '../src';
import { createGltfProject } from './helpers';

const project = createGltfProject();

assert.deepEqual(
  listCommandDefinitions().map((definition) => definition.name),
  [
    'project.rename',
    'project.target.set',
    'scene.bones.create',
    'scene.nodes.transform',
    'scene.nodes.visibility',
    'scene.cubes.create',
    'scene.nodes.delete',
    'scene.cubes.duplicate',
    'scene.cubes.mirror',
    'scene.cubes.repeat',
    'scene.nodes.align',
    'scene.nodes.pivot',
    'scene.nodes.reparent',
    'scene.cubes.uv.fit',
    'scene.cubes.material',
    'textures.preview.set',
    'textures.rename',
    'textures.raster.set',
    'textures.uvAtlas.generate',
    'animation.clip.upsert',
    'animation.channels.upsert',
    'animation.channels.phase',
    'animation.channels.mirror',
    'animation.clip.closeLoop',
    'animation.clip.delete'
  ]
);
assert.equal(
  getCommandDefinition('scene.nodes.transform')?.inputSchema.type,
  'object'
);

{
  const payload = {
    target: {
      nodeIds: ['cube-body']
    },
    pixelsPerBlock: 16,
    padding: 1,
    maxResolution: 128,
    seed: 42,
    intensity: 0.22,
    edge: 0.12,
    noise: 0.06,
    lightDir: 'tl_br' as const
  };
  const first = executeCommandBatch(project, {
    batchId: 'batch-minecraft-atlas-a',
    baseRevision: project.revision,
    operations: [{
      name: 'textures.uvAtlas.generate',
      payload
    }]
  });
  const second = executeCommandBatch(project, {
    batchId: 'batch-minecraft-atlas-b',
    baseRevision: project.revision,
    operations: [{
      name: 'textures.uvAtlas.generate',
      payload
    }]
  });
  if (!first.ok || !second.ok) {
    throw new Error(
      !first.ok ? first.error.message : second.ok ? '' : second.error.message
    );
  }
  assert.deepEqual(first.document, second.document);
  assert.equal(first.document.settings.uvPixelsPerUnit, 1);
  assert.equal(
    first.document.textures['texture-base'].raster?.pattern?.regions.length,
    6
  );
  const atlasCube = first.document.scene.nodes['cube-body'];
  assert.equal(atlasCube.kind, 'cube');
  if (atlasCube.kind !== 'cube') throw new Error('Atlas cube missing');
  const northUv = atlasCube.faces.north.uv;
  assert.equal((northUv?.[2] ?? 0) - (northUv?.[0] ?? 0), 8);
  assert.equal((northUv?.[3] ?? 0) - (northUv?.[1] ?? 0), 8);
}

{
  const batch: CommandBatch = {
    batchId: 'batch-project-settings',
    baseRevision: project.revision,
    operations: [
      {
        name: 'project.rename',
        payload: {
          name: 'Renamed crate'
        }
      },
      {
        name: 'project.target.set',
        payload: {
          target: 'geckolib5',
          namespace: 'ashfox',
          modelPath: 'renamed_crate'
        }
      }
    ]
  };
  const result = executeCommandBatch(project, batch);
  if (!result.ok) throw new Error(result.error.message);
  assert.equal(result.document.name, 'Renamed crate');
  assert.equal(
    result.document.formatProfile.id,
    'minecraft.java.geckolib5'
  );
  assert.deepEqual(
    result.document.textures['texture-base'].minecraft?.resource,
    {
      namespace: 'ashfox',
      path: 'entity/renamed_crate'
    }
  );
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-gltf-target',
    baseRevision: project.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'gltf',
        namespace: 'unused',
        modelPath: 'crate'
      }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  assert.deepEqual(result.document.formatProfile, {
    id: 'gltf.2',
    version: '2.0',
    container: 'gltf',
    imageStorage: 'external',
    modelPath: 'crate'
  });
}

{
  const batch: CommandBatch = {
    batchId: 'batch-create-bones',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.bones.create',
        payload: {
          bones: [{
            id: 'bone-leg',
            name: 'front_left_leg',
            parentId: 'bone-root',
            transform: {
              pivot: [-2, 4, -3]
            }
          }]
        }
      }
    ]
  };
  const result = executeCommandBatch(project, batch);
  if (!result.ok) throw new Error(result.error.message);
  assert.equal(result.document.scene.nodes['bone-leg'].kind, 'bone');
  assert.deepEqual(
    result.document.scene.nodes['bone-leg'].transform.pivot,
    [-2, 4, -3]
  );
  assert.deepEqual(result.effects.createdEntityIds, ['bone-leg']);
  assert.equal(project.scene.nodes['bone-leg'], undefined);
}

{
  const batch: CommandBatch = {
    batchId: 'batch-authoring',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: ['cube-body'],
          transform: {
            position: [2, 0, 0]
          }
        }
      },
      {
        name: 'scene.cubes.create',
        payload: {
          cubes: [
            {
              id: 'cube-detail',
              name: 'Detail',
              parentId: 'bone-root',
              bounds: {
                from: [-1, 8, -1],
                to: [1, 10, 1]
              },
              textureId: 'texture-base'
            },
            {
              id: 'cube-root-detail',
              name: 'Root detail',
              parentId: null,
              bounds: {
                from: [-1, 0, -1],
                to: [1, 2, 1]
              }
            }
          ]
        }
      }
    ]
  };
  const result = executeCommandBatch(project, batch);
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ${result.error.path ?? '-'}`
    );
  }
  assert.deepEqual(
    result.document.scene.nodes['cube-body'].transform.position,
    [2, 0, 0]
  );
  assert.equal(result.document.scene.nodes['cube-detail'].kind, 'cube');
  assert.ok(result.document.scene.roots.includes('cube-root-detail'));
  assert.deepEqual(result.effects.changedEntityIds, ['cube-body']);
  assert.deepEqual(
    result.effects.createdEntityIds,
    ['cube-detail', 'cube-root-detail']
  );
  assert.deepEqual(
    project.scene.nodes['cube-body'].transform.position,
    [0, 0, 0]
  );
  assert.equal(project.scene.nodes['cube-detail'], undefined);
}

{
  const batch: CommandBatch = {
    batchId: 'batch-deterministic-tools',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.cubes.duplicate',
        payload: {
          copies: [
            {
              sourceId: 'cube-body',
              id: 'cube-copy',
              name: 'body copy',
              offset: [8, 0, 0]
            }
          ]
        }
      },
      {
        name: 'scene.cubes.repeat',
        payload: {
          nodeIds: ['cube-body'],
          count: 2,
          step: [0, 10, 0],
          idPrefix: 'repeat'
        }
      },
      {
        name: 'scene.cubes.mirror',
        payload: {
          nodeIds: ['cube-copy'],
          axis: 'x'
        }
      },
      {
        name: 'scene.nodes.align',
        payload: {
          nodeIds: ['cube-body', 'cube-copy'],
          axis: 'y',
          mode: 'center'
        }
      },
      {
        name: 'scene.nodes.pivot',
        payload: {
          nodeIds: ['cube-copy'],
          pivot: [0, 4, 0]
        }
      },
      {
        name: 'scene.cubes.uv.fit',
        payload: {
          nodeIds: ['cube-copy'],
          padding: 1
        }
      },
      {
        name: 'scene.cubes.material',
        payload: {
          nodeIds: ['cube-copy'],
          textureId: 'texture-base',
          shade: true,
          lightEmission: 0
        }
      },
      {
        name: 'textures.preview.set',
        payload: {
          textureId: 'texture-base',
          color: '#a4613a'
        }
      },
      {
        name: 'textures.rename',
        payload: {
          textureId: 'texture-base',
          name: 'Crate atlas'
        }
      },
      {
        name: 'textures.raster.set',
        payload: {
          textureId: 'texture-base',
          background: '#a4613a',
          rectangles: [{
            x: 0,
            y: 0,
            width: 4,
            height: 4,
            color: '#ffffff'
          }]
        }
      },
      {
        name: 'animation.clip.upsert',
        payload: {
          id: 'clip-walk',
          name: 'Walk',
          durationSeconds: 1,
          fps: 20,
          loop: 'loop'
        }
      },
      {
        name: 'animation.channels.upsert',
        payload: {
          clipId: 'clip-walk',
          channels: [
            {
              id: 'channel-copy-position',
              targetNodeId: 'cube-copy',
              property: 'position',
              keys: [
                {
                  id: 'copy-start',
                  timeSeconds: 0,
                  value: [0, 0, 0]
                },
                {
                  id: 'copy-middle',
                  timeSeconds: 0.5,
                  value: [2, 0, 0],
                  interpolation: 'linear'
                }
              ]
            }
          ]
        }
      },
      {
        name: 'animation.channels.phase',
        payload: {
          clipId: 'clip-walk',
          channelIds: ['channel-copy-position'],
          offsetSeconds: 0.25,
          wrap: true
        }
      },
      {
        name: 'animation.channels.mirror',
        payload: {
          clipId: 'clip-walk',
          channelIds: ['channel-copy-position'],
          axis: 'x'
        }
      },
      {
        name: 'animation.clip.closeLoop',
        payload: {
          clipId: 'clip-walk',
          channelIds: ['channel-copy-position']
        }
      }
    ]
  };
  const result = executeCommandBatch(project, batch);
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ${result.error.path ?? '-'}`
    );
  }
  assert.equal(result.document.scene.nodes['cube-copy'].kind, 'cube');
  assert.ok(result.document.scene.nodes['repeat-cube-body-1']);
  assert.ok(result.document.scene.nodes['repeat-cube-body-2']);
  assert.equal(
    result.document.textures['texture-base'].metadata?.previewColor,
    '#a4613a'
  );
  assert.equal(
    result.document.textures['texture-base'].name,
    'Crate atlas'
  );
  const walk = result.document.animations['clip-walk'];
  const channel = walk.channels['channel-copy-position'];
  assert.equal(channel.keys[0].timeSeconds, 0);
  assert.equal(channel.keys.at(-1)?.timeSeconds, 1);
  assert.deepEqual(channel.keys[0].value, channel.keys.at(-1)?.value);

  const deleteBatch: CommandBatch = {
    batchId: 'batch-delete-tools',
    baseRevision: result.document.revision,
    operations: [
      {
        name: 'scene.nodes.delete',
        payload: {
          nodeIds: ['cube-copy']
        }
      }
    ]
  };
  const deleted = executeCommandBatch(result.document, deleteBatch);
  if (!deleted.ok) {
    throw new Error(
      `${deleted.error.code}: ${deleted.error.message} at ${deleted.error.path ?? '-'}`
    );
  }
  assert.equal(deleted.document.scene.nodes['cube-copy'], undefined);
  assert.equal(
    deleted.document.animations['clip-walk'],
    undefined
  );
}

{
  const stale: CommandBatch = {
    batchId: 'batch-stale',
    baseRevision: 'revision-stale',
    operations: [
      {
        name: 'scene.nodes.visibility',
        payload: {
          nodeIds: ['cube-body'],
          visible: false
        }
      }
    ]
  };
  const result = executeCommandBatch(project, stale);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('stale batch unexpectedly applied');
  assert.equal(result.error.code, 'revision_mismatch');
  assert.equal(project.scene.nodes['cube-body'].visible, true);
}

{
  const invalidPayload: CommandBatch = {
    batchId: 'batch-invalid-payload',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: ['cube-body'],
          transform: {
            position: [Number.NaN, 0, 0]
          }
        }
      }
    ]
  };
  const result = executeCommandBatch(project, invalidPayload);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('invalid payload unexpectedly applied');
  assert.equal(result.error.code, 'invalid_payload');
  assert.equal(
    result.error.path,
    'operations[0].payload.transform.position[0]'
  );
}

{
  const atomicFailure: CommandBatch = {
    batchId: 'batch-atomic-failure',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.nodes.visibility',
        payload: {
          nodeIds: ['cube-body'],
          visible: false
        }
      },
      {
        name: 'scene.nodes.transform',
        payload: {
          nodeIds: ['missing-node'],
          transform: {
            position: [1, 0, 0]
          }
        }
      }
    ]
  };
  const result = executeCommandBatch(project, atomicFailure);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('invalid state unexpectedly applied');
  assert.equal(result.error.code, 'invalid_state');
  assert.equal(project.scene.nodes['cube-body'].visible, true);
}

{
  const noChange: CommandBatch = {
    batchId: 'batch-no-change',
    baseRevision: project.revision,
    operations: [
      {
        name: 'scene.nodes.visibility',
        payload: {
          nodeIds: ['cube-body'],
          visible: true
        }
      }
    ]
  };
  const result = executeCommandBatch(project, noChange);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('no-op batch unexpectedly applied');
  assert.equal(result.error.code, 'no_change');
}
