import assert from 'node:assert/strict';

import { applyTextureOps, parseHexColor } from '../src/domain/texturePaint';
import { isTextureOp } from '../src/domain/textureOps';

const width = 8;
const height = 8;

const collectColors = (data: Uint8ClampedArray): Set<string> => {
  const colors = new Set<string>();
  for (let i = 0; i < data.length; i += 4) {
    colors.add(`${data[i]},${data[i + 1]},${data[i + 2]},${data[i + 3]}`);
  }
  return colors;
};

{
  assert.equal(parseHexColor('#ff00aa')?.a, 255);
  assert.equal(parseHexColor('#ff00aa80')?.a, 128);
  assert.equal(parseHexColor('#ff00zz'), null);
  assert.equal(parseHexColor('#12'), null);
  assert.equal(parseHexColor('##112233'), null);
  assert.equal(parseHexColor('112233'), null);
  assert.equal(isTextureOp({
    op: 'set_pixel',
    x: 0,
    y: 0,
    color: '#fff'
  }), false);
  assert.equal(isTextureOp({
    op: 'set_pixel',
    x: 0,
    y: 0,
    color: '#11223344'
  }), true);
}

{
  const unsafeLine = {
    op: 'draw_line',
    x1: -1e12,
    y1: 0,
    x2: 1e12,
    y2: 0,
    lineWidth: 1,
    color: '#ffffff'
  };
  const unsafeBrush = {
    ...unsafeLine,
    x1: 0,
    x2: 1,
    lineWidth: 1e12
  };
  assert.equal(isTextureOp(unsafeLine), false);
  assert.equal(isTextureOp(unsafeBrush), false);
  const data = new Uint8ClampedArray(16 * 16 * 4);
  const lineResult = applyTextureOps(
    data,
    16,
    16,
    [unsafeLine],
    parseHexColor
  );
  assert.equal(lineResult.ok, false);
  if (!lineResult.ok) assert.equal(lineResult.reason, 'invalid_op');

  const clippedLine = {
    op: 'draw_line',
    x1: -65_536,
    y1: 0,
    x2: 65_536,
    y2: 0,
    lineWidth: 1,
    color: '#ffffff'
  } as const;
  assert.equal(isTextureOp(clippedLine), true);
  assert.equal(
    applyTextureOps(data, 16, 16, [clippedLine], parseHexColor).ok,
    true
  );
  assert.equal(data[3], 255);
}

{
  const data = new Uint8ClampedArray(16 * 16 * 4);
  const fullCanvasOp = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width: 16,
    height: 16,
    color: '#112233'
  } as const;
  const result = applyTextureOps(
    data,
    16,
    16,
    Array.from({ length: 1025 }, () => fullCanvasOp),
    parseHexColor
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, 'raster_work_exceeded');
    assert.equal(result.opIndex, 1024);
  }
}

{
  const op = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width,
    height,
    color: '#7f9a56'
  } as const;
  assert.equal(isTextureOp(op), true);

  const first = new Uint8ClampedArray(width * height * 4);
  const second = new Uint8ClampedArray(width * height * 4);

  const firstRes = applyTextureOps(first, width, height, [op], parseHexColor);
  const secondRes = applyTextureOps(second, width, height, [op], parseHexColor);
  assert.equal(firstRes.ok, true);
  assert.equal(secondRes.ok, true);
  assert.deepEqual(first, second);

  const colors = collectColors(first);
  assert.ok(colors.size > 1, 'default fill should produce tonal variation');
}

{
  const op = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width,
    height,
    color: '#7f9a56',
    shade: false
  } as const;
  assert.equal(isTextureOp(op), true);

  const data = new Uint8ClampedArray(width * height * 4);
  const res = applyTextureOps(data, width, height, [op], parseHexColor);
  assert.equal(res.ok, true);

  const colors = collectColors(data);
  assert.equal(colors.size, 1, 'disabled shade should keep a flat fill');
  assert.equal(colors.has('127,154,86,255'), true);
}

{
  const validShade = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width: 4,
    height: 4,
    color: '#7f9a56',
    shade: { intensity: 0.4, edge: 0.2, noise: 0.1, seed: 12, lightDir: 'tr_bl' as const }
  } as const;
  assert.equal(isTextureOp(validShade), true);

  const invalidShadeType = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width: 4,
    height: 4,
    color: '#7f9a56',
    shade: { intensity: '0.3' }
  };
  assert.equal(isTextureOp(invalidShadeType), false);

  const invalidShadeDir = {
    op: 'fill_rect',
    x: 0,
    y: 0,
    width: 4,
    height: 4,
    color: '#7f9a56',
    shade: { lightDir: 'diagonal' }
  };
  assert.equal(isTextureOp(invalidShadeDir), false);
}

{
  const data = new Uint8ClampedArray(width * height * 4);
  const res = applyTextureOps(
    data,
    width,
    height,
    [{ op: 'unknown', color: '#ffffff' } as unknown as { op: 'fill_rect'; color: string }],
    parseHexColor
  );
  assert.equal(res.ok, false);
  if (!res.ok) assert.equal(res.reason, 'invalid_op');
}
