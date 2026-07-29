import assert from 'node:assert/strict';

import {
  createWorkbenchViewState,
  workbenchViewReducer
} from '../src/features/workbench/state/workbenchViewState';

const initial = createWorkbenchViewState('node-a', 'clip-a');
assert.equal(initial.cameraCommand.nonce, 0);
assert.equal(initial.snapEnabled, true);
assert.deepEqual(initial.viewportOptions, {
  showGrid: true,
  showSkeleton: false,
  showWireframe: false
});

const cameraApplied = workbenchViewReducer(initial, {
  type: 'camera.set',
  mode: 'front'
});
const cameraReapplied = workbenchViewReducer(cameraApplied, {
  type: 'camera.set',
  mode: 'front'
});
assert.deepEqual(cameraReapplied.cameraCommand, {
  mode: 'front',
  nonce: 2
});

const gridHidden = workbenchViewReducer(cameraReapplied, {
  type: 'viewport.toggle',
  option: 'showGrid'
});
assert.equal(gridHidden.viewportOptions.showGrid, false);
assert.equal(gridHidden.viewportOptions.showSkeleton, false);

const nightEnvironment = workbenchViewReducer(gridHidden, {
  type: 'environment.set',
  environment: 'night'
});
assert.equal(nightEnvironment.environment, 'night');

const selected = workbenchViewReducer(nightEnvironment, {
  type: 'node.select',
  nodeId: 'node-b'
});
assert.equal(selected.preferredNodeId, 'node-b');
assert.equal(selected.preferredClipId, 'clip-a');
