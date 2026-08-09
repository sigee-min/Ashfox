import assert from 'node:assert/strict';
import type * as THREE from 'three';

import {
  captureViewportFrameEvidence
} from '../../src/features/workbench/viewport/evidence';
import { FRAME_EVIDENCE_FIXTURE } from '../fixtures/frame';

const renderer = (
  contextLost = false
): THREE.WebGLRenderer => ({
  getDrawingBufferSize: (target: THREE.Vector2) => target.set(1, 1),
  getContext: () => ({
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    NO_ERROR: 0,
    isContextLost: () => contextLost,
    getError: () => 0,
    readPixels: (
      _x: number,
      _y: number,
      _width: number,
      _height: number,
      _format: number,
      _type: number,
      pixels: Uint8Array
    ) => pixels.set([0, 0, 0, 255])
  })
} as unknown as THREE.WebGLRenderer);

export const test = (async (): Promise<void> => {
  const captured = await captureViewportFrameEvidence(renderer());
  assert.equal(captured.ok, true);
  if (captured.ok) {
    assert.deepEqual(
      captured.evidence,
      FRAME_EVIDENCE_FIXTURE,
      'capture evidence must be derived from readPixels output'
    );
  }

  const unavailable = await captureViewportFrameEvidence(renderer(true));
  assert.deepEqual(unavailable, {
    ok: false,
    error: 'the viewport WebGL context is lost'
  });
})();
