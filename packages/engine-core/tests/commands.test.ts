import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  composeTextureRaster,
  executeCommandBatch,
  exportProject,
  getCommandDefinition,
  listCommandDefinitions,
  validateProjectDocument,
  type CommandBatch
} from '../src';
import {
  createAnimatedBedrockProject,
  createBedrockProject,
  createGltfProject
} from './helpers';

const project = createGltfProject();

assert.deepEqual(
  listCommandDefinitions().map((definition) => definition.name),
  [
    'project.create',
    'project.rename',
    'project.target.set',
    'project.textureResolution.set',
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
    'textures.create',
    'textures.rename',
    'textures.details.upsert',
    'textures.delete',
    'textures.sync',
    'animation.clip.upsert',
    'animation.channels.upsert',
    'animation.triggers.upsert',
    'animation.tracks.delete',
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
  const result = executeCommandBatch(project, {
    batchId: 'batch-create-project',
    baseRevision: project.revision,
    operations: [
      {
        name: 'project.create',
        payload: {
          id: 'project-firefly',
          name: 'Firefly',
          target: 'geckolib5',
          namespace: 'ashfox',
          modelPath: 'firefly',
          textureResolution: 32,
          createdAt: '2026-07-29T00:00:00.000Z'
        }
      },
      {
        name: 'scene.bones.create',
        payload: {
          bones: [{
            id: 'bone-firefly-root',
            name: 'root',
            parentId: null
          }]
        }
      },
      {
        name: 'scene.cubes.create',
        payload: {
          cubes: [{
            id: 'cube-firefly-body',
            name: 'body',
            parentId: 'bone-firefly-root',
            bounds: {
              from: [-2, 0, -3],
              to: [2, 3, 3]
            }
          }]
        }
      }
    ]
  });
  if (!result.ok) throw new Error(result.error.message);
  assert.equal(result.document.id, 'project-firefly');
  assert.equal(result.document.name, 'Firefly');
  assert.equal(
    result.document.formatProfile.id,
    'minecraft.java.geckolib5'
  );
  assert.deepEqual(result.document.settings.textureResolution, {
    width: 32,
    height: 32
  });
  assert.equal(
    result.document.scene.nodes['cube-firefly-body'].parentId,
    'bone-firefly-root'
  );
  const fireflyCube =
    result.document.scene.nodes['cube-firefly-body'];
  assert.equal(fireflyCube.kind, 'cube');
  if (fireflyCube.kind !== 'cube') throw new Error('Firefly cube missing');
  assert.deepEqual(Object.keys(result.document.textures), ['texture-base']);
  assert.equal(fireflyCube.faces.north.textureId, 'texture-base');
  assert.equal(
    result.document.textures['texture-base'].atlasMode,
    'generate'
  );
  assert.equal(
    result.document.animations['animation-rest-pose'].name,
    'animation.firefly.rest_pose'
  );
  assert.equal(project.scene.nodes['bone-firefly-root'], undefined);
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-create-project-same-id',
    baseRevision: project.revision,
    operations: [{
      name: 'project.create',
      payload: {
        id: ` ${project.id} `,
        name: 'Replacement',
        target: 'glb',
        namespace: 'ashfox',
        modelPath: 'replacement',
        textureResolution: 64,
        createdAt: '2026-07-29T00:00:00.000Z'
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Same-ID project creation must fail');
  assert.equal(result.error.code, 'invalid_state');
  assert.equal(project.name, 'ashfox_crate');
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-create-project-empty-name',
    baseRevision: project.revision,
    operations: [{
      name: 'project.create',
      payload: {
        id: 'project-empty-name',
        name: '   ',
        target: 'glb',
        namespace: 'ashfox',
        modelPath: 'empty_name',
        textureResolution: 64,
        createdAt: '2026-07-29T00:00:00.000Z'
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Blank project name must fail');
  assert.equal(result.error.code, 'invalid_payload');
  assert.equal(result.error.path, 'operations[0].payload.name');
}

{
  const empty = createProjectFromInput(
    {
      id: 'project-texture-contract',
      name: 'Texture contract',
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: 'texture_contract',
      textureResolution: 64,
      createdAt: '2026-07-29T00:00:00.000Z'
    },
    'revision-texture-contract'
  );
  const explicit = executeCommandBatch(empty, {
    batchId: 'batch-create-explicit-texture',
    baseRevision: empty.revision,
    operations: [{
      name: 'textures.create',
      payload: {
        textures: [{
          id: 'texture-shell',
          name: 'Shell',
          width: 32,
          height: 16,
          atlasMode: 'preserve',
          background: '#c06020'
        }]
      }
    }]
  });
  if (!explicit.ok) throw new Error(explicit.error.message);
  const texture = explicit.document.textures['texture-shell'];
  assert.equal(texture.width, 32);
  assert.equal(texture.height, 16);
  assert.equal(texture.atlasMode, 'preserve');
  assert.equal(texture.raster?.background, '#c06020');
  assert.deepEqual(texture.minecraft?.resource, {
    namespace: 'ashfox',
    path: 'entity/texture_contract'
  });
  const withCube = executeCommandBatch(explicit.document, {
    batchId: 'batch-create-preserve-cube',
    baseRevision: explicit.document.revision,
    operations: [{
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-shell',
          name: 'Shell',
          parentId: null,
          bounds: {
            from: [0, 0, 0],
            to: [4, 4, 4]
          },
          textureId: 'texture-shell'
        }]
      }
    }]
  });
  if (!withCube.ok) throw new Error(withCube.error.message);
  const cube = withCube.document.scene.nodes['cube-shell'];
  if (cube.kind !== 'cube') throw new Error('Preserve cube missing');
  for (const face of Object.values(cube.faces)) {
    assert.deepEqual(face.uv, [0, 0, 32, 16]);
  }

  const boxUvDocument = structuredClone(withCube.document);
  const boxUvCube = boxUvDocument.scene.nodes['cube-shell'];
  if (boxUvCube.kind !== 'cube') throw new Error('Preserve cube missing');
  boxUvCube.boxUv = true;
  boxUvCube.mirror = true;
  boxUvCube.uvOffset = [3, 4];
  boxUvCube.faces.north.rotation = 90;
  boxUvCube.faces.north.uv = [1, 2, 3, 4];
  const reassigned = executeCommandBatch(boxUvDocument, {
    batchId: 'batch-normalize-preserve-material',
    baseRevision: boxUvDocument.revision,
    operations: [
      {
        name: 'textures.create',
        payload: {
          textures: [{
            id: 'texture-finish',
            name: 'Finish',
            width: 8,
            height: 4,
            atlasMode: 'preserve'
          }]
        }
      },
      {
        name: 'scene.cubes.material',
        payload: {
          nodeIds: ['cube-shell'],
          textureId: 'texture-finish'
        }
      }
    ]
  });
  if (!reassigned.ok) throw new Error(reassigned.error.message);
  const normalized = reassigned.document.scene.nodes['cube-shell'];
  if (normalized.kind !== 'cube') throw new Error('Preserve cube missing');
  assert.equal(normalized.boxUv, false);
  assert.equal(normalized.mirror, false);
  assert.equal(normalized.uvOffset, undefined);
  for (const face of Object.values(normalized.faces)) {
    assert.deepEqual(face.uv, [0, 0, 8, 4]);
    assert.equal(face.rotation, 0);
  }
  const rejectedMirror = executeCommandBatch(reassigned.document, {
    batchId: 'batch-reject-preserve-mirror',
    baseRevision: reassigned.document.revision,
    operations: [{
      name: 'scene.cubes.mirror',
      payload: {
        nodeIds: ['cube-shell'],
        axis: 'x'
      }
    }]
  });
  assert.equal(rejectedMirror.ok, false);
  if (rejectedMirror.ok) {
    throw new Error('Preserved UV mirror must be rejected');
  }
  assert.equal(rejectedMirror.error.code, 'invalid_state');
  const invalidPreserveUv = structuredClone(reassigned.document);
  const invalidPreserveCube =
    invalidPreserveUv.scene.nodes['cube-shell'];
  if (invalidPreserveCube.kind !== 'cube') {
    throw new Error('Preserve cube missing');
  }
  invalidPreserveCube.faces.north.uv = [-1, 0, 8, 4];
  assert.ok(
    validateProjectDocument(invalidPreserveUv).findings.some(
      (finding) =>
        finding.code === 'cube.invalid_face' &&
        finding.path.endsWith('faces.north.uv')
    ),
    'preserved UVs must stay inside the texture canvas'
  );

  const withDetails = executeCommandBatch(reassigned.document, {
    batchId: 'batch-create-preserve-details',
    baseRevision: reassigned.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-shell',
        upsert: [
          {
            id: 'detail-shell-first',
            color: '#ffffff',
            anchor: {
              kind: 'canvas',
              x: 0,
              y: 0,
              width: 2,
              height: 2
            }
          },
          {
            id: 'detail-shell-second',
            color: '#101010',
            anchor: {
              kind: 'canvas',
              x: 2,
              y: 0,
              width: 2,
              height: 2
            }
          }
        ]
      }
    }]
  });
  if (!withDetails.ok) throw new Error(withDetails.error.message);
  const replaced = executeCommandBatch(withDetails.document, {
    batchId: 'batch-replace-preserve-detail',
    baseRevision: withDetails.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-shell',
        upsert: [{
          id: 'detail-shell-first',
          color: '#ff0000',
          anchor: {
            kind: 'canvas',
            x: 1,
            y: 1,
            width: 2,
            height: 2
          }
        }]
      }
    }]
  });
  if (!replaced.ok) throw new Error(replaced.error.message);
  assert.deepEqual(
    replaced.document.textures['texture-shell'].raster?.canvasDetails.map(
      (detail) => detail.id
    ),
    ['detail-shell-first', 'detail-shell-second']
  );
  const noChange = executeCommandBatch(replaced.document, {
    batchId: 'batch-no-change-preserve-detail',
    baseRevision: replaced.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-shell',
        background: '#C06020',
        upsert: [{
          id: 'detail-shell-first',
          color: '#FF0000',
          anchor: {
            kind: 'canvas',
            x: 1,
            y: 1,
            width: 2,
            height: 2
          }
        }],
        removeIds: ['detail-does-not-exist']
      }
    }]
  });
  assert.equal(noChange.ok, false);
  if (noChange.ok) throw new Error('Identical detail must be a no-op');
  assert.equal(noChange.error.code, 'no_change');

  const deleted = executeCommandBatch(replaced.document, {
    batchId: 'batch-delete-explicit-texture',
    baseRevision: replaced.document.revision,
    operations: [{
      name: 'textures.delete',
      payload: {
        textureIds: ['texture-shell']
      }
    }]
  });
  if (!deleted.ok) throw new Error(deleted.error.message);
  assert.equal(deleted.document.textures['texture-shell'], undefined);
  assert.ok(
    deleted.effects.removedEntityIds.includes('detail-shell-first')
  );
  assert.ok(
    deleted.effects.removedEntityIds.includes('detail-shell-second')
  );
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-reject-external-raster-edit',
    baseRevision: project.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-base',
        background: '#123456'
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('External raster edit must fail');
  assert.equal(result.error.code, 'invalid_state');
  assert.equal(project.textures['texture-base'].raster, undefined);
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-delete-referenced-texture',
    baseRevision: project.revision,
    operations: [{
      name: 'textures.delete',
      payload: {
        textureIds: ['texture-base']
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Referenced texture deletion must fail');
  assert.equal(result.error.code, 'invalid_state');
  assert.match(result.error.message, /cube-body/);
  assert.ok(project.textures['texture-base']);
}

{
  const empty = createProjectFromInput(
    {
      id: 'project-implicit-atlas',
      name: 'Implicit atlas',
      target: 'geckolib5',
      namespace: 'ashfox',
      modelPath: 'implicit_atlas',
      textureResolution: 32,
      createdAt: '2026-07-29T00:00:00.000Z'
    },
    'revision-implicit-atlas'
  );
  const provisioned = executeCommandBatch(empty, {
    batchId: 'batch-implicit-textured-cube',
    baseRevision: empty.revision,
    operations: [
      {
        name: 'scene.bones.create',
        payload: {
          bones: [{
            id: 'bone-root-implicit',
            name: 'root',
            parentId: null
          }]
        }
      },
      {
        name: 'scene.cubes.create',
        payload: {
          cubes: [{
            id: 'cube-implicit',
            name: 'body',
            parentId: 'bone-root-implicit',
            bounds: {
              from: [-2, 0, -2],
              to: [2, 4, 2]
            }
          }]
        }
      }
    ]
  });
  if (!provisioned.ok) throw new Error(provisioned.error.message);
  assert.deepEqual(
    Object.keys(provisioned.document.textures),
    ['texture-base']
  );
  const generated = executeCommandBatch(provisioned.document, {
    batchId: 'batch-sync-implicit-texture',
    baseRevision: provisioned.document.revision,
    operations: [{
      name: 'textures.sync',
      payload: {
        pixelsPerBlock: 16,
        padding: 1,
        maxResolution: 128,
        seed: 7,
        intensity: 0.22,
        edge: 0.12,
        noise: 0.06,
        lightDir: 'tl_br'
      }
    }]
  });
  if (!generated.ok) throw new Error(generated.error.message);
  assert.deepEqual(Object.keys(generated.document.textures), ['texture-base']);
  const cube = generated.document.scene.nodes['cube-implicit'];
  assert.equal(cube.kind, 'cube');
  if (cube.kind !== 'cube') throw new Error('Implicit atlas cube missing');
  assert.equal(cube.faces.north.textureId, 'texture-base');
  assert.ok(
    !generated.findings.some(
      (finding) => finding.code === 'format.texture_missing'
    )
  );
  const bundle = exportProject(generated.document);
  assert.ok(
    bundle.files.some(
      (file) => file.kind === 'blob-copy' && file.path.endsWith('.png')
    ),
    'production-ready GeckoLib export must include its generated texture'
  );
  assert.ok(
    bundle.files.length >= 3,
    'GeckoLib export must include geometry, animation, and texture output'
  );
}

{
  const glbProject = createProjectFromInput(
    {
      id: 'project-target-gecko',
      name: 'Target Gecko',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'target_gecko',
      textureResolution: 64,
      createdAt: '2026-07-30T00:00:00.000Z'
    },
    'revision-target-gecko'
  );
  const result = executeCommandBatch(glbProject, {
    batchId: 'batch-target-gecko',
    baseRevision: glbProject.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'geckolib5',
        namespace: ' ashfox ',
        modelPath: ' target_gecko '
      }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  assert.equal(
    result.document.animations['animation-rest-pose'].name,
    'animation.target_gecko.rest_pose'
  );
  assert.equal(
    result.document.formatProfile.id,
    'minecraft.java.geckolib5'
  );
  const glb = executeCommandBatch(result.document, {
    batchId: 'batch-target-gecko-to-glb',
    baseRevision: result.document.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'glb',
        namespace: 'ashfox',
        modelPath: 'target_gecko'
      }
    }]
  });
  if (!glb.ok) throw new Error(glb.error.message);
  assert.equal(
    glb.document.animations['animation-rest-pose'],
    undefined
  );
  assert.deepEqual(
    glb.effects.removedEntityIds,
    ['animation-rest-pose']
  );
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-forward-bone-reference',
    baseRevision: project.revision,
    operations: [{
      name: 'scene.bones.create',
      payload: {
        bones: [
          {
            id: 'bone-forward-child',
            name: 'forward_child',
            parentId: 'bone-forward-parent'
          },
          {
            id: 'bone-forward-parent',
            name: 'forward_parent',
            parentId: 'bone-root'
          }
        ]
      }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  assert.equal(
    result.document.scene.nodes['bone-forward-child'].parentId,
    'bone-forward-parent'
  );
}

{
  const geometryProject = createBedrockProject();
  const result = executeCommandBatch(geometryProject, {
    batchId: 'batch-update-existing-geometry',
    baseRevision: geometryProject.revision,
    operations: [
      {
        name: 'scene.cubes.geometry.update',
        payload: {
          updates: [{
            nodeId: 'cube-body',
            bounds: {
              from: [-5, 0, -4],
              to: [5, 9, 4]
            },
            inflate: 0.25
          }]
        }
      },
      {
        name: 'scene.nodes.rename',
        payload: {
          renames: [
            {
              nodeId: 'bone-root',
              name: 'vehicle_root'
            },
            {
              nodeId: 'cube-body',
              name: 'vehicle_body'
            }
          ]
        }
      }
    ]
  });
  if (!result.ok) throw new Error(result.error.message);
  const cube = result.document.scene.nodes['cube-body'];
  assert.equal(cube.kind, 'cube');
  if (cube.kind !== 'cube') throw new Error('Updated cube missing');
  assert.deepEqual(cube.bounds, {
    from: [-5, 0, -4],
    to: [5, 9, 4]
  });
  assert.equal(cube.inflate, 0.25);
  assert.equal(cube.mirror, false);
  assert.equal(cube.boxUv, true);
  assert.equal(cube.name, 'vehicle_body');
  assert.equal(
    result.document.scene.nodes['bone-root'].name,
    'vehicle_root'
  );
  assert.notDeepEqual(
    geometryProject.scene.nodes['cube-body'],
    result.document.scene.nodes['cube-body']
  );
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-update-missing-geometry',
    baseRevision: project.revision,
    operations: [{
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: 'cube-missing',
          inflate: 1
        }]
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Missing cube update must fail');
  assert.equal(result.error.code, 'invalid_state');
  assert.deepEqual(project, createGltfProject());
}

{
  const generatedProject = {
    ...project,
    textures: {
      ...project.textures,
      'texture-base': {
        ...project.textures['texture-base'],
        atlasMode: 'generate' as const,
        raster: {
          background: '#8e98a3',
          canvasDetails: []
        }
      }
    }
  };
  const payload = {
    pixelsPerBlock: 16,
    padding: 1,
    maxResolution: 128,
    seed: 42,
    intensity: 0.22,
    edge: 0.12,
    noise: 0.06,
    lightDir: 'tl_br' as const
  };
  const first = executeCommandBatch(generatedProject, {
    batchId: 'batch-minecraft-atlas-a',
    baseRevision: generatedProject.revision,
    operations: [{
      name: 'textures.sync',
      payload
    }]
  });
  const second = executeCommandBatch(generatedProject, {
    batchId: 'batch-minecraft-atlas-b',
    baseRevision: generatedProject.revision,
    operations: [{
      name: 'textures.sync',
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
    composeTextureRaster(
      first.document,
      first.document.textures['texture-base']
    ).regions.length,
    6
  );
  const atlasCube = first.document.scene.nodes['cube-body'];
  assert.equal(atlasCube.kind, 'cube');
  if (atlasCube.kind !== 'cube') throw new Error('Atlas cube missing');
  const northUv = atlasCube.faces.north.uv;
  assert.equal((northUv?.[2] ?? 0) - (northUv?.[0] ?? 0), 8);
  assert.equal((northUv?.[3] ?? 0) - (northUv?.[1] ?? 0), 8);
  const repeated = executeCommandBatch(first.document, {
    batchId: 'batch-minecraft-atlas-no-change',
    baseRevision: first.document.revision,
    operations: [{
      name: 'textures.sync',
      payload
    }]
  });
  assert.equal(repeated.ok, false);
  if (repeated.ok) {
    throw new Error('Repeated texture sync must not create a revision');
  }
  assert.equal(repeated.error.code, 'no_change');
  const stale = executeCommandBatch(first.document, {
    batchId: 'batch-minecraft-atlas-stale',
    baseRevision: first.document.revision,
    operations: [{
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: 'cube-body',
          inflate: 1
        }]
      }
    }]
  });
  if (!stale.ok) throw new Error(stale.error.message);
  assert.ok(
    stale.findings.some(
      (finding) => finding.code === 'texture.recipe_unsynchronized'
    )
  );
  const deflated = executeCommandBatch(first.document, {
    batchId: 'batch-minecraft-atlas-deflated',
    baseRevision: first.document.revision,
    operations: [{
      name: 'scene.cubes.geometry.update',
      payload: {
        updates: [{
          nodeId: 'cube-body',
          inflate: -1
        }]
      }
    }, {
      name: 'textures.sync',
      payload
    }]
  });
  if (!deflated.ok) throw new Error(deflated.error.message);
  const deflatedCube = deflated.document.scene.nodes['cube-body'];
  if (deflatedCube.kind !== 'cube') {
    throw new Error('Deflated atlas cube missing');
  }
  const deflatedNorthUv = deflatedCube.faces.north.uv;
  assert.equal(
    (deflatedNorthUv?.[2] ?? 0) - (deflatedNorthUv?.[0] ?? 0),
    6,
    'negative inflate must reduce texture surface density'
  );

  const mixedCube = structuredClone(first.document);
  mixedCube.textures['texture-preserve'] = {
    ...project.textures['texture-base'],
    id: 'texture-preserve',
    name: 'preserved',
    source: {
      ...project.textures['texture-base'].source,
      key: 'texture-preserve.png'
    }
  };
  const mixedNode = mixedCube.scene.nodes['cube-body'];
  if (mixedNode.kind !== 'cube') throw new Error('Mixed cube missing');
  mixedNode.boxUv = true;
  mixedNode.faces.south.textureId = 'texture-preserve';
  const mixedResult = executeCommandBatch(mixedCube, {
    batchId: 'batch-minecraft-atlas-mixed-box-uv',
    baseRevision: mixedCube.revision,
    operations: [{
      name: 'textures.sync',
      payload
    }]
  });
  assert.equal(mixedResult.ok, false);
  if (mixedResult.ok) {
    throw new Error('Mixed box UV modes must be rejected');
  }
  assert.equal(mixedResult.error.code, 'invalid_state');
}

{
  assert.ok(
    getCommandDefinition('scene.cubes.create')?.validate({
      cubes: [{
        id: 'cube-manual-uv',
        name: 'manual',
        parentId: null,
        bounds: { from: [0, 0, 0], to: [1, 1, 1] },
        faceUv: [0, 0, 1, 1]
      }]
    })
  );
  assert.ok(
    getCommandDefinition('scene.cubes.geometry.update')?.validate({
      updates: [{
        nodeId: 'cube-body',
        uvOffset: [0, 0]
      }]
    })
  );

  const generatedProject = {
    ...project,
    textures: {
      ...project.textures,
      'texture-base': {
        ...project.textures['texture-base'],
        atlasMode: 'generate' as const,
        raster: {
          background: '#8e98a3',
          canvasDetails: []
        }
      }
    }
  };
  const synchronized = executeCommandBatch(generatedProject, {
    batchId: 'batch-surface-sync',
    baseRevision: generatedProject.revision,
    operations: [{
      name: 'textures.sync',
      payload: {}
    }]
  });
  if (!synchronized.ok) throw new Error(synchronized.error.message);
  const tamperedUv = structuredClone(synchronized.document);
  const tamperedCube = tamperedUv.scene.nodes['cube-body'];
  if (tamperedCube.kind !== 'cube') throw new Error('Tamper cube missing');
  tamperedCube.faces.north.uv = [0, 0, 1, 1];
  assert.ok(
    validateProjectDocument(tamperedUv).findings.some(
      (finding) => finding.code === 'texture.recipe_unsynchronized'
    ),
    'generated UV tampering must fail production readiness'
  );
  const detailed = executeCommandBatch(synchronized.document, {
    batchId: 'batch-surface-detail',
    baseRevision: synchronized.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-base',
        upsert: [{
          id: 'detail-face-mark',
          color: '#ffffff',
          anchor: {
            kind: 'surface',
            nodeId: 'cube-body',
            face: 'north',
            u: 0.1,
            v: 0.2,
            width: 0.2,
            height: 0.3
          }
        }]
      }
    }]
  });
  if (!detailed.ok) throw new Error(detailed.error.message);
  const withOtherTexture = executeCommandBatch(detailed.document, {
    batchId: 'batch-create-other-detail-texture',
    baseRevision: detailed.document.revision,
    operations: [{
      name: 'textures.create',
      payload: {
        textures: [{
          id: 'texture-generated-other',
          name: 'Other generated texture',
          atlasMode: 'generate'
        }]
      }
    }]
  });
  if (!withOtherTexture.ok) throw new Error(withOtherTexture.error.message);
  const foreignRemoval = executeCommandBatch(withOtherTexture.document, {
    batchId: 'batch-reject-foreign-detail-removal',
    baseRevision: withOtherTexture.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-generated-other',
        removeIds: ['detail-face-mark']
      }
    }]
  });
  assert.equal(foreignRemoval.ok, false);
  if (foreignRemoval.ok) {
    throw new Error('Foreign detail removal must fail');
  }
  assert.equal(foreignRemoval.error.code, 'invalid_state');
  const retainedCube =
    withOtherTexture.document.scene.nodes['cube-body'];
  if (retainedCube.kind !== 'cube') throw new Error('Body cube missing');
  assert.equal(retainedCube.faces.north.details.length, 1);

  const identicalDetail = executeCommandBatch(detailed.document, {
    batchId: 'batch-no-change-surface-detail',
    baseRevision: detailed.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-base',
        upsert: [{
          id: 'detail-face-mark',
          color: '#FFFFFF',
          anchor: {
            kind: 'surface',
            nodeId: 'cube-body',
            face: 'north',
            u: 0.1,
            v: 0.2,
            width: 0.2,
            height: 0.3
          }
        }]
      }
    }]
  });
  assert.equal(identicalDetail.ok, false);
  if (identicalDetail.ok) {
    throw new Error('Identical surface detail must be a no-op');
  }
  assert.equal(identicalDetail.error.code, 'no_change');

  const removedDetail = executeCommandBatch(detailed.document, {
    batchId: 'batch-remove-owned-surface-detail',
    baseRevision: detailed.document.revision,
    operations: [{
      name: 'textures.details.upsert',
      payload: {
        textureId: 'texture-base',
        removeIds: ['detail-face-mark']
      }
    }]
  });
  if (!removedDetail.ok) throw new Error(removedDetail.error.message);
  assert.ok(removedDetail.effects.changedEntityIds.includes('cube-body'));
  assert.ok(
    removedDetail.effects.removedEntityIds.includes('detail-face-mark')
  );

  const duplicated = executeCommandBatch(detailed.document, {
    batchId: 'batch-surface-duplicate',
    baseRevision: detailed.document.revision,
    operations: [{
      name: 'scene.cubes.duplicate',
      payload: {
        copies: [{
          sourceId: 'cube-body',
          id: 'cube-surface-copy',
          offset: [10, 0, 0]
        }]
      }
    }]
  });
  if (!duplicated.ok) throw new Error(duplicated.error.message);
  const copied = duplicated.document.scene.nodes['cube-surface-copy'];
  if (copied.kind !== 'cube') throw new Error('Surface copy missing');
  const copiedDetail = copied.faces.north.details[0];
  assert.equal(
    copiedDetail.id,
    'detail-face-mark@cube-surface-copy:north'
  );
  assert.ok(duplicated.effects.createdEntityIds.includes(copiedDetail.id));

  const mirrored = executeCommandBatch(duplicated.document, {
    batchId: 'batch-surface-mirror',
    baseRevision: duplicated.document.revision,
    operations: [{
      name: 'scene.cubes.mirror',
      payload: {
        nodeIds: ['cube-surface-copy'],
        axis: 'x'
      }
    }]
  });
  if (!mirrored.ok) throw new Error(mirrored.error.message);
  const mirroredCube = mirrored.document.scene.nodes['cube-surface-copy'];
  if (mirroredCube.kind !== 'cube') throw new Error('Mirrored cube missing');
  assert.equal(mirroredCube.faces.north.details[0].u, 0.7);
  assert.equal(mirroredCube.faces.north.details[0].id, copiedDetail.id);

  const restored = executeCommandBatch(mirrored.document, {
    batchId: 'batch-surface-mirror-restore',
    baseRevision: mirrored.document.revision,
    operations: [{
      name: 'scene.cubes.mirror',
      payload: {
        nodeIds: ['cube-surface-copy'],
        axis: 'x'
      }
    }]
  });
  if (!restored.ok) throw new Error(restored.error.message);
  const restoredCube = restored.document.scene.nodes['cube-surface-copy'];
  if (restoredCube.kind !== 'cube') throw new Error('Restored cube missing');
  assert.deepEqual(restoredCube.faces, copied.faces);

  const withTargets = executeCommandBatch(restored.document, {
    batchId: 'batch-surface-targets',
    baseRevision: restored.document.revision,
    operations: [{
      name: 'textures.create',
      payload: {
        textures: [{
          id: 'texture-preserved',
          name: 'Preserved',
          atlasMode: 'preserve'
        }, {
          id: 'texture-generated-next',
          name: 'Generated next',
          atlasMode: 'generate'
        }]
      }
    }]
  });
  if (!withTargets.ok) throw new Error(withTargets.error.message);
  const rejectedMaterial = executeCommandBatch(withTargets.document, {
    batchId: 'batch-surface-material-reject',
    baseRevision: withTargets.document.revision,
    operations: [{
      name: 'scene.cubes.material',
      payload: {
        nodeIds: ['cube-surface-copy'],
        textureId: 'texture-preserved'
      }
    }]
  });
  assert.equal(rejectedMaterial.ok, false);
  assert.equal(
    withTargets.document.scene.nodes['cube-surface-copy'],
    restoredCube
  );

  const movedMaterial = executeCommandBatch(withTargets.document, {
    batchId: 'batch-surface-material-generated',
    baseRevision: withTargets.document.revision,
    operations: [{
      name: 'scene.cubes.material',
      payload: {
        nodeIds: ['cube-surface-copy'],
        textureId: 'texture-generated-next'
      }
    }]
  });
  if (!movedMaterial.ok) throw new Error(movedMaterial.error.message);
  const movedCube = movedMaterial.document.scene.nodes['cube-surface-copy'];
  if (movedCube.kind !== 'cube') throw new Error('Moved cube missing');
  assert.deepEqual(movedCube.faces.north.details, [copiedDetail]);

  const deleted = executeCommandBatch(movedMaterial.document, {
    batchId: 'batch-surface-delete',
    baseRevision: movedMaterial.document.revision,
    operations: [{
      name: 'scene.nodes.delete',
      payload: {
        nodeIds: ['cube-surface-copy']
      }
    }]
  });
  if (!deleted.ok) throw new Error(deleted.error.message);
  assert.ok(deleted.effects.removedEntityIds.includes(copiedDetail.id));
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
      },
      {
        name: 'project.textureResolution.set',
        payload: {
          size: 128
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
  assert.deepEqual(result.document.settings.textureResolution, {
    width: 128,
    height: 128
  });
  assert.equal(result.document.textures['texture-base'].width, 64);
  assert.equal(result.document.textures['texture-base'].height, 64);
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
    batchId: 'batch-invalid-project-resolution',
    baseRevision: project.revision,
    operations: [{
      name: 'project.textureResolution.set',
      payload: {
        size: 48
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Unsupported resolution must fail');
  assert.equal(result.error.code, 'invalid_payload');
  assert.equal(
    result.error.path,
    'operations[0].payload.size'
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
  const result = executeCommandBatch(project, {
    batchId: 'batch-create-locators',
    baseRevision: project.revision,
    operations: [{
      name: 'scene.locators.create',
      payload: {
        locators: [{
          id: 'locator-muzzle',
          name: 'muzzle',
          parentId: 'bone-root',
          transform: {
            position: [0, 6, -5],
            rotation: [0, 15, 0]
          },
          ignoreInheritedScale: true
        }]
      }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  const locator = result.document.scene.nodes['locator-muzzle'];
  assert.equal(locator.kind, 'locator');
  if (locator.kind !== 'locator') {
    throw new Error('Locator creation failed');
  }
  assert.deepEqual(locator.transform.position, [0, 6, -5]);
  assert.equal(locator.ignoreInheritedScale, true);
  assert.deepEqual(result.effects.createdEntityIds, ['locator-muzzle']);
}

{
  const result = executeCommandBatch(project, {
    batchId: 'batch-create-invalid-locator',
    baseRevision: project.revision,
    operations: [{
      name: 'scene.locators.create',
      payload: {
        locators: [{
          id: 'locator-invalid-parent',
          name: 'invalid',
          parentId: 'cube-body'
        }]
      }
    }]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('Invalid locator parent must fail');
  assert.equal(result.error.code, 'invalid_state');
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
  const rootDetail = result.document.scene.nodes['cube-root-detail'];
  if (rootDetail.kind !== 'cube') throw new Error('Root detail missing');
  assert.equal(rootDetail.faces.north.textureId, 'texture-base-2');
  assert.equal(
    result.document.textures['texture-base-2'].atlasMode,
    'generate'
  );
  assert.deepEqual(result.effects.changedEntityIds, ['cube-body']);
  assert.deepEqual(
    result.effects.createdEntityIds,
    ['texture-base-2', 'cube-detail', 'cube-root-detail']
  );
  assert.deepEqual(
    project.scene.nodes['cube-body'].transform.position,
    [0, 0, 0]
  );
  assert.equal(project.scene.nodes['cube-detail'], undefined);
}

{
  const batchProject = structuredClone(project);
  batchProject.textures['texture-base'] = {
    ...batchProject.textures['texture-base'],
    atlasMode: 'generate',
    raster: {
      background: '#8e98a3',
      canvasDetails: []
    }
  };
  const batch: CommandBatch = {
    batchId: 'batch-deterministic-tools',
    baseRevision: batchProject.revision,
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
        name: 'scene.cubes.material',
        payload: {
          nodeIds: ['cube-copy'],
          textureId: 'texture-base',
          shade: true,
          lightEmission: 0
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
        name: 'textures.create',
        payload: {
          textures: [{
            id: 'texture-editable',
            name: 'Editable texture',
            atlasMode: 'preserve'
          }]
        }
      },
      {
        name: 'textures.details.upsert',
        payload: {
          textureId: 'texture-editable',
          background: '#a4613a',
          upsert: [{
            id: 'detail-crate-mark',
            color: '#ffffff',
            anchor: {
              kind: 'canvas',
              x: 0,
              y: 0,
              width: 4,
              height: 4
            }
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
  const result = executeCommandBatch(batchProject, batch);
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ${result.error.path ?? '-'}`
    );
  }
  assert.equal(result.document.scene.nodes['cube-copy'].kind, 'cube');
  assert.ok(result.document.scene.nodes['repeat-cube-body-1']);
  assert.ok(result.document.scene.nodes['repeat-cube-body-2']);
  assert.equal(
    result.document.textures['texture-editable'].metadata?.previewColor,
    '#a4613a'
  );
  assert.equal(
    result.document.textures['texture-base'].name,
    'Crate atlas'
  );
  assert.equal(
    result.document.textures['texture-base'].atlasMode,
    'generate'
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
  const animated = createAnimatedBedrockProject();
  const result = executeCommandBatch(animated, {
    batchId: 'batch-delete-animation-tracks',
    baseRevision: animated.revision,
    operations: [{
      name: 'animation.tracks.delete',
      payload: {
        clipId: 'clip-idle',
        tracks: [
          {
            kind: 'channel',
            id: 'channel-root-rotation'
          },
          {
            kind: 'trigger',
            id: 'trigger-particle'
          }
        ]
      }
    }]
  });
  if (!result.ok) throw new Error(result.error.message);
  const clip = result.document.animations['clip-idle'];
  assert.deepEqual(clip.channels, {});
  assert.equal(clip.triggers['trigger-particle'], undefined);
  assert.ok(clip.triggers['trigger-timeline']);
  assert.deepEqual(
    result.effects.removedEntityIds,
    ['channel-root-rotation', 'trigger-particle']
  );

  const missing = executeCommandBatch(animated, {
    batchId: 'batch-delete-missing-animation-track',
    baseRevision: animated.revision,
    operations: [{
      name: 'animation.tracks.delete',
      payload: {
        clipId: 'clip-idle',
        tracks: [{
          kind: 'trigger',
          id: 'trigger-missing'
        }]
      }
    }]
  });
  assert.equal(missing.ok, false);
  if (missing.ok) throw new Error('Missing animation track must fail');
  assert.equal(missing.error.code, 'invalid_state');
  assert.ok(
    animated.animations['clip-idle'].triggers['trigger-particle']
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
