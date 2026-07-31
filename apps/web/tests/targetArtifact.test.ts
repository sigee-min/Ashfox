import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  type ExportPreset,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  artifactContentHash,
  artifactTargetFor,
  isArtifactCurrent
} from '../src/features/files/artifactFile';
import {
  createProjectArtifact,
  createTargetArtifact
} from '../src/features/files/browserFileWorkflow';
import { readStoredZip } from '../src/features/files/zip';
import {
  createBlankWorkbenchProject
} from '../src/features/workbench/newProject';

const texturePng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
);

const authorProject = async (): Promise<ProjectDocument> => {
  const project = createBlankWorkbenchProject(
    '2026-07-30T00:00:00.000Z'
  );
  const result = executeCommandBatch(project, {
    batchId: 'batch-web-export-fixture',
    baseProjectId: project.id,
    baseRevision: project.revision,
    operations: [
      {
        name: 'project.intent.set',
        payload: {
          subject: 'Export fixture',
          forward: 'north',
          grounding: 'free',
          requiredFeatures: [
            'Fixture geometry remains visible in the exported target.'
          ],
          requiredPartIds: [],
          requiredMaterialIds: [],
          requiredClipIds: ['animation-export-idle']
        }
      },
      {
        name: 'scene.bones.create',
        payload: {
          bones: [{
            id: 'bone-root',
            name: 'root',
            parentId: null
          }]
        }
      },
      {
        name: 'scene.cubes.create',
        payload: {
          cubes: [{
            id: 'cube-body',
            name: 'body',
            parentId: 'bone-root',
            bounds: {
              from: [-2, 0, -2],
              to: [2, 4, 2]
            }
          }]
        }
      },
      {
        name: 'animation.clip.upsert',
        payload: {
          id: 'animation-export-idle',
          name: 'animation.export_fixture.idle',
          durationSeconds: 1,
          fps: 20,
          loop: 'loop'
        }
      },
      {
        name: 'animation.channels.upsert',
        payload: {
          clipId: 'animation-export-idle',
          channels: [{
            id: 'channel-export-idle',
            targetNodeId: 'bone-root',
            property: 'rotation',
            keys: [{
              id: 'key-export-start',
              timeSeconds: 0,
              value: [0, 0, 0]
            }, {
              id: 'key-export-end',
              timeSeconds: 1,
              value: [0, 0, 0]
            }]
          }]
        }
      }
    ]
  }, { source: 'system' });
  if (!result.ok) {
    throw new Error(
      `${result.error.message} ${JSON.stringify(result.findings ?? [])}`
    );
  }
  const texture = result.document.textures['texture-base'];
  const { raster: _raster, ...importedTexture } = texture;
  return {
    ...result.document,
    textures: {
      ...result.document.textures,
      'texture-base': {
        ...importedTexture,
        atlasMode: 'preserve',
        source: {
          ...importedTexture.source,
          contentHash: await artifactContentHash(texturePng),
          byteLength: texturePng.byteLength
        }
      }
    }
  };
};

const projectFor = (
  source: ProjectDocument,
  target: ExportPreset
): ProjectDocument => {
  const result = executeCommandBatch(source, {
    batchId: `batch-web-export-${target}`,
    baseProjectId: source.id,
    baseRevision: source.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target,
        namespace: 'ashfox',
        modelPath: `artifact_${target}`
      }
    }]
  }, { source: 'system' });
  if (!result.ok) {
    throw new Error(
      `${result.error.message} ${JSON.stringify(result.findings ?? [])}`
    );
  }
  return result.document;
};

export const test = (async () => {
  const blank = createBlankWorkbenchProject(
    '2026-07-30T00:00:00.000Z'
  );
  const authored = executeCommandBatch(blank, {
    batchId: 'batch-web-stale-fixture',
    baseProjectId: blank.id,
    baseRevision: blank.revision,
    operations: [{
      name: 'scene.bones.create',
      payload: {
        bones: [{
          id: 'bone-stale',
          name: 'root',
          parentId: null
        }]
      }
    }, {
      name: 'scene.cubes.create',
      payload: {
        cubes: [{
          id: 'cube-stale',
          name: 'body',
          parentId: 'bone-stale',
          bounds: {
            from: [0, 0, 0],
            to: [4, 4, 4]
          }
        }]
      }
    }]
  }, { source: 'system' });
  if (!authored.ok) throw new Error(authored.error.message);
  const stale = structuredClone(authored.document);
  const staleCube = stale.scene.nodes['cube-stale'];
  if (staleCube.kind !== 'cube') {
    throw new Error('Stale texture fixture cube is unavailable.');
  }
  staleCube.bounds.to[0] += 1;
  await assert.rejects(
    () => createProjectArtifact(stale, {}),
    /derivations are not current/
  );
  await assert.rejects(
    () => createTargetArtifact(stale, {}),
    /derivations are not current/
  );
  await assert.rejects(
    () => createTargetArtifact(blank, {}),
    /not production ready/
  );

  const source = await authorProject();
  const assets = {
    'texture-base': {
      contentType: 'image/png',
      bytes: texturePng
    }
  };
  await assert.rejects(
    () => createProjectArtifact(source, {}),
    /missing its imported bytes/
  );
  const projectArtifact = await createProjectArtifact(source, assets);
  assert.equal(projectArtifact.projectId, source.id);
  assert.equal(projectArtifact.sourceRevision, source.revision);
  assert.equal(projectArtifact.target, artifactTargetFor(source));
  assert.equal(
    projectArtifact.contentHash,
    await artifactContentHash(projectArtifact.bytes)
  );
  const glbSource = projectFor(source, 'glb');
  await assert.rejects(
    () => createTargetArtifact(glbSource, {}),
    /missing its imported bytes/
  );
  await assert.rejects(
    () => createTargetArtifact(glbSource, {
      'texture-base': {
        contentType: 'image/jpeg',
        bytes: texturePng
      }
    }),
    /MIME type does not match/
  );
  const corruptedTexturePng = new Uint8Array(texturePng);
  corruptedTexturePng[corruptedTexturePng.length - 1] ^= 0xff;
  await assert.rejects(
    () => createTargetArtifact(glbSource, {
      'texture-base': {
        contentType: 'image/png',
        bytes: corruptedTexturePng
      }
    }),
    /content hash does not match/
  );
  const expectations: ReadonlyArray<{
    target: ExportPreset;
    sourceFileCount: number;
    paths: readonly RegExp[];
  }> = [
    {
      target: 'geckolib5',
      sourceFileCount: 3,
      paths: [/\.geo\.json$/, /\.animation\.json$/, /\.png$/]
    },
    {
      target: 'bedrock',
      sourceFileCount: 3,
      paths: [/\.geo\.json$/, /\.animation\.json$/, /\.png$/]
    },
    {
      target: 'gltf',
      sourceFileCount: 3,
      paths: [/\.gltf$/, /\.bin$/, /\.png$/]
    }
  ];
  for (const expectation of expectations) {
    const targetSource = projectFor(source, expectation.target);
    const artifact = await createTargetArtifact(
      targetSource,
      assets
    );
    assert.equal(artifact.contentType, 'application/zip');
    assert.equal(artifact.target, expectation.target);
    assert.equal(artifact.sourceRevision, targetSource.revision);
    assert.equal(
      artifact.sourceFileCount,
      expectation.sourceFileCount
    );
    const paths = readStoredZip(artifact.bytes).map(
      (entry) => entry.path
    );
    for (const pattern of expectation.paths) {
      assert.ok(
        paths.some((path) => pattern.test(path)),
        `${expectation.target} artifact must include ${pattern}`
      );
    }
  }

  const glb = await createTargetArtifact(glbSource, assets);
  assert.equal(glb.contentType, 'model/gltf-binary');
  assert.equal(glb.sourceFileCount, 1);
  assert.ok(glb.name.endsWith('.glb'));
  assert.equal(glb.projectId, glbSource.id);
  assert.equal(glb.sourceRevision, glbSource.revision);
  assert.equal(glb.target, artifactTargetFor(glbSource));
  assert.equal(glb.contentHash, await artifactContentHash(glb.bytes));
  assert.equal(isArtifactCurrent(glbSource, glb), true);
  assert.equal(
    isArtifactCurrent({
      ...glbSource,
      revision: 'local-0002'
    }, glb),
    false,
    'a document mutation must invalidate the prior artifact'
  );
  assert.equal(
    isArtifactCurrent(projectFor(source, 'gltf'), glb),
    false,
    'the GLB artifact must not be reused for a glTF target'
  );
  assert.equal(
    new DataView(
      glb.bytes.buffer,
      glb.bytes.byteOffset,
      glb.bytes.byteLength
    ).getUint32(0, true),
    0x46546c67
  );
})();
