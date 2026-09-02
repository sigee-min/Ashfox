/**
 * Synchronous SHA-256 for the artifact-current predicate.
 *
 * WebCrypto is intentionally still used when creating an artifact, but the
 * current-state check runs from render/UI code and must not trust a digest
 * that is stored next to mutable bytes. Keeping this small integer-only
 * implementation here lets that predicate re-hash the exact bytes without a
 * promise or a caller-supplied observation.
 */
const ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
]);

const rightRotate = (value: number, amount: number): number =>
  (value >>> amount) | (value << (32 - amount));

const wordAt = (bytes: Uint8Array, offset: number): number =>
  (((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0);

export const sha256DigestSync = (input: Uint8Array): string => {
  const bitLength = input.byteLength * 8;
  const paddedLength = Math.ceil((input.byteLength + 9) / 64) * 64;
  const bytes = new Uint8Array(paddedLength);
  bytes.set(input);
  bytes[input.byteLength] = 0x80;
  const view = new DataView(bytes.buffer);
  view.setUint32(paddedLength - 8,
    Math.floor(bitLength / 0x100000000) >>> 0);
  view.setUint32(paddedLength - 4, bitLength >>> 0);

  let a = 0x6a09e667;
  let b = 0xbb67ae85;
  let c = 0x3c6ef372;
  let d = 0xa54ff53a;
  let e = 0x510e527f;
  let f = 0x9b05688c;
  let g = 0x1f83d9ab;
  let h = 0x5be0cd19;
  const schedule = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      schedule[index] = wordAt(bytes, offset + index * 4);
    }
    for (let index = 16; index < 64; index += 1) {
      const x = schedule[index - 15];
      const y = schedule[index - 2];
      const smallSigma0 = rightRotate(x, 7) ^ rightRotate(x, 18) ^ (x >>> 3);
      const smallSigma1 = rightRotate(y, 17) ^ rightRotate(y, 19) ^ (y >>> 10);
      schedule[index] = (schedule[index - 16] + smallSigma0 +
        schedule[index - 7] + smallSigma1) >>> 0;
    }

    let aa = a;
    let bb = b;
    let cc = c;
    let dd = d;
    let ee = e;
    let ff = f;
    let gg = g;
    let hh = h;
    for (let index = 0; index < 64; index += 1) {
      const bigSigma1 = rightRotate(ee, 6) ^ rightRotate(ee, 11) ^
        rightRotate(ee, 25);
      const choice = (ee & ff) ^ (~ee & gg);
      const first = (hh + bigSigma1 + choice + ROUND_CONSTANTS[index] +
        schedule[index]) >>> 0;
      const bigSigma0 = rightRotate(aa, 2) ^ rightRotate(aa, 13) ^
        rightRotate(aa, 22);
      const majority = (aa & bb) ^ (aa & cc) ^ (bb & cc);
      const second = (bigSigma0 + majority) >>> 0;
      hh = gg;
      gg = ff;
      ff = ee;
      ee = (dd + first) >>> 0;
      dd = cc;
      cc = bb;
      bb = aa;
      aa = (first + second) >>> 0;
    }
    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
    e = (e + ee) >>> 0;
    f = (f + ff) >>> 0;
    g = (g + gg) >>> 0;
    h = (h + hh) >>> 0;
  }

  return `sha256:${[a, b, c, d, e, f, g, h].map((word) =>
    word.toString(16).padStart(8, '0')).join('')}`;
};
