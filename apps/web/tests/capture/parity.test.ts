import assert from 'node:assert/strict';

import * as THREE from 'three';

import {
  sampleComposedNumericTransformChannel,
  type TransformChannel
} from '@ashfox/engine-core';

import {
  createAnimatedGif
} from '../../src/features/capture/createAnimatedGif';
import {
  applyAnimationPose
} from '../../src/rendering/animationPose';
import {
  createWorkbenchProject
} from '../fixtures/project';

const assertArrayClose = (
  actual: readonly number[],
  expected: readonly number[],
  message: string
): void => {
  assert.equal(actual.length, expected.length, message);
  expected.forEach((value, index) => {
    assert.ok(
      Math.abs((actual[index] ?? Number.NaN) - value) < 0.000001,
      `${message}: component ${index}`
    );
  });
};

const document = structuredClone(createWorkbenchProject());
const nodeId = document.scene.roots[0];
const node = document.scene.nodes[nodeId];
node.transform = {
  position: [4, 8, 12],
  rotation: [10, 20, 30],
  scale: [2, 3, 4],
  pivot: [0, 0, 0]
};
const animationValues = {
  position: [1, 2, 3],
  rotation: [4, 5, 6],
  scale: [1.5, 0.5, 2]
} as const;
const createChannel = (
  property: TransformChannel['property']
): TransformChannel => ({
  id: `channel-preview-${property}`,
  targetNodeId: nodeId,
  property,
  keys: [{
    id: `key-preview-${property}`,
    timeSeconds: 0,
    value: animationValues[property],
    interpolation: 'linear'
  }]
});
const channels = {
  'channel-preview-position': createChannel('position'),
  'channel-preview-rotation': createChannel('rotation'),
  'channel-preview-scale': createChannel('scale')
};
document.animations = {
  'clip-preview-parity': {
    id: 'clip-preview-parity',
    name: 'Idle',
    durationSeconds: 1,
    fps: 20,
    loop: 'loop',
    channels,
    triggers: {}
  }
};

const object = new THREE.Group();
applyAnimationPose(
  document,
  {
    root: new THREE.Group(),
    objectsByNodeId: new Map([[nodeId, object]]),
    selectable: [],
    readiness: {
      status: 'ready',
      error: null
    },
    ready: Promise.resolve(),
    dispose: () => undefined
  },
  'clip-preview-parity',
  0
);

assertArrayClose(
  object.position.toArray(),
  [5, 10, 15],
  'viewport translation must add animation to the non-identity rest pose'
);
assertArrayClose(
  object.scale.toArray(),
  [3, 1.5, 8],
  'viewport scale must multiply the non-identity rest pose'
);
const composedRotation =
  sampleComposedNumericTransformChannel(
    channels['channel-preview-rotation'],
    0,
    { restValue: [10, 20, 30] }
  );
if (!composedRotation) {
  throw new Error('Expected composed viewport rotation.');
}
assertArrayClose(
  [
    THREE.MathUtils.radToDeg(object.rotation.x),
    THREE.MathUtils.radToDeg(object.rotation.y),
    THREE.MathUtils.radToDeg(object.rotation.z)
  ],
  composedRotation,
  'viewport must consume the engine rest-rotation authority'
);

const unsupportedCapture = structuredClone(document);
unsupportedCapture.animations = {
  ...unsupportedCapture.animations,
  'clip-preview-parity': {
  ...unsupportedCapture.animations['clip-preview-parity'],
  startDelay: {
    kind: 'molang',
    source: 'query.life_time'
  }
  }
};

export const test = assert.rejects(
  createAnimatedGif(
    unsupportedCapture,
    {},
    {
      clipId: 'clip-preview-parity',
      environment: 'studio',
      cameraMode: 'perspective'
    },
    {
      signal: new AbortController().signal,
      onProgress: () => undefined
    }
  ),
  (error: unknown) =>
    error instanceof Error &&
    error.message.includes('cannot faithfully render') &&
    error.message.includes('start_delay'),
  'production animation GIF capture must fail before rendering an unfaithful preview'
);
