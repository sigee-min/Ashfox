import assert from 'node:assert/strict';
import * as THREE from 'three';

import {
  applyCameraPreset
} from '../../src/rendering/cameraPresets';

const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 300);
const compactModel = new THREE.Mesh(
  new THREE.BoxGeometry(14, 17, 21)
);
const compactTarget = applyCameraPreset(
  camera,
  'perspective',
  compactModel
);
const compactDistance = camera.position.distanceTo(compactTarget);

const tallModel = new THREE.Mesh(
  new THREE.BoxGeometry(14, 40, 14)
);
const tallTarget = applyCameraPreset(
  camera,
  'perspective',
  tallModel
);
const tallDistance = camera.position.distanceTo(tallTarget);

assert.ok(
  compactDistance < tallDistance,
  'compact assets should be framed closer than tall assets'
);
assert.ok(
  compactDistance < 50,
  'tractor-sized assets should fill more of the viewport'
);

compactModel.geometry.dispose();
tallModel.geometry.dispose();
