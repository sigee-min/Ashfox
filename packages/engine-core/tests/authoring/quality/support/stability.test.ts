import assert from 'node:assert/strict';

import { evaluateSupportQuality } from '../../../../src/authoring/quality/support';
import { supportFixtures } from './fixture';

for (const kind of ['base', 'foot', 'wheel'] as const) {
  const fixture = supportFixtures[kind];
  const documentBefore = JSON.stringify(fixture.document);
  const profileBefore = JSON.stringify(fixture.profile);
  const first = evaluateSupportQuality(fixture.document, fixture.profile);
  const second = evaluateSupportQuality(fixture.document, fixture.profile);

  assert.deepEqual(second, first, `${kind} evaluation is deterministic`);
  assert.equal(
    JSON.stringify(fixture.document),
    documentBefore,
    `${kind} evaluation does not mutate the project document`
  );
  assert.equal(
    JSON.stringify(fixture.profile),
    profileBefore,
    `${kind} evaluation does not mutate the authoring profile`
  );
}
