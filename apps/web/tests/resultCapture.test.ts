import assert from 'node:assert/strict';

import {
  artifactContentHash
} from '../src/features/files/artifactFile';
import {
  canvasToPngBytes
} from '../src/features/capture/captureSurface';
import {
  RESULT_CAPTURE_HEIGHT,
  RESULT_CAPTURE_WIDTH
} from '../src/features/capture/createResultPng';
import {
  createResultCaptureFile,
  isResultCaptureFile
} from '../src/features/capture/resultCaptureFile';
import {
  createWorkbenchProject
} from '../src/features/workbench/sampleProject';

const pngBytes = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47,
  0x0d, 0x0a, 0x1a, 0x0a
]);

export const test = (async (): Promise<void> => {
  let requestedType: string | undefined;
  const canvas = {
    toBlob: (
      callback: BlobCallback,
      type?: string
    ): void => {
      requestedType = type;
      callback(new Blob([pngBytes], { type: 'image/png' }));
    }
  } as HTMLCanvasElement;

  assert.deepEqual(await canvasToPngBytes(canvas), pngBytes);
  assert.equal(requestedType, 'image/png');
  await assert.rejects(
    canvasToPngBytes({
      toBlob: (callback: BlobCallback): void => callback(null)
    } as HTMLCanvasElement),
    /could not be encoded/
  );

  const document = createWorkbenchProject();
  const file = await createResultCaptureFile(document, {
    bytes: pngBytes,
    width: RESULT_CAPTURE_WIDTH,
    height: RESULT_CAPTURE_HEIGHT
  });
  assert.equal(file.kind, 'result');
  assert.equal(file.contentType, 'image/png');
  assert.equal(file.width, 1280);
  assert.equal(file.height, 720);
  assert.equal(file.projectId, document.id);
  assert.equal(file.sourceRevision, document.revision);
  assert.equal(file.contentHash, await artifactContentHash(pngBytes));
  assert.match(file.name, /-result\.png$/);
  assert.equal(isResultCaptureFile(file), true);
  assert.equal(isResultCaptureFile(null), false);
})();
