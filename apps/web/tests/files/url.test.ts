import assert from 'node:assert/strict';

import type { ArtifactFile } from '../../src/features/files/artifactFile';
import {
  createArtifactUrl
} from '../../src/features/files/browserArtifactUrl';

const file: ArtifactFile = {
  kind: 'project',
  name: 'moonveil-kirin.ashfox',
  contentType: 'text/x-ashfox;charset=utf-8',
  bytes: new Uint8Array([1, 2, 3, 4]),
  projectId: 'project-moonveil-kirin',
  sourceRevision: 'local-0001',
  target: 'glb',
  contentHash: 'sha256:test-artifact'
};
const blobs: Blob[] = [];
const revoked: string[] = [];
const handle = createArtifactUrl(file, {
  createObjectURL: (blob) => {
    blobs.push(blob);
    return 'blob:ashfox-artifact';
  },
  revokeObjectURL: (url) => {
    revoked.push(url);
  }
});

assert.equal(handle.url, 'blob:ashfox-artifact');
assert.equal(blobs.length, 1);
assert.equal(blobs[0].type, file.contentType);
file.bytes.fill(9);

export const test = (async (): Promise<void> => {
  assert.deepEqual(
    new Uint8Array(await blobs[0].arrayBuffer()),
    new Uint8Array([1, 2, 3, 4]),
    'the handoff Blob must own stable bytes for its full URL lifetime'
  );
  assert.deepEqual(revoked, []);
  handle.release();
  assert.deepEqual(revoked, ['blob:ashfox-artifact']);
})();
