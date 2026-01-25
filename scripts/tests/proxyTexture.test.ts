import assert from 'node:assert/strict';

import { MAX_TEXTURE_OPS } from '../../src/domain/textureOps';
import { renderTextureSpec, resolveTextureBase } from '../../src/proxy/texture';

const limits = { maxCubes: 2048, maxTextureSize: 256, maxAnimationSeconds: 120 };

type MockContextOptions = {
  pattern?: unknown | null;
};

const createMockContext = (options: MockContextOptions = {}) => {
  return {
    imageSmoothingEnabled: false,
    fillStyle: undefined as unknown,
    strokeStyle: undefined as unknown,
    lineWidth: 1,
    fillRect: () => undefined,
    strokeRect: () => undefined,
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
    drawImage: () => undefined,
    save: () => undefined,
    restore: () => undefined,
    rect: () => undefined,
    clip: () => undefined,
    translate: () => undefined,
    createPattern: () => (options.pattern === undefined ? ({}) : options.pattern),
    getImageData: (_x: number, _y: number, w: number, h: number) => {
      const data = new Uint8ClampedArray(Math.max(0, w * h * 4));
      if (data.length >= 4) data[3] = 255;
      return { data };
    }
  };
};

const createMockCanvas = (ctx: unknown) => {
  return {
    width: 0,
    height: 0,
    getContext: (type: string) => (type === '2d' ? ctx : null)
  };
};

const createDom = (ctxOptions: MockContextOptions = {}) => {
  return {
    createCanvas: () => createMockCanvas(createMockContext(ctxOptions)),
    createImage: () => null
  };
};

// Invalid dimensions -> invalid_payload
{
  const dom = createDom();
  const res = renderTextureSpec(dom as never, { name: 't', width: 0, height: 16, ops: [] }, limits);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

// Too many ops -> invalid_payload
{
  const dom = createDom();
  const ops = new Array(MAX_TEXTURE_OPS + 1).fill({ op: 'set_pixel', x: 0, y: 0, color: '#000' });
  const res = renderTextureSpec(dom as never, { name: 't', width: 16, height: 16, ops }, limits);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

// Unsupported op -> invalid_payload
{
  const dom = createDom();
  const res = renderTextureSpec(
    dom as never,
    { name: 't', width: 16, height: 16, ops: [{ op: 'nope' } as never] },
    limits
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

// Success path: apply supported ops
{
  const dom = createDom();
  const res = renderTextureSpec(
    dom as never,
    {
      name: 't',
      width: 16,
      height: 16,
      background: '#ffffff',
      ops: [
        { op: 'set_pixel', x: 1, y: 1, color: '#ff00ff' },
        { op: 'fill_rect', x: 0, y: 0, width: 2, height: 2, color: '#000000' },
        { op: 'draw_rect', x: 0, y: 0, width: 3, height: 3, color: '#000000', lineWidth: 2 },
        { op: 'draw_line', x1: 0, y1: 0, x2: 4, y2: 4, color: '#000000' }
      ]
    },
    limits,
    { image: {} as never, width: 16, height: 16 }
  );

  assert.equal(res.ok, true);
  if (res.ok) {
    assert.equal(res.data.width, 16);
    assert.equal(res.data.height, 16);
    assert.ok(res.data.coverage);
    assert.equal(typeof res.data.coverage?.opaqueRatio, 'number');
  }
}

// uvPaint requires rects
{
  const dom = createDom();
  const res = renderTextureSpec(
    dom as never,
    { name: 't', width: 16, height: 16, ops: [] },
    limits,
    undefined,
    { rects: [], mapping: 'stretch', padding: 0, anchor: [0, 0], source: { width: 16, height: 16 } }
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'invalid_payload');
  }
}

// uvPaint tile mapping: pattern unavailable
{
  const dom = createDom({ pattern: null });
  const res = renderTextureSpec(
    dom as never,
    { name: 't', width: 16, height: 16, ops: [] },
    limits,
    undefined,
    {
      rects: [{ x1: 0, y1: 0, x2: 8, y2: 8 }],
      mapping: 'tile',
      padding: 0,
      anchor: [0, 0],
      source: { width: 8, height: 8 }
    }
  );
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'not_implemented');
  }
}

// uvPaint tile mapping: success + paintCoverage
{
  const dom = createDom({ pattern: {} });
  const res = renderTextureSpec(
    dom as never,
    { name: 't', width: 16, height: 16, background: '#ffffff', ops: [] },
    limits,
    undefined,
    {
      rects: [{ x1: 0, y1: 0, x2: 8, y2: 8 }],
      mapping: 'tile',
      padding: 0,
      anchor: [0, 0],
      source: { width: 8, height: 8 }
    }
  );
  assert.equal(res.ok, true);
  if (res.ok) {
    assert.ok(res.data.paintCoverage);
    assert.equal(typeof res.data.paintCoverage?.opaquePixels, 'number');
  }
}

// Async tests: register promises with runner.
const registerAsync = (p: Promise<unknown>) => {
  const g = globalThis as { __bbmcp_test_promises?: Promise<unknown>[] };
  if (!Array.isArray(g.__bbmcp_test_promises)) g.__bbmcp_test_promises = [];
  g.__bbmcp_test_promises.push(p);
};

registerAsync(
  (async () => {
    const dom = createDom();
    const res = await resolveTextureBase(dom as never, { name: 't' });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'not_implemented');
    }
  })()
);

registerAsync(
  (async () => {
    const dom = createDom();
    const res = await resolveTextureBase(dom as never, {
      name: 't',
      image: { width: 8, height: 8 } as never,
      width: 8,
      height: 8
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.data.width, 8);
      assert.equal(res.data.height, 8);
    }
  })()
);

registerAsync(
  (async () => {
    const dom = createDom();
    const res = await resolveTextureBase(dom as never, { name: 't', image: { width: 0, height: 0 } as never });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.error.code, 'invalid_payload');
    }
  })()
);
