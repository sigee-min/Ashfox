import assert from 'node:assert/strict';

import {
  ASHFOX_WORKSPACE_FILE_EXTENSION,
  ASHFOX_WORKSPACE_FILE_CONTENT_TYPE,
  writeWorkspaceFile
} from '@ashfox/engine-core';
import { createWorkbenchProject } from '../fixtures/project';
import {
  createOpenIdentity,
  createWorkspaceArtifact,
  openWorkspaceSource,
  parseWorkspaceFile,
  readWorkspaceSource
} from '../../src/features/files/workspace';

export const test = (async (): Promise<void> => {
  const project = createWorkbenchProject();
  const encoded = writeWorkspaceFile(project.workspace);
  assert.equal(encoded.ok, true);
  if (!encoded.ok) throw new Error('workspace fixture must serialize');
  const identity = createOpenIdentity(project.createdAt, project.id);

  const reopened = openWorkspaceSource(encoded.source, identity, project.entry);
  assert.equal(reopened.id, project.id);
  assert.deepEqual(reopened.entry, project.entry);
  assert.equal(reopened.build.productHash, project.build.productHash);

  const bytes = new TextEncoder().encode(encoded.source);
  const decoded = readWorkspaceSource(bytes, identity, project.entry);
  assert.equal(decoded.build.workspaceHash, project.build.workspaceHash);
  assert.throws(
    () => readWorkspaceSource(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes]), identity, project.entry),
    /byte-order mark/
  );
  assert.throws(
    () => readWorkspaceSource(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), identity, project.entry),
    /ZIP/
  );

  const file = new File([bytes], `workbench${ASHFOX_WORKSPACE_FILE_EXTENSION}`, {
    type: ASHFOX_WORKSPACE_FILE_CONTENT_TYPE
  });
  const parsed = await parseWorkspaceFile(file, project.entry, identity);
  assert.equal(parsed.build.buildKey, project.build.buildKey);
  const fallback = await parseWorkspaceFile(file, {
    packageName: 'missing',
    entryName: 'missing'
  }, identity);
  assert.deepEqual(fallback.entry, project.entry,
    'opening a different workspace selects its first explicit entry');
  await assert.rejects(
    () => parseWorkspaceFile(new File([bytes], 'workbench.ashfox'), project.entry, identity),
    /\.ashfoxworkspace/
  );
  await assert.rejects(
    () => parseWorkspaceFile(file, undefined as never, identity),
    /could not be opened|invalid/
  );

  const artifact = await createWorkspaceArtifact(project);
  assert.equal(artifact.kind, 'project');
  assert.equal(artifact.name, `workbench${ASHFOX_WORKSPACE_FILE_EXTENSION}`);
  assert.equal(artifact.contentType, ASHFOX_WORKSPACE_FILE_CONTENT_TYPE);
  assert.deepEqual(artifact.bytes, bytes);
})();
