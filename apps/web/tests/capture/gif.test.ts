import assert from 'node:assert/strict';

import type { AnimationClip } from '@ashfox/engine-core';

import {
  createGifFramePlan,
  GIF_CAPTURE_FPS,
  MAX_GIF_CAPTURE_FRAMES
} from '../../src/features/capture/gifFramePlan';

const clip: AnimationClip = {
  id: 'clip-demo',
  name: 'animation.demo',
  durationSeconds: 0.35,
  fps: 24,
  loop: 'loop',
  channels: {},
  triggers: {
    'sound-step': {
      id: 'sound-step',
      type: 'sound',
      keys: [{
        id: 'sound-key',
        timeSeconds: 0.12,
        value: { effect: 'step.grass' }
      }]
    },
    'timeline-ready': {
      id: 'timeline-ready',
      type: 'timeline',
      keys: [{
        id: 'timeline-key',
        timeSeconds: 0.3,
        value: ['ready', 'look_at_target']
      }]
    }
  }
};

const plan = createGifFramePlan(clip);
assert.equal(plan.fps, GIF_CAPTURE_FPS);
assert.equal(plan.frames.length, 4);
assert.deepEqual(
  plan.frames.map((frame) => frame.timeSeconds),
  [0, 0.1, 0.2, 0.3]
);
assert.equal(plan.eventCount, 3);
assert.deepEqual(
  plan.frames[1].events.map((event) => event.label),
  ['step.grass']
);
assert.deepEqual(
  plan.frames[3].events.map((event) => event.label),
  ['ready', 'look_at_target']
);

assert.throws(
  () =>
    createGifFramePlan({
      ...clip,
      durationSeconds: MAX_GIF_CAPTURE_FRAMES / GIF_CAPTURE_FPS + 0.1
    }),
  /at most 300 frames/
);
