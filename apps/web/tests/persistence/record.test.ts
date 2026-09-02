import assert from 'node:assert/strict';

import {
  compareProjectRevisions,
  createLocalProjectRecord,
  isLocalProjectRevision,
  isValidLocalProjectRecord,
  LOCAL_PROJECT_SCHEMA_VERSION,
  localProjectRevisionForSerial,
  parseLocalProjectRecord,
  projectRevisionSerial
} from '../../src/application/localProjectRecord';
import { decideProjectWrite } from '../../src/features/workbench/persistence/repository';
import { createWorkbenchProject } from '../fixtures/project';

assert.equal(isLocalProjectRevision('local-0012'), true);
assert.equal(isLocalProjectRevision('source-revision'), false);
assert.equal(projectRevisionSerial('local-0012'), 12);
assert.equal(localProjectRevisionForSerial(12), 'local-0012');
assert.ok(compareProjectRevisions('local-0012', 'local-0011') > 0);

const project = createWorkbenchProject();
const current = createLocalProjectRecord({
  projectId: project.id,
  revision: project.revision,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  workspace: project.workspace,
  entry: project.entry,
  savedAt: '2026-07-30T00:00:00.000Z'
});

assert.equal(isValidLocalProjectRecord(current, project.id), true);
assert.deepEqual(Object.keys(current), [
  'schemaVersion', 'projectId', 'revision', 'createdAt', 'updatedAt',
  'workspace', 'entry', 'savedAt'
]);
assert.equal(
  ['document', 'build', 'source', 'assets', 'activity', 'visualReviews']
    .some((key) => key in current),
  false
);
assert.equal(LOCAL_PROJECT_SCHEMA_VERSION, 1);
assert.deepEqual(parseLocalProjectRecord(structuredClone(current), project.id), current);

assert.equal(isValidLocalProjectRecord({ ...current, schemaVersion: 2 }, project.id), false);
assert.equal(isValidLocalProjectRecord({ ...current, source: 'legacy' }, project.id), false);
assert.equal(isValidLocalProjectRecord({ ...current, updatedAt: 'not-a-date' }, project.id), false);
assert.equal(isValidLocalProjectRecord({ ...current, entry: undefined }, project.id), false);

assert.equal(decideProjectWrite(undefined, current).status, 'stored');
assert.equal(decideProjectWrite(current, current).status, 'unchanged');
assert.equal(decideProjectWrite({ ...current, schemaVersion: 2 } as never, current).status, 'blocked');
assert.equal(decideProjectWrite(current, {
  ...current,
  workspace: structuredClone(current.workspace),
  savedAt: '2026-07-30T00:00:01.000Z'
}).status, 'conflict');
assert.equal(decideProjectWrite(current, {
  ...current,
  revision: 'local-0002',
  savedAt: '2026-07-30T00:00:01.000Z'
}).status, 'stored');
