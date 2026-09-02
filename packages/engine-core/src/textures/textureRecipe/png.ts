import { sha256ByteDigest } from '../../provenance/digest';
import {
  assertCanonicalTextureRaster,
  type CanonicalTextureRaster
} from './raster';

const writeU32 = (target: number[], value: number): void => {
  target.push((value >>> 24) & 0xff, (value >>> 16) & 0xff,
    (value >>> 8) & 0xff, value & 0xff);
};

const crc32 = (bytes: ArrayLike<number>): number => {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index]!;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 0 ? crc >>> 1 :
        (crc >>> 1) ^ 0xedb88320;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const adler32 = (bytes: ArrayLike<number>): number => {
  let first = 1;
  let second = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    first = (first + bytes[index]!) % 65521;
    second = (second + first) % 65521;
  }
  return ((second << 16) | first) >>> 0;
};

const chunk = (type: string, data: ArrayLike<number>): number[] => {
  const body: number[] = [];
  for (const character of type) body.push(character.charCodeAt(0));
  for (let index = 0; index < data.length; index += 1) body.push(data[index]!);
  const result: number[] = [];
  writeU32(result, data.length);
  for (const byte of body) result.push(byte);
  writeU32(result, crc32(body));
  return result;
};

/** Emits a deterministic RGBA8 PNG using filter 0 and stored DEFLATE blocks.
 * No renderer or platform PNG encoder is involved, so the same canonical
 * raster produces byte-identical Minecraft/GLTF/OBJ texture payloads. */
export const encodeCanonicalPng = (
  raster: CanonicalTextureRaster
): Uint8Array => {
  assertCanonicalTextureRaster(raster);
  const scanlines: number[] = [];
  for (let y = 0; y < raster.height; y += 1) {
    scanlines.push(0);
    const start = y * raster.width * 4;
    for (let index = 0; index < raster.width * 4; index += 1) {
      scanlines.push(raster.rgba.at(start + index)!);
    }
  }
  const compressed: number[] = [0x78, 0x01];
  let offset = 0;
  while (offset < scanlines.length) {
    const length = Math.min(65535, scanlines.length - offset);
    const final = offset + length === scanlines.length;
    compressed.push(final ? 1 : 0, length & 0xff, length >>> 8,
      (~length) & 0xff, (~length >>> 8) & 0xff);
    for (let index = offset; index < offset + length; index += 1) {
      compressed.push(scanlines[index]!);
    }
    offset += length;
  }
  writeU32(compressed, adler32(scanlines));
  const header: number[] = [];
  writeU32(header, raster.width);
  writeU32(header, raster.height);
  header.push(8, 6, 0, 0, 0);
  const bytes: number[] = [137, 80, 78, 71, 13, 10, 26, 10];
  for (const part of [chunk('IHDR', header), chunk('IDAT', compressed),
    chunk('IEND', [])]) for (const byte of part) bytes.push(byte);
  return Uint8Array.from(bytes);
};

export const canonicalRgbaDigest = (
  raster: CanonicalTextureRaster
): string => {
  assertCanonicalTextureRaster(raster);
  return sha256ByteDigest(raster.rgba.copy());
};

export const canonicalPngDigest = (
  png: ArrayLike<number>
): string => sha256ByteDigest(png);
