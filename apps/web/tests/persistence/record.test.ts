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
import {
  decideProjectWrite
} from '../../src/features/workbench/persistence/repository';
import {
  createWorkbenchProject
} from '../fixtures/project';

assert.equal(isLocalProjectRevision('local-0012'), true);
assert.equal(isLocalProjectRevision('source-revision'), false);
assert.equal(projectRevisionSerial('local-0012'), 12);
assert.equal(localProjectRevisionForSerial(12), 'local-0012');
assert.ok(compareProjectRevisions('local-0012', 'local-0011') > 0);
assert.ok(compareProjectRevisions('local-0001', 'source-revision') > 0);
assert.ok(compareProjectRevisions('source-revision', 'local-0001') < 0);
assert.equal(LOCAL_PROJECT_SCHEMA_VERSION, 1);

const document = createWorkbenchProject();
const source = document.intentProgram?.source;
assert.ok(source);
const current = createLocalProjectRecord({
  projectId: document.id,
  revision: document.revision,
  createdAt: document.createdAt,
  source,
  savedAt: '2026-07-30T00:00:00.000Z'
});

assert.equal(isValidLocalProjectRecord(current, document.id), true);
assert.deepEqual(Object.keys(current), [
  'schemaVersion',
  'projectId',
  'revision',
  'createdAt',
  'source',
  'savedAt'
]);
assert.equal(
  'document' in current ||
  'assets' in current ||
  'activity' in current ||
  'visualReviews' in current,
  false,
  'durable state contains source authority only'
);

assert.equal(
  isValidLocalProjectRecord({
    ...current,
    schemaVersion: 2
  }, document.id),
  false,
  'a non-v1 local source contract is rejected'
);
assert.equal(
  isValidLocalProjectRecord({
    schemaVersion: 1,
    projectId: document.id,
    revision: document.revision,
    document,
    assets: {},
    activity: [],
    visualReviews: [],
    savedAt: current.savedAt
  }, document.id),
  false,
  'a compiled-document shape is rejected by the current source-only contract'
);
assert.equal(
  isValidLocalProjectRecord({ ...current, document }, document.id),
  false,
  'the source-only v1 record is closed'
);
assert.equal(
  isValidLocalProjectRecord({ ...current, source: '' }, document.id),
  false
);
assert.equal(
  isValidLocalProjectRecord({
    ...current,
    createdAt: 'not-an-iso-date'
  }, document.id),
  false
);
assert.deepEqual(
  parseLocalProjectRecord(structuredClone(current), document.id),
  current
);

assert.equal(decideProjectWrite(undefined, current).status, 'stored');
assert.equal(decideProjectWrite(current, current).status, 'unchanged');
assert.equal(decideProjectWrite({
  ...current,
  schemaVersion: 2
} as unknown as typeof current, current).status, 'blocked');
assert.equal(decideProjectWrite(current, {
  ...current,
  source: `${source}\n`
}).status, 'conflict');
assert.equal(decideProjectWrite(current, {
  ...current,
  revision: 'local-0002',
  savedAt: '2026-07-30T00:00:01.000Z'
}).status, 'stored');
