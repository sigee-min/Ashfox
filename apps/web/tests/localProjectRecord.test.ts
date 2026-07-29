import assert from 'node:assert/strict';

import {
  compareProjectRevisions,
  isLocalProjectRevision,
  localProjectRevisionForSerial,
  projectRevisionSerial
} from '../src/features/workbench/persistence/localProjectRecord';

assert.equal(isLocalProjectRevision('local-0012'), true);
assert.equal(isLocalProjectRevision('source-revision'), false);
assert.equal(projectRevisionSerial('local-0012'), 12);
assert.equal(localProjectRevisionForSerial(12), 'local-0012');
assert.ok(compareProjectRevisions('local-0012', 'local-0011') > 0);
assert.ok(compareProjectRevisions('local-0001', 'source-revision') > 0);
assert.ok(compareProjectRevisions('source-revision', 'local-0001') < 0);
