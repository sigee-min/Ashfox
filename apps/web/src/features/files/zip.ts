import { deflateSync, inflateSync } from 'fflate';

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0
      ? 0xedb88320 ^ (value >>> 1)
      : value >>> 1;
  }
  return value >>> 0;
});

const crc32 = (bytes: Uint8Array): number => {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
};

export interface ZipEntry {
  path: string;
  bytes: Uint8Array;
}

interface EncodedEntry extends ZipEntry {
  name: Uint8Array;
  crc: number;
  offset: number;
  compressedBytes: Uint8Array;
  method: 0 | 8;
}

const writeUint16 = (
  target: Uint8Array,
  offset: number,
  value: number
): void => {
  new DataView(target.buffer).setUint16(offset, value, true);
};

const writeUint32 = (
  target: Uint8Array,
  offset: number,
  value: number
): void => {
  new DataView(target.buffer).setUint32(offset, value, true);
};

const readUint16 = (
  source: Uint8Array,
  offset: number
): number => {
  if (offset < 0 || offset + 2 > source.length) {
    throw new Error('ZIP structure is truncated.');
  }
  return new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  ).getUint16(offset, true);
};

const readUint32 = (
  source: Uint8Array,
  offset: number
): number => {
  if (offset < 0 || offset + 4 > source.length) {
    throw new Error('ZIP structure is truncated.');
  }
  return new DataView(
    source.buffer,
    source.byteOffset,
    source.byteLength
  ).getUint32(offset, true);
};

const localHeader = (entry: EncodedEntry): Uint8Array => {
  const header = new Uint8Array(30 + entry.name.length);
  writeUint32(header, 0, 0x04034b50);
  writeUint16(header, 4, 20);
  writeUint16(header, 6, 0x0800);
  writeUint16(header, 8, entry.method);
  writeUint32(header, 14, entry.crc);
  writeUint32(header, 18, entry.compressedBytes.length);
  writeUint32(header, 22, entry.bytes.length);
  writeUint16(header, 26, entry.name.length);
  header.set(entry.name, 30);
  return header;
};

const centralHeader = (entry: EncodedEntry): Uint8Array => {
  const header = new Uint8Array(46 + entry.name.length);
  writeUint32(header, 0, 0x02014b50);
  writeUint16(header, 4, 20);
  writeUint16(header, 6, 20);
  writeUint16(header, 8, 0x0800);
  writeUint16(header, 10, entry.method);
  writeUint32(header, 16, entry.crc);
  writeUint32(header, 20, entry.compressedBytes.length);
  writeUint32(header, 24, entry.bytes.length);
  writeUint16(header, 28, entry.name.length);
  writeUint32(header, 42, entry.offset);
  header.set(entry.name, 46);
  return header;
};

const concatBytes = (parts: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0)
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
};

export const createStoredZip = (
  entries: readonly ZipEntry[]
): Uint8Array => {
  let offset = 0;
  const encoded: EncodedEntry[] = entries.map((entry) => {
    const deflated = deflateSync(entry.bytes, { level: 9 });
    const compressedBytes = deflated.length < entry.bytes.length
      ? deflated
      : entry.bytes;
    const value: EncodedEntry = {
      ...entry,
      name: new TextEncoder().encode(entry.path),
      crc: crc32(entry.bytes),
      offset,
      compressedBytes,
      method: compressedBytes === entry.bytes ? 0 : 8
    };
    offset += 30 + value.name.length + value.compressedBytes.length;
    return value;
  });
  const localParts = encoded.flatMap((entry) => [
    localHeader(entry),
    entry.compressedBytes
  ]);
  const centralParts = encoded.map(centralHeader);
  const central = concatBytes(centralParts);
  const end = new Uint8Array(22);
  writeUint32(end, 0, 0x06054b50);
  writeUint16(end, 8, encoded.length);
  writeUint16(end, 10, encoded.length);
  writeUint32(end, 12, central.length);
  writeUint32(end, 16, offset);
  return concatBytes([...localParts, central, end]);
};

const END_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const MAX_ZIP_ENTRIES = 2048;
const MAX_ZIP_BYTES = 128 * 1024 * 1024;

const findEndRecord = (bytes: Uint8Array): number => {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (
      readUint32(bytes, offset) === END_SIGNATURE &&
      offset + 22 + readUint16(bytes, offset + 20) === bytes.length
    ) {
      return offset;
    }
  }
  throw new Error('ZIP end record is missing.');
};

const decodePath = (bytes: Uint8Array): string => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('ZIP entry path is not valid UTF-8.');
  }
};

const assertSafePath = (path: string): void => {
  const segments = path.split('/');
  if (
    path.length === 0 ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    segments.some((segment) =>
      segment.length === 0 || segment === '.' || segment === '..'
    )
  ) {
    throw new Error(`ZIP entry path "${path}" is unsafe.`);
  }
};

export const readStoredZip = (
  bytes: Uint8Array
): readonly ZipEntry[] => {
  if (bytes.length > MAX_ZIP_BYTES) {
    throw new Error('ZIP archive exceeds the 128 MB limit.');
  }
  const endOffset = findEndRecord(bytes);
  const disk = readUint16(bytes, endOffset + 4);
  const centralDisk = readUint16(bytes, endOffset + 6);
  const diskEntries = readUint16(bytes, endOffset + 8);
  const entryCount = readUint16(bytes, endOffset + 10);
  const centralSize = readUint32(bytes, endOffset + 12);
  const centralOffset = readUint32(bytes, endOffset + 16);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    diskEntries !== entryCount ||
    entryCount > MAX_ZIP_ENTRIES ||
    centralOffset + centralSize !== endOffset
  ) {
    throw new Error('ZIP central directory is invalid.');
  }

  const entries: ZipEntry[] = [];
  const paths = new Set<string>();
  let uncompressedBytes = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (readUint32(bytes, cursor) !== CENTRAL_SIGNATURE) {
      throw new Error('ZIP central entry is invalid.');
    }
    const flags = readUint16(bytes, cursor + 8);
    const method = readUint16(bytes, cursor + 10);
    const expectedCrc = readUint32(bytes, cursor + 16);
    const compressedSize = readUint32(bytes, cursor + 20);
    const size = readUint32(bytes, cursor + 24);
    const nameLength = readUint16(bytes, cursor + 28);
    const extraLength = readUint16(bytes, cursor + 30);
    const commentLength = readUint16(bytes, cursor + 32);
    const localOffset = readUint32(bytes, cursor + 42);
    const nextCursor =
      cursor + 46 + nameLength + extraLength + commentLength;
    if (
      (flags & ~0x0800) !== 0 ||
      (method !== 0 && method !== 8) ||
      (method === 0 && compressedSize !== size) ||
      size > MAX_ZIP_BYTES - uncompressedBytes ||
      nextCursor > endOffset
    ) {
      throw new Error('ZIP entry compression metadata is invalid.');
    }
    uncompressedBytes += size;
    const path = decodePath(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength)
    );
    assertSafePath(path);
    if (paths.has(path)) {
      throw new Error(`ZIP entry path "${path}" is duplicated.`);
    }
    paths.add(path);

    if (
      readUint32(bytes, localOffset) !== LOCAL_SIGNATURE ||
      readUint16(bytes, localOffset + 6) !== flags ||
      readUint16(bytes, localOffset + 8) !== method ||
      readUint32(bytes, localOffset + 14) !== expectedCrc ||
      readUint32(bytes, localOffset + 18) !== compressedSize ||
      readUint32(bytes, localOffset + 22) !== size
    ) {
      throw new Error(`ZIP local entry "${path}" is inconsistent.`);
    }
    const localNameLength = readUint16(bytes, localOffset + 26);
    const localExtraLength = readUint16(bytes, localOffset + 28);
    const localPath = decodePath(
      bytes.subarray(
        localOffset + 30,
        localOffset + 30 + localNameLength
      )
    );
    const dataStart =
      localOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (localPath !== path || dataEnd > centralOffset) {
      throw new Error(`ZIP local entry "${path}" is invalid.`);
    }
    const compressedBytes = bytes.slice(dataStart, dataEnd);
    let entryBytes: Uint8Array;
    try {
      entryBytes = method === 8
        ? inflateSync(compressedBytes, { out: new Uint8Array(size) })
        : compressedBytes;
    } catch {
      throw new Error(`ZIP entry "${path}" failed to decompress.`);
    }
    if (entryBytes.length !== size) {
      throw new Error(`ZIP entry "${path}" has an invalid size.`);
    }
    if (crc32(entryBytes) !== expectedCrc) {
      throw new Error(`ZIP entry "${path}" failed its checksum.`);
    }
    entries.push({ path, bytes: entryBytes });
    cursor = nextCursor;
  }
  if (cursor !== endOffset) {
    throw new Error('ZIP central directory length is invalid.');
  }
  return entries;
};
