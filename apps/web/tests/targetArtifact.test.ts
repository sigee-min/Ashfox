import assert from 'node:assert/strict';

import {
  executeCommandBatch,
  type ExportPreset,
  type ProjectDocument
} from '@ashfox/engine-core';

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

const authorProject = (): ProjectDocument => {
  const project = createBlankWorkbenchProject(
    '2026-07-30T00:00:00.000Z'
  );
  const result = executeCommandBatch(project, {
    batchId: 'batch-web-export-fixture',
    baseRevision: project.revision,
    operations: [
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
      }
    ]
  });
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
    baseRevision: source.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target,
        namespace: 'ashfox',
        modelPath: `artifact_${target}`
      }
    }]
  });
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
  });
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

  const source = authorProject();
  const assets = {
    'texture-base': {
      contentType: 'image/png',
      bytes: texturePng
    }
  };
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
      sourceFileCount: 2,
      paths: [/\.geo\.json$/, /\.png$/]
    },
    {
      target: 'gltf',
      sourceFileCount: 3,
      paths: [/\.gltf$/, /\.bin$/, /\.png$/]
    }
  ];
  for (const expectation of expectations) {
    const artifact = await createTargetArtifact(
      projectFor(source, expectation.target),
      assets
    );
    assert.equal(artifact.contentType, 'application/zip');
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

  const glb = await createTargetArtifact(
    projectFor(source, 'glb'),
    assets
  );
  assert.equal(glb.contentType, 'model/gltf-binary');
  assert.equal(glb.sourceFileCount, 1);
  assert.ok(glb.name.endsWith('.glb'));
  assert.equal(
    new DataView(
      glb.bytes.buffer,
      glb.bytes.byteOffset,
      glb.bytes.byteLength
    ).getUint32(0, true),
    0x46546c67
  );
})();
