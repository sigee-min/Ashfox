import assert from 'node:assert/strict';

import { isSidecarMessage } from '../../../../src/transport/protocol';

{
  assert.equal(isSidecarMessage(null), false);
  assert.equal(isSidecarMessage({ type: 'hello', version: 1, role: 'plugin', ts: 1 }), true);
  assert.equal(isSidecarMessage({ type: 'hello', version: 2, role: 'plugin', ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'hello', version: 1, role: 'invalid', ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'ready', version: 2, ts: 1 }), false);
  assert.equal(isSidecarMessage({ type: 'ready', version: Number.NaN, ts: 1 }), false);
}
