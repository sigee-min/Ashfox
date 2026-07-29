import assert from 'node:assert/strict';

import {
  createProjectArchive,
  readProjectArchive
} from '../src/features/files/projectArchive';
import {
  createStoredZip,
  readStoredZip
} from '../src/features/files/zip';
import { createWorkbenchProject } from '../src/features/workbench/sampleProject';

const document = createWorkbenchProject();
const pngHeader = [137, 80, 78, 71, 13, 10, 26, 10];
const textureIds = Object.keys(document.textures).sort(
  (left, right) => left.localeCompare(right)
);
const textureBytes: Record<string, Uint8Array> = Object.fromEntries(
  textureIds.map((textureId, index) => [
    textureId,
    new Uint8Array([...pngHeader, index + 1])
  ])
);
const firstTextureId = textureIds[0];
if (!firstTextureId) throw new Error('Fixture texture is missing.');

export const test = (async (): Promise<void> => {
  const resolveTexture = async (texture: { id: string }) => ({
    contentType: 'image/png',
    bytes: textureBytes[texture.id]
  });
  const first = await createProjectArchive(document, resolveTexture);
  const second = await createProjectArchive(document, resolveTexture);
  assert.deepEqual(first, second);

  const archiveEntries = readStoredZip(first);
  assert.deepEqual(
    archiveEntries.map((entry) => entry.path),
    [
      'manifest.json',
      'project.json',
      ...textureIds.map(
        (_, index) =>
          `assets/texture-${String(index + 1).padStart(4, '0')}.png`
      )
    ]
  );

  const project = await readProjectArchive(first);
  assert.equal(project.document.id, document.id);
  assert.match(
    project.document.textures[firstTextureId].source.contentHash,
    /^sha256:[0-9a-f]{64}$/
  );
  assert.equal(
    project.document.textures[firstTextureId].source.byteLength,
    textureBytes[firstTextureId].length
  );
  assert.deepEqual(
    project.assets[firstTextureId].bytes,
    textureBytes[firstTextureId]
  );

  const tampered = createStoredZip(
    archiveEntries.map((entry) =>
      entry.path === 'assets/texture-0001.png'
        ? {
            ...entry,
            bytes: new Uint8Array([...entry.bytes, 0])
          }
        : entry
    )
  );
  await assert.rejects(
    () => readProjectArchive(tampered),
    /integrity/
  );

  await assert.rejects(
    () =>
      createProjectArchive(document, async () => ({
        contentType: 'image/png',
        bytes: new Uint8Array([1, 2, 3])
      })),
    /do not match/
  );
})();
