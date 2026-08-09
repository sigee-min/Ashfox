import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  presentCreationStatus
} from '../../src/features/workbench/presentation/status';
import {
  presentExportAvailability
} from '../../src/features/workbench/exportAvailability';
import {
  requiredVisualReviews
} from '../../src/features/agent/visualReviewPlan';
import {
  createWorkbenchProject
} from '../fixtures/project';
import {
  createVisualReviewReceiptFixture
} from '../fixtures/review';

const empty = createProjectFromInput({
  id: 'project-creation-status-empty',
  name: 'Empty creation status',
  createdAt: '2026-08-09T00:00:00.000Z'
}, 'local-0001');
const emptyReport = validateProjectDocument(empty);
assert.equal(
  presentCreationStatus(empty, emptyReport, [], 'saved').state,
  'awaiting-prompt'
);
assert.equal(
  presentCreationStatus(empty, emptyReport, [], 'saved').label,
  'Ready for your prompt'
);
assert.equal(
  presentExportAvailability(empty, emptyReport, []).allowed,
  false
);

const compiled = createWorkbenchProject();
const compiledReport = validateProjectDocument(compiled);
const reviewing = presentCreationStatus(
  compiled,
  compiledReport,
  [],
  'saving'
);
assert.equal(reviewing.state, 'reviewing');
assert.match(reviewing.detail, /visual checks remaining/);

const reviews = requiredVisualReviews(compiled).map((review, index) =>
  createVisualReviewReceiptFixture(compiled, {
    mode: review.mode,
    camera: review.camera,
    clipId: review.clipId,
    frameNonce: index + 1
  })
);
const ready = presentCreationStatus(
  compiled,
  compiledReport,
  reviews,
  'saved'
);
assert.equal(ready.state, 'ready');
assert.deepEqual(
  presentExportAvailability(compiled, compiledReport, reviews),
  {
    allowed: true,
    message: 'Canonical asset and visual review are ready for delivery.'
  }
);

if (!compiled.intentProgram) {
  throw new Error('Compiled fixture requires an authoritative Intent Program.');
}
const pending = {
  ...compiled,
  intentProgramProposal: compiled.intentProgram
};
const pendingReport = validateProjectDocument(pending);
const working = presentCreationStatus(
  pending,
  pendingReport,
  reviews,
  'saved',
  'available'
);
assert.deepEqual(
  { state: working.state, label: working.label },
  { state: 'working', label: 'AI is preparing an update' }
);
assert.match(working.detail, /temporary preview/);
assert.equal(
  presentCreationStatus(
    pending,
    pendingReport,
    reviews,
    'saved',
    'failed'
  ).state,
  'attention'
);
assert.match(
  presentExportAvailability(pending, pendingReport, reviews).message,
  /AI is compiling or revising/
);
