import assert from 'node:assert/strict';

import { compileProjectBundle } from '@ashfox/engine-core';
import {
  createArtifactBinding,
  createSealedTargetArtifact,
  exportPresetForBundle,
  isArtifactCurrent,
  prepareTargetArtifactDocument,
  type ArtifactFile
} from '../../src/features/files/artifactFile';
import { createWorkbenchProject } from '../fixtures/project';

const project = createWorkbenchProject();
const bytes = new Uint8Array([0, 1, 2, 3, 4]);

export const test = (async (): Promise<void> => {
  const binding = await createArtifactBinding(project, bytes, 'capture');
  const capture: ArtifactFile = {
    ...binding,
    kind: 'build',
    name: 'build-replay.gif',
    contentType: 'image/gif',
    bytes
  };
  assert.equal(isArtifactCurrent(project, capture), true);
  assert.equal(isArtifactCurrent(project, {
    ...capture,
    bytes: new Uint8Array([0, 1, 2, 3, 5])
  }), false, 'artifact bytes cannot diverge from their immutable build lineage');
  assert.equal(isArtifactCurrent(project, {
    ...capture,
    lineage: undefined
  }), false, 'unsealed legacy metadata is never current');
  assert.equal(isArtifactCurrent({
    ...project,
    document: { ...project.document, name: 'forged-document' }
  }, capture), false, 'build artifacts reject a forged canonical document');
  assert.equal(isArtifactCurrent({
    ...project,
    entry: { ...project.entry, entryName: 'swapped-entry' }
  }, capture), false, 'build artifacts reject a swapped selected entry');
  const swappedWorkspace = structuredClone(project.workspace);
  const swappedFile = swappedWorkspace.files[0];
  if (!swappedFile) throw new Error('artifact fixture workspace is empty');
  Object.defineProperty(swappedFile, 'source', {
    configurable: true,
    value: `${swappedFile.source}\n`
  });
  assert.equal(isArtifactCurrent({
    ...project,
    workspace: swappedWorkspace
  }, capture), false, 'build artifacts reject a swapped workspace authority');

  const bundle = compileProjectBundle(project, {
    target: 'glb',
    modelPath: 'artifact_lineage'
  });
  assert.equal(exportPresetForBundle(bundle), 'glb');
  const entries = bundle.files.map((file) => ({
    path: file.path,
    bytes: file.kind === 'json'
      ? new TextEncoder().encode(file.text)
      : file.kind === 'binary'
        ? file.data
        : (() => { throw new Error('The GLB fixture must not copy blobs.'); })()
  }));
  const targetArtifact = createSealedTargetArtifact(project, bundle,
    prepareTargetArtifactDocument(project.document), entries);
  const targetBytes = targetArtifact.bytes;
  assert.equal(isArtifactCurrent(project, targetArtifact), true);
  assert.equal(Object.isFrozen(targetArtifact.lineage), true);
  assert.equal(Object.isFrozen(targetArtifact.adaptations), true);
  assert.throws(() => createSealedTargetArtifact(project, bundle, {
    ...project.document,
    name: 'forged-delivery-document'
  }, entries), /sealed export bundle/,
  'target sealing recomputes the delivery document instead of trusting ambient state');
  assert.equal(isArtifactCurrent({
    ...project,
    revision: 'local-forged-revision'
  }, targetArtifact), false, 'host revision is part of artifact authority');
  assert.equal(isArtifactCurrent({
    ...project,
    build: { ...project.build, productHash: 'sha256:forged' }
  }, targetArtifact), false, 'product lineage cannot be self-attested');

  const swapped = new Uint8Array(targetBytes);
  swapped[0] = swapped[0] === 0 ? 1 : 0;
  assert.equal(isArtifactCurrent(project, {
    ...targetArtifact,
    bytes: swapped
  }), false, 'sealed target bytes are immutable');

  console.log('artifact lineage tests ok');
})();
