import assert from 'node:assert/strict';

import type { ProjectDocument } from '@ashfox/engine-core';

import {
  captureRequestPort,
  presentCaptureMenu,
  type CaptureMenuAuthority,
  type CapturePlanReader
} from '../../src/features/capture/menu';
import type { GifCaptureFile } from '../../src/features/capture/gifCaptureFile';
import { createWorkbenchProject } from '../fixtures/project';

const document = createWorkbenchProject();
const clipId = Object.keys(document.animations)[0] ?? null;

const authority = (
  overrides: Partial<CaptureMenuAuthority> = {}
): CaptureMenuAuthority => ({
  document,
  buildDocuments: [document],
  activity: [],
  activeClipId: clipId,
  environment: 'studio',
  cameraMode: 'perspective',
  operation: {
    phase: 'idle',
    operationId: 0,
    kind: null,
    message: null,
    result: null
  },
  captureFile: null,
  canDownload: false,
  ...overrides
});

const planReader: CapturePlanReader = Object.freeze({
  read: () => Object.freeze({
    build: Object.freeze({ frames: 7, events: 2, error: null }),
    animation: Object.freeze({ frames: 11, events: 3, error: null })
  })
});

const buildView = presentCaptureMenu(authority(), 'build', planReader);
assert.equal(buildView.framesLabel, '7 frames');
assert.equal(buildView.eventsLabel, '2 build events');
assert.equal(buildView.startLabel, 'Capture build process');
assert.equal(buildView.statusTone, 'default');
assert.equal(Object.isFrozen(buildView), true);
assert.equal(Object.isFrozen(buildView.clips), true);
assert.equal(buildView.clips.every(Object.isFrozen), true);

const animationRequest = captureRequestPort.create(authority(), 'animation');
assert.deepEqual(animationRequest, {
  kind: 'animation',
  clipId,
  environment: 'studio',
  cameraMode: 'perspective'
});
assert.equal(Object.isFrozen(animationRequest), true);
assert.equal(
  captureRequestPort.create(authority({ activeClipId: null }), 'animation'),
  null
);

const buildRequest = captureRequestPort.create(authority(), 'build');
assert.deepEqual(buildRequest, {
  kind: 'build',
  documents: [document],
  receipts: [],
  environment: 'studio',
  cameraMode: 'perspective'
});
assert.equal(Object.isFrozen(buildRequest), true);

const readyFile: GifCaptureFile = {
  kind: 'build',
  name: 'ready.gif',
  contentType: 'image/gif',
  bytes: new Uint8Array(),
  width: 640,
  height: 360,
  frameCount: 7,
  eventCount: 2,
  fps: 10,
  projectId: document.id,
  sourceRevision: document.revision,
  target: 'capture',
  contentHash: `sha256:${'0'.repeat(64)}`
};
const readyView = presentCaptureMenu(
  authority({ captureFile: readyFile, canDownload: true }),
  'build',
  planReader
);
assert.equal(readyView.ready, true);
assert.equal(readyView.startLabel, 'Capture again');
assert.equal(readyView.downloadDisabled, false);
assert.equal(readyView.statusMessage, 'Ready · 7 frames · 2 build events');

const runningView = presentCaptureMenu(authority({
  operation: {
    phase: 'running',
    operationId: 3,
    kind: 'capture',
    message: 'Captured 2/7 frames',
    result: null
  }
}), 'build', planReader);
assert.equal(runningView.capturing, true);
assert.equal(runningView.statusMessage, 'Captured 2/7 frames');

const failingReader: CapturePlanReader = Object.freeze({
  read: () => Object.freeze({
    build: Object.freeze({ frames: 0, events: 0, error: 'No history.' }),
    animation: Object.freeze({ frames: 0, events: 0, error: null })
  })
});
const failedView = presentCaptureMenu(authority(), 'build', failingReader);
assert.equal(failedView.startDisabled, true);
assert.equal(failedView.statusTone, 'error');
assert.equal(failedView.statusMessage, 'No history.');

const defaultView = presentCaptureMenu(authority(), 'animation');
assert.equal(defaultView.showAnimationPicker, true);
assert.equal(defaultView.activeClipId, clipId ?? '');
assert.ok(defaultView.framesLabel.endsWith(' frames'));

const documentWithoutAnimations: ProjectDocument = {
  ...document,
  animations: {}
};
const emptyView = presentCaptureMenu(authority({
  document: documentWithoutAnimations,
  activeClipId: null
}), 'animation');
assert.equal(emptyView.clips.length, 0);
assert.equal(emptyView.startDisabled, true);
assert.equal(
  emptyView.statusMessage,
  'Add or select an animation clip first.'
);
