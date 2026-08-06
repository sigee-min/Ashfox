import assert from 'node:assert/strict';

import { ByteAccumulator } from '../src/transport/byteAccumulator';

{
  const accumulator = new ByteAccumulator();
  accumulator.append(Buffer.from('abcdef'));
  assert.equal(accumulator.indexOf('cd'), 2);
  assert.equal(Buffer.from(accumulator.view(1, 4)).toString('utf8'), 'bcd');
  assert.equal(accumulator.take(2).toString('utf8'), 'ab');
  accumulator.append(Buffer.from('ghij'));
  assert.equal(accumulator.take(8).toString('utf8'), 'cdefghij');
  assert.equal(accumulator.length, 0);
}

{
  const accumulator = new ByteAccumulator();
  const count = 20_000;
  const width = 8;
  const payload = Buffer.alloc(count * width);
  for (let index = 0; index < count; index += 1) {
    payload.writeUInt32BE(index, index * width);
    payload.writeUInt32BE(index ^ 0x5a5a5a5a, index * width + 4);
  }
  accumulator.append(payload);
  for (let index = 0; index < count; index += 1) {
    const item = accumulator.take(width);
    assert.equal(item.readUInt32BE(0), index);
    assert.equal(item.readUInt32BE(4), (index ^ 0x5a5a5a5a) >>> 0);
  }
  assert.equal(accumulator.length, 0);
}
