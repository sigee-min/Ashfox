import assert from 'node:assert/strict';

import { renderTextureSpec } from '../../src/proxy/texture';
import type { DomPort } from '../../src/ports/dom';

const dom: DomPort = {
  createCanvas: () => null,
  createImage: () => null
};

const limits = { maxCubes: 2048, maxTextureSize: 256, maxAnimationSeconds: 120 };

{
  const res = renderTextureSpec(dom, { name: 't', width: 16, height: 16, ops: [] }, limits);
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.error.code, 'not_implemented');
  }
}
