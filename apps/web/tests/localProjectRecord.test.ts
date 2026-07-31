import assert from 'node:assert/strict';

import {
  compareProjectRevisions,
  createLocalProjectRecord,
  isValidLocalProjectRecord,
  isLocalProjectRevision,
  LOCAL_PROJECT_SCHEMA_VERSION,
  localProjectRevisionForSerial,
  projectRevisionSerial
} from '../src/application/localProjectRecord';
import { createWorkbenchProject } from '../src/features/workbench/sampleProject';

assert.equal(isLocalProjectRevision('local-0012'), true);
assert.equal(isLocalProjectRevision('source-revision'), false);
assert.equal(projectRevisionSerial('local-0012'), 12);
assert.equal(localProjectRevisionForSerial(12), 'local-0012');
assert.ok(compareProjectRevisions('local-0012', 'local-0011') > 0);
assert.ok(compareProjectRevisions('local-0001', 'source-revision') > 0);
assert.ok(compareProjectRevisions('source-revision', 'local-0001') < 0);

const document = createWorkbenchProject();
const current = createLocalProjectRecord({
  document,
  assets: {},
  activity: [],
  savedAt: '2026-07-30T00:00:00.000Z'
});
assert.equal(
  isValidLocalProjectRecord(current, document.id),
  true
);
assert.equal(
  isValidLocalProjectRecord(
    {
      ...current,
      schemaVersion: (LOCAL_PROJECT_SCHEMA_VERSION - 1) as
        typeof LOCAL_PROJECT_SCHEMA_VERSION
    },
    document.id
  ),
  false,
  'incompatible local records must never enter the active session'
);
