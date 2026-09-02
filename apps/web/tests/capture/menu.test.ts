import assert from 'node:assert/strict';

import {
  captureRequestPort,
  presentCaptureMenu,
  type CaptureMenuAuthority,
  type CapturePlanReader
} from '../../src/features/capture/menu';
import type { GifCaptureFile } from '../../src/features/capture/gifCaptureFile';
import { createWorkbenchProject } from '../fixtures/project';

const document = createWorkbenchProject().document;

const authority = (
  overrides: Partial<CaptureMenuAuthority> = {}
): CaptureMenuAuthority => ({
  document,
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
  blockedReason: null,
  ...overrides
});

const planReader: CapturePlanReader = Object.freeze({
  read: () => Object.freeze({ frames: 7, events: 4, error: null })
});

const view = presentCaptureMenu(authority(), planReader);
assert.equal(view.framesLabel, '7 frames');
assert.equal(view.eventsLabel, '4 replay steps');
assert.equal(view.startLabel, 'Capture build replay');
assert.equal(view.statusTone, 'default');
assert.equal(
  view.statusMessage,
  'Starts from an empty scene, places every visible element in deterministic canonical element order, applies each element\'s complete owning texture set atomically, activates canonical authored idle motion when available, and holds on the complete model.'
);
assert.equal(Object.isFrozen(view), true);

const request = captureRequestPort.create(authority());
assert.deepEqual(request, {
  kind: 'build',
  environment: 'studio',
  cameraMode: 'perspective'
});
assert.equal(Object.isFrozen(request), true);

const readyFile: GifCaptureFile = {
  kind: 'build',
  name: 'ready.gif',
  contentType: 'image/gif',
  bytes: new Uint8Array(),
  width: 640,
  height: 360,
  frameCount: 7,
  eventCount: 4,
  fps: 10,
  projectId: document.id,
  revision: document.revision,
  target: 'capture',
  targetVersion: null,
  contentHash: `sha256:${'0'.repeat(64)}`
};
const readyView = presentCaptureMenu(
  authority({ captureFile: readyFile, canDownload: true }),
  planReader
);
assert.equal(readyView.ready, true);
assert.equal(readyView.startLabel, 'Capture again');
assert.equal(readyView.downloadDisabled, false);
assert.equal(readyView.statusMessage, 'Ready · 7 frames · 4 replay steps');

const runningView = presentCaptureMenu(authority({
  operation: {
    phase: 'running',
    operationId: 3,
    kind: 'capture',
    message: 'Captured 2/7 frames',
    result: null
  }
}), planReader);
assert.equal(runningView.capturing, true);
assert.equal(runningView.statusMessage, 'Captured 2/7 frames');

const failingReader: CapturePlanReader = Object.freeze({
  read: () => Object.freeze({
    frames: 0,
    events: 0,
    error: 'No visible model geometry.'
  })
});
const failedView = presentCaptureMenu(authority(), failingReader);
assert.equal(failedView.startDisabled, true);
assert.equal(failedView.statusTone, 'error');
assert.equal(failedView.statusMessage, 'No visible model geometry.');

const blockedView = presentCaptureMenu(authority({
  blockedReason: 'Accept every revision-bound visual review before capture.'
}), planReader);
assert.equal(blockedView.startDisabled, true);
assert.equal(blockedView.statusTone, 'default');
assert.equal(
  blockedView.statusMessage,
  'Accept every revision-bound visual review before capture.'
);
