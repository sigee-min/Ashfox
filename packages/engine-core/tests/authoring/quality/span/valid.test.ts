import assert from 'node:assert/strict';

import { evaluateSpanQuality } from '../../../../src/authoring/quality/span';
import { spanFixture } from './fixture';

const membranePartIds = spanFixture.slot.span.membranes.flatMap(
  (membrane) => membrane.partIds
);
assert.ok(
  membranePartIds.length > 2,
  'forked shaped surface must retain all convex membrane regions'
);

const evaluation = evaluateSpanQuality(
  spanFixture.document,
  spanFixture.profile
);
const status = evaluation.statuses.find(
  (entry) => entry.slotId === spanFixture.slot.slotId
);
assert.equal(evaluation.ready, true);
assert.deepEqual(evaluation.issues, []);
assert.deepEqual(evaluation.violations, []);
assert.equal(status?.spanKind, 'supported-surface');
assert.equal(status?.state, 'complete');
assert.deepEqual(status?.issueCodes, []);
assert.ok(membranePartIds.every((partId) =>
  status?.referencedPartIds.includes(partId)
));
