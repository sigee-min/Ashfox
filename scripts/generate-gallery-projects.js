const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { register } = require('ts-node');

register({
  transpileOnly: true,
  compilerOptions: {
    module: 'CommonJS',
    moduleResolution: 'Node'
  }
});

const {
  composeTextureRaster
} = require('@ashfox/engine-core');
const {
  createProjectArchive,
  readProjectArchive
} = require('../apps/web/src/features/files/projectArchive');
const {
  createDemoHistory
} = require('../apps/web/src/features/workbench/demo/demoFactory');
const {
  DEMO_DEFINITIONS
} = require('../apps/web/src/features/workbench/demo/demoRegistry');
const {
  generatedSurfacePixel
} = require('../apps/web/src/rendering/renderTextureRaster');

const repositoryRoot = path.resolve(__dirname, '..');
const galleryRoot = path.join(repositoryRoot, 'examples', 'gallery');

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) === 1
      ? 0xedb88320 ^ (crc >>> 1)
      : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const pngChunk = (type, data) => {
  const typeBytes = Buffer.from(type, 'ascii');
  const output = Buffer.allocUnsafe(data.length + 12);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(
    crc32(Buffer.concat([typeBytes, data])),
    data.length + 8
  );
  return output;
};

const encodePng = (width, height, rgba) => {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowOffset = y * (width * 4 + 1);
    scanlines[rowOffset] = 0;
    Buffer.from(
      rgba.buffer,
      rgba.byteOffset + y * width * 4,
      width * 4
    ).copy(scanlines, rowOffset + 1);
  }
  return new Uint8Array(Buffer.concat([
    Buffer.from('89504e470d0a1a0a', 'hex'),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ]));
};

const rgb = (value) => {
  if (typeof value !== 'string') return { r: 142, g: 152, b: 163 };
  const normalized = value.trim();
  const match = /^#([0-9a-f]{6})$/i.exec(normalized);
  if (!match) throw new Error(`Unsupported gallery texture color: ${value}`);
  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16)
  };
};

const setPixel = (bytes, width, height, x, y, color) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  bytes[offset] = color.r;
  bytes[offset + 1] = color.g;
  bytes[offset + 2] = color.b;
  bytes[offset + 3] = 255;
};

const fillRect = (bytes, width, height, x, y, rectWidth, rectHeight, color) => {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let column = x; column < x + rectWidth; column += 1) {
      setPixel(bytes, width, height, column, row, color);
    }
  }
};

const renderTexturePng = (document, texture) => {
  const composition = composeTextureRaster(document, texture);
  const bytes = new Uint8Array(texture.width * texture.height * 4);
  const background = rgb(
    composition.background ?? texture.metadata?.previewColor ?? '#8e98a3'
  );
  fillRect(
    bytes,
    texture.width,
    texture.height,
    0,
    0,
    texture.width,
    texture.height,
    background
  );
  if (composition.generated) {
    for (const region of composition.regions) {
      for (
        let y = -composition.gutter;
        y < region.height + composition.gutter;
        y += 1
      ) {
        for (
          let x = -composition.gutter;
          x < region.width + composition.gutter;
          x += 1
        ) {
          const sourceX = Math.min(region.width - 1, Math.max(0, x));
          const sourceY = Math.min(region.height - 1, Math.max(0, y));
          setPixel(
            bytes,
            texture.width,
            texture.height,
            region.x + x,
            region.y + y,
            generatedSurfacePixel(region, sourceX, sourceY)
          );
        }
      }
    }
  }
  for (const detail of composition.canvasDetails) {
    fillRect(
      bytes,
      texture.width,
      texture.height,
      detail.x,
      detail.y,
      detail.width,
      detail.height,
      rgb(detail.color)
    );
  }
  return encodePng(texture.width, texture.height, bytes);
};

const generate = async () => {
  for (const definition of DEMO_DEFINITIONS) {
    const document = createDemoHistory(definition).present;
    const bytes = await createProjectArchive(document, async (texture) => ({
      contentType: 'image/png',
      bytes: renderTexturePng(document, texture)
    }));
    await readProjectArchive(bytes);
    const output = path.join(
      galleryRoot,
      definition.slug,
      'project.ashfox'
    );
    fs.writeFileSync(output, bytes);
    console.log(
      `Wrote ${path.relative(repositoryRoot, output)} (${bytes.length} bytes)`
    );
  }
};

generate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
