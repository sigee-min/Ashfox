import assert from 'node:assert/strict';

import {
  decideProjectWrite
} from '../src/features/workbench/persistence/indexedDbProjectRepository';
import {
  createLocalProjectRecord,
  LOCAL_PROJECT_SCHEMA_VERSION
} from '../src/features/workbench/persistence/localProjectRecord';
import { createWorkbenchProject } from '../src/features/workbench/sampleProject';

const document = createWorkbenchProject();
const candidate = createLocalProjectRecord({
  document,
  assets: {},
  activity: [],
  savedAt: '2026-07-30T00:00:00.000Z'
});

assert.equal(
  decideProjectWrite(undefined, candidate).status,
  'stored'
);
assert.equal(
  decideProjectWrite(candidate, candidate).status,
  'unchanged'
);
const legacyDocument = structuredClone(document) as
  typeof document & {
    settings: typeof document.settings & {
      uvPixelsPerUnit?: number;
    };
  };
delete (
  legacyDocument.settings as Partial<typeof document.settings>
).surfacePixelDensity;
legacyDocument.settings.uvPixelsPerUnit = 1;
const legacyRecord = {
  ...candidate,
  document: legacyDocument
};
const normalizedLegacy = decideProjectWrite(
  legacyRecord,
  candidate
);
assert.equal(normalizedLegacy.status, 'unchanged');
assert.equal(
  normalizedLegacy.current.document.settings.surfacePixelDensity,
  1
);
assert.equal(
  'uvPixelsPerUnit' in normalizedLegacy.current.document.settings,
  false
);
assert.equal(
  decideProjectWrite(
    {
      ...candidate,
      schemaVersion: (LOCAL_PROJECT_SCHEMA_VERSION - 1) as
        typeof LOCAL_PROJECT_SCHEMA_VERSION
    },
    candidate
  ).status,
  'blocked',
  'an incompatible stored project must never be overwritten implicitly'
);
