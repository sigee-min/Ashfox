import assert from 'node:assert/strict';

import {
  createStoredZip,
  readStoredZip
} from '../../src/features/files/zip';

const entries = [
  {
    path: 'project.json',
    bytes: new TextEncoder().encode('{"ok":true}')
  },
  {
    path: 'assets/texture.png',
    bytes: new Uint8Array([137, 80, 78, 71])
  }
];
const archive = createStoredZip(entries);
assert.deepEqual(readStoredZip(archive), entries);
assert.deepEqual(createStoredZip(entries), archive);

const compressible = new TextEncoder().encode('ashfox '.repeat(2_000));
const compressedArchive = createStoredZip([{
  path: 'model.json',
  bytes: compressible
}]);
assert.equal(new DataView(
  compressedArchive.buffer,
  compressedArchive.byteOffset,
  compressedArchive.byteLength
).getUint16(8, true), 8);
assert.ok(compressedArchive.length < compressible.length);
assert.deepEqual(readStoredZip(compressedArchive), [{
  path: 'model.json',
  bytes: compressible
}]);

const corrupted = new Uint8Array(archive);
corrupted[30 + new TextEncoder().encode(entries[0].path).length] ^= 0xff;
assert.throws(
  () => readStoredZip(corrupted),
  /checksum|inconsistent/
);

assert.throws(
  () =>
    readStoredZip(
      createStoredZip([
        {
          path: '../project.json',
          bytes: new Uint8Array([1])
        }
      ])
    ),
  /unsafe/
);

assert.throws(
  () =>
    readStoredZip(
      createStoredZip([
        { path: 'same', bytes: new Uint8Array([1]) },
        { path: 'same', bytes: new Uint8Array([2]) }
      ])
    ),
  /duplicated/
);
