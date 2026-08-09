import assert from 'node:assert/strict';

import {
  evaluateFixture,
  supportFixtures
} from './fixture';

const expectedSupportCount = {
  base: 1,
  foot: 2,
  wheel: 2
} as const;

for (const kind of ['base', 'foot', 'wheel'] as const) {
  const evaluation = evaluateFixture(supportFixtures[kind]);
  const applicable = evaluation.statuses.filter(
    (status) => status.supportKind !== 'none'
  );
  assert.equal(evaluation.ready, true, `${kind} support is ready`);
  assert.deepEqual(evaluation.issues, [], `${kind} has no issues`);
  assert.deepEqual(evaluation.violations, [], `${kind} has no violations`);
  assert.equal(applicable.length, expectedSupportCount[kind]);
  assert.ok(applicable.every((status) =>
    status.supportKind === kind &&
    status.state === 'complete' &&
    status.groundContactCellCount > 0 &&
    status.issueCodes.length === 0
  ));
  assert.ok(evaluation.statuses.every((status) =>
    status.supportKind !== 'none' || status.state === 'not-applicable'
  ));
}
