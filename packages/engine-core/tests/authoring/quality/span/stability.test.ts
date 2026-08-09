import assert from 'node:assert/strict';

import { evaluateSpanQuality } from '../../../../src/authoring/quality/span';
import { spanFixture } from './fixture';

assert.equal(Object.isFrozen(spanFixture.document), true);
assert.equal(Object.isFrozen(spanFixture.profile), true);
const snapshot = JSON.stringify(spanFixture);
const first = evaluateSpanQuality(spanFixture.document, spanFixture.profile);
const second = evaluateSpanQuality(spanFixture.document, spanFixture.profile);

assert.deepEqual(second, first, 'span quality evaluation is deterministic');
assert.equal(
  JSON.stringify(spanFixture),
  snapshot,
  'span quality evaluation does not mutate its deeply frozen inputs'
);
