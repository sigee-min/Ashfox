const GIF_TRAILER = 0x3b;
const EXTENSION = 0x21;
const APPLICATION_EXTENSION = 0xff;
const GRAPHIC_CONTROL_EXTENSION = 0xf9;
const IMAGE_DESCRIPTOR = 0x2c;
const NETSCAPE_APPLICATION_ID = 'NETSCAPE2.0';

const readAscii = (bytes, offset, length) =>
  String.fromCharCode(...bytes.subarray(offset, offset + length));

const readSubBlocks = (bytes, offset) => {
  let cursor = offset;
  while (cursor < bytes.length) {
    const length = bytes[cursor];
    cursor += 1;
    if (length === 0) return cursor;
    cursor += length;
  }
  throw new Error('GIF sub-block is truncated.');
};

const initialBlockOffset = (bytes) => {
  if (readAscii(bytes, 0, 6) !== 'GIF89a') {
    throw new Error('Expected a GIF89a asset.');
  }
  const packed = bytes[10];
  const globalColorTableLength = packed & 0x80
    ? 3 * 2 ** ((packed & 0x07) + 1)
    : 0;
  return 13 + globalColorTableLength;
};

export const inspectGifPlayback = (bytes) => {
  const delays = [];
  const loopExtensions = [];
  let cursor = initialBlockOffset(bytes);

  while (cursor < bytes.length) {
    const blockStart = cursor;
    const marker = bytes[cursor];
    cursor += 1;

    if (marker === GIF_TRAILER) break;

    if (marker === IMAGE_DESCRIPTOR) {
      const packed = bytes[cursor + 8];
      cursor += 9;
      if (packed & 0x80) {
        cursor += 3 * 2 ** ((packed & 0x07) + 1);
      }
      cursor += 1;
      cursor = readSubBlocks(bytes, cursor);
      continue;
    }

    if (marker !== EXTENSION) {
      throw new Error(`Unsupported GIF block marker: 0x${marker.toString(16)}`);
    }

    const label = bytes[cursor];
    cursor += 1;
    if (label === GRAPHIC_CONTROL_EXTENSION) {
      const length = bytes[cursor];
      if (length !== 4) {
        throw new Error('GIF graphic control extension is invalid.');
      }
      delays.push((bytes[cursor + 2] | (bytes[cursor + 3] << 8)) * 10);
      cursor += length + 2;
      continue;
    }

    if (label === APPLICATION_EXTENSION) {
      const applicationIdLength = bytes[cursor];
      const applicationId = readAscii(
        bytes,
        cursor + 1,
        applicationIdLength
      );
      cursor += applicationIdLength + 1;
      const dataStart = cursor;
      cursor = readSubBlocks(bytes, cursor);
      if (
        applicationId === NETSCAPE_APPLICATION_ID &&
        bytes[dataStart] === 3 &&
        bytes[dataStart + 1] === 1
      ) {
        loopExtensions.push({
          start: blockStart,
          end: cursor,
          repeat: bytes[dataStart + 2] | (bytes[dataStart + 3] << 8)
        });
      }
      continue;
    }

    cursor = readSubBlocks(bytes, cursor);
  }

  return {
    durationMs: delays.reduce((total, delay) => total + delay, 0),
    frameCount: delays.length,
    repeat: loopExtensions.at(0)?.repeat ?? null,
    loopExtensions
  };
};

export const createSinglePlayGif = (bytes) => {
  const { loopExtensions } = inspectGifPlayback(bytes);
  if (loopExtensions.length === 0) return bytes;
  if (loopExtensions.length > 1) {
    throw new Error('GIF contains more than one loop extension.');
  }
  const [{ start, end }] = loopExtensions;
  const output = new Uint8Array(bytes.length - (end - start));
  output.set(bytes.subarray(0, start));
  output.set(bytes.subarray(end), start);
  return output;
};
