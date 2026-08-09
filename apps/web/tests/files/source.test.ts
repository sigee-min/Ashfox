import assert from 'node:assert/strict';

import {
  ASHFOX_PROJECT_FILE_CONTENT_TYPE,
  INTENT_PROGRAM_SOURCE_MAX_LENGTH
} from '@ashfox/engine-core';

import {
  createOpenIdentity,
  createProjectArtifact,
  openProjectSource,
  parseProjectFile,
  readProjectSource
} from '../../src/features/files/source';
import {
  createWorkbenchProject
} from '../fixtures/project';

const fixture = createWorkbenchProject();
const source = fixture.intentProgram?.source;
assert.ok(source);
const identity = createOpenIdentity(
  '2026-08-10T00:00:00.000Z',
  'project-source-open-test'
);
assert.deepEqual(identity, {
  id: 'project-source-open-test',
  revision: 'local-0001',
  createdAt: '2026-08-10T00:00:00.000Z'
});

const opened = readProjectSource(new TextEncoder().encode(source), identity);
assert.equal(opened.id, identity.id);
assert.equal(opened.name, fixture.name);
assert.equal(opened.intentProgram?.source, source);
assert.equal(opened.intentProgramProposal, undefined);

const invalidSource = [
  'metadata {',
  '  name "Broken source"',
  '  track impossible',
  '  domain machine',
  '}',
  'model {',
  '  orientation forward diagonal',
  '  symmetry radial',
  '  support none',
  '  body {',
  '    core body',
  '  }',
  '  face {',
  '    none',
  '  }',
  '}',
  'animation {',
  '  idle dance',
  '}',
  'appearance {',
  '  palette ultraviolet',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n');
let current = opened;
assert.throws(
  () => {
    current = openProjectSource(invalidSource, identity);
  },
  (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /1:\d+ \[intent\./);
    assert.ok(
      error.message.split('\n').length >= 6,
      'all independent diagnostics are returned together'
    );
    return true;
  }
);
assert.equal(
  current,
  opened,
  'a failed compile cannot replace the current canonical document'
);

assert.throws(
  () => readProjectSource(
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    identity
  ),
  /ZIP-based \.ashfox files are not supported/
);
assert.throws(
  () => readProjectSource(new Uint8Array([0xc3, 0x28]), identity),
  /not valid UTF-8/
);
assert.throws(
  () => readProjectSource(
    new Uint8Array([0xef, 0xbb, 0xbf, 0x61]),
    identity
  ),
  /without a byte-order mark/
);
assert.throws(
  () => readProjectSource(
    new Uint8Array(INTENT_PROGRAM_SOURCE_MAX_LENGTH * 4 + 4),
    identity
  ),
  /exceeds the 20000-character limit/
);

export const test = (async (): Promise<void> => {
  const artifact = await createProjectArtifact(fixture);
  assert.equal(artifact.kind, 'project');
  assert.equal(artifact.contentType, ASHFOX_PROJECT_FILE_CONTENT_TYPE);
  assert.equal(artifact.name, 'Workbench-unit-fixture.ashfox');
  assert.equal(new TextDecoder().decode(artifact.bytes), source);
  assert.deepEqual(artifact.bytes, new TextEncoder().encode(source));

  await assert.rejects(
    () => parseProjectFile({
      name: 'compiled-project.zip',
      arrayBuffer: async () => new ArrayBuffer(0)
    } as File),
    /must use the \.ashfox extension/
  );

  await assert.rejects(
    () => createProjectArtifact({
      ...fixture,
      intentProgramProposal: fixture.intentProgram
    }),
    /pending Intent Program/
  );
})();
