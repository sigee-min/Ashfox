import assert from 'node:assert/strict';

import {
  executeSystemCommandBatch,
  type ExportPreset,
  type MinecraftGameVersion,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  artifactContentHash,
  isArtifactCurrent
} from '../src/features/files/artifactFile';
import {
  projectExportTargetFor
} from '../src/application/projectExportTarget';
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
  const result = executeSystemCommandBatch(project, {
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
          symmetry: { kind: 'bilateral', planeTwice: 0 },
          features: [
            'Fixture geometry remains visible in the exported target.'
          ]
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
          id: 'idle',
          name: 'animation.export_fixture.idle',
          durationSeconds: 1,
          fps: 20,
          loop: 'loop'
        }
      },
      {
        name: 'animation.channels.upsert',
        payload: {
          clipId: 'idle',
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
          contentHash: await artifactContentHash(texturePng),
          byteLength: texturePng.byteLength
        }
      }
    }
  };
};

const projectFor = (
  source: ProjectDocument,
  target: ExportPreset,
  gameVersion?: MinecraftGameVersion
): ProjectDocument => {
  const result = executeSystemCommandBatch(source, {
    batchId: `batch-web-export-${target}-${gameVersion ?? 'default'}`,
    baseProjectId: source.id,
    baseRevision: source.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target,
        ...(gameVersion === undefined ? {} : { gameVersion })
      }
    }, {
      name: 'project.resource.set',
      payload: {
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

const staticJavaProjectFor = (
  source: ProjectDocument,
  gameVersion: '1.21.5' | '1.21.11' | '26.1' | '26.2'
): ProjectDocument => {
  const result = executeSystemCommandBatch(source, {
    batchId: `batch-web-export-java-${gameVersion}`,
    baseProjectId: source.id,
    baseRevision: source.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'java_block',
        gameVersion
      }
    }, {
      name: 'project.resource.set',
      payload: {
        namespace: 'ashfox',
        modelPath: 'artifact_java_block'
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

const decodeJsonEntry = (
  entries: ReadonlyMap<string, Uint8Array>,
  path: string
): Record<string, unknown> => {
  const bytes = entries.get(path);
  if (!bytes) throw new Error(`ZIP entry ${path} is missing.`);
  return JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
};

export const test = (async () => {
  const blank = createBlankWorkbenchProject(
    '2026-07-30T00:00:00.000Z'
  );
  const authored = executeSystemCommandBatch(blank, {
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
  assert.equal(
    projectArtifact.target,
    projectExportTargetFor(source).target
  );
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
    gameVersion: '26.1' | '1.26.30' | null;
    sourceFileCount: number;
    paths: readonly RegExp[];
  }> = [
    {
      target: 'geckolib5',
      gameVersion: '26.1',
      sourceFileCount: 3,
      paths: [/\.geo\.json$/, /\.animation\.json$/, /\.png$/]
    },
    {
      target: 'bedrock',
      gameVersion: '1.26.30',
      sourceFileCount: 3,
      paths: [/\.geo\.json$/, /\.animation\.json$/, /\.png$/]
    },
    {
      target: 'gltf',
      gameVersion: null,
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
    assert.equal(artifact.gameVersion, expectation.gameVersion);
    if (expectation.gameVersion !== null) {
      assert.ok(
        artifact.name.includes(expectation.gameVersion),
        'Minecraft artifact names must identify their game version'
      );
    }
    assert.equal(artifact.sourceRevision, targetSource.revision);
    assert.equal(
      artifact.adaptationCount,
      artifact.adaptations.converted.length +
        artifact.adaptations.omitted.length
    );
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

  const geckoPrevious = await createTargetArtifact(
    projectFor(source, 'geckolib5', '1.21.5'),
    assets
  );
  const geckoCurrent = await createTargetArtifact(
    projectFor(source, 'geckolib5', '26.1'),
    assets
  );
  assert.notEqual(geckoPrevious.name, geckoCurrent.name);
  assert.equal(geckoPrevious.gameVersion, '1.21.5');
  assert.equal(geckoCurrent.gameVersion, '26.1');

  for (const expectation of [
    {
      gameVersion: '1.21.5' as const,
      pack: {
        pack_format: 55,
        supported_formats: 55
      }
    },
    {
      gameVersion: '1.21.11' as const,
      pack: {
        min_format: [75, 0],
        max_format: [75, 0]
      }
    },
    {
      gameVersion: '26.1' as const,
      pack: {
        min_format: [84, 0],
        max_format: [84, 0]
      }
    },
    {
      gameVersion: '26.2' as const,
      pack: {
        min_format: [88, 0],
        max_format: [88, 0]
      }
    }
  ]) {
    const javaSource = staticJavaProjectFor(
      source,
      expectation.gameVersion
    );
    const artifact = await createTargetArtifact(javaSource, assets);
    assert.equal(artifact.contentType, 'application/zip');
    assert.equal(artifact.target, 'java_block');
    assert.equal(artifact.gameVersion, expectation.gameVersion);
    assert.equal(artifact.sourceFileCount, 4);
    assert.ok(artifact.name.includes(expectation.gameVersion));
    assert.ok(
      Object.keys(javaSource.animations).length > 0,
      'switching to a static delivery profile must preserve source clips'
    );
    assert.ok(
      artifact.adaptations.omitted.some(
        (adaptation) => adaptation.path.startsWith('animations.')
      ),
      'the artifact receipt must disclose clips omitted by a static target'
    );
    assert.equal(
      artifact.adaptationCount,
      artifact.adaptations.converted.length +
        artifact.adaptations.omitted.length
    );

    const zipEntries = readStoredZip(artifact.bytes);
    assert.deepEqual(
      zipEntries.map((entry) => entry.path),
      [
        'pack.mcmeta',
        'assets/ashfox/blockstates/artifact_java_block.json',
        'assets/ashfox/models/block/artifact_java_block.json',
        'assets/ashfox/textures/block/artifact_java_block.png'
      ]
    );
    const entries = new Map(
      zipEntries.map((entry) => [entry.path, entry.bytes])
    );
    const metadata = decodeJsonEntry(entries, 'pack.mcmeta');
    assert.deepEqual(metadata.pack, {
      ...expectation.pack,
      description: `${javaSource.name} · generated by ashfox`
    });
    const blockstate = decodeJsonEntry(
      entries,
      'assets/ashfox/blockstates/artifact_java_block.json'
    );
    assert.deepEqual(blockstate, {
      variants: {
        '': { model: 'ashfox:block/artifact_java_block' }
      }
    });
    const model = decodeJsonEntry(
      entries,
      'assets/ashfox/models/block/artifact_java_block.json'
    );
    assert.equal('format_version' in model, false);
    assert.deepEqual(model.textures, {
      base: 'ashfox:block/artifact_java_block',
      particle: '#base'
    });
    assert.deepEqual(
      entries.get(
        'assets/ashfox/textures/block/artifact_java_block.png'
      ),
      texturePng
    );
  }

  const glb = await createTargetArtifact(glbSource, assets);
  assert.equal(glb.contentType, 'model/gltf-binary');
  assert.equal(glb.sourceFileCount, 1);
  assert.equal(glb.gameVersion, null);
  assert.equal(
    glb.adaptationCount,
    glb.adaptations.converted.length + glb.adaptations.omitted.length
  );
  assert.ok(glb.name.endsWith('.glb'));
  assert.equal(glb.projectId, glbSource.id);
  assert.equal(glb.sourceRevision, glbSource.revision);
  assert.equal(
    glb.target,
    projectExportTargetFor(glbSource).target
  );
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
