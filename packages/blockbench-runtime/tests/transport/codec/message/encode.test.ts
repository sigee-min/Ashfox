import assert from 'node:assert/strict';

import { encodeMessage } from '../../../../src/transport/codec';

{
  const encoded = encodeMessage({ type: 'ready', version: 1, ts: 1 });
  assert.equal(encoded.endsWith('\n'), true);
  assert.equal(encoded.includes('"type":"ready"'), true);
}
