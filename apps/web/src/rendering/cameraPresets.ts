import * as THREE from 'three';

import {
  projectSignedViewFrame,
  type ProjectAxisVector,
  type ProjectForwardDirection,
  type ProjectSignedView
} from '@ashfox/engine-core';

export type CameraMode =
  | 'perspective'
  | 'native'
  | 'front'
  | 'side'
  | 'top';

const CAMERA_TARGET = new THREE.Vector3(0, 16, 0);
const CAMERA_PADDING = 1.18;
/** `native` is gameplay framing; capture pixel dimensions stay independent. */
const NATIVE_GAMEPLAY_PADDING = 2.35;

const forwardDirection = (
  forward: ProjectForwardDirection
): THREE.Vector3 => {
  switch (forward) {
    case 'north': return new THREE.Vector3(0, 0, -1);
    case 'south': return new THREE.Vector3(0, 0, 1);
    case 'east': return new THREE.Vector3(1, 0, 0);
    case 'west': return new THREE.Vector3(-1, 0, 0);
  }
};

const cameraDirection = (
  mode: CameraMode,
  forward: ProjectForwardDirection
): THREE.Vector3 => {
  switch (mode) {
    case 'front': return forwardDirection(forward);
    case 'side': {
      const direction = forwardDirection(forward);
      return new THREE.Vector3(-direction.z, 0, direction.x);
    }
    case 'top':
      return new THREE.Vector3(0, 1, 0);
    case 'perspective':
    case 'native':
      return new THREE.Vector3(41, 13, -52).normalize();
  }
};

const frameDimensions = (
  mode: CameraMode,
  size: THREE.Vector3,
  forward: ProjectForwardDirection
): readonly [number, number, number] => {
  const forwardIsX = forward === 'east' || forward === 'west';
  switch (mode) {
    case 'front': return forwardIsX
      ? [size.z, size.y, size.x] : [size.x, size.y, size.z];
    case 'side': return forwardIsX
      ? [size.x, size.y, size.z] : [size.z, size.y, size.x];
    case 'top':
      return [size.x, size.z, size.y];
    case 'perspective':
    case 'native':
      return [size.x, size.y, size.z];
  }
};

const objectFrame = (
  camera: THREE.PerspectiveCamera,
  mode: CameraMode,
  object: THREE.Object3D | undefined,
  forward: ProjectForwardDirection
): { target: THREE.Vector3; distance: number } | null => {
  if (!object) return null;
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;

  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const [width, height, depth] = frameDimensions(mode, size, forward);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * camera.aspect
  );
  const widthDistance = width / 2 / Math.tan(horizontalFov / 2);
  const heightDistance = height / 2 / Math.tan(verticalFov / 2);
  const distance = Math.max(
    12,
    (Math.max(widthDistance, heightDistance) + depth / 2) *
      (mode === 'native' ? NATIVE_GAMEPLAY_PADDING : CAMERA_PADDING)
  );
  return { target, distance };
};

const spanAlong = (
  size: THREE.Vector3,
  axis: ProjectAxisVector
): number => Math.abs(axis[0]) * size.x + Math.abs(axis[1]) * size.y +
  Math.abs(axis[2]) * size.z;

const signedObjectFrame = (
  camera: THREE.PerspectiveCamera,
  view: ProjectSignedView,
  object: THREE.Object3D | undefined,
  forward: ProjectForwardDirection
): { target: THREE.Vector3; distance: number } | null => {
  if (!object) return null;
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;
  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const axes = projectSignedViewFrame(forward, view);
  const width = spanAlong(size, axes.inline);
  const height = spanAlong(size, axes.cross);
  const depth = spanAlong(size, axes.depth);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * camera.aspect
  );
  const widthDistance = width / 2 / Math.tan(horizontalFov / 2);
  const heightDistance = height / 2 / Math.tan(verticalFov / 2);
  return { target, distance: Math.max(12,
    (Math.max(widthDistance, heightDistance) + depth / 2) * CAMERA_PADDING) };
};

export const applyCameraPreset = (
  camera: THREE.PerspectiveCamera,
  mode: CameraMode,
  object?: THREE.Object3D,
  forward: ProjectForwardDirection = 'north'
): THREE.Vector3 => {
  const frame = objectFrame(camera, mode, object, forward);
  const target = frame?.target ?? CAMERA_TARGET;
  camera.up.set(0, 1, 0);
  if (mode === 'top') camera.up.set(0, 0, -1);
  const direction = cameraDirection(mode, forward);
  const distance = frame?.distance ?? direction.length() * 68;
  camera.position.copy(target).add(
    direction.multiplyScalar(distance)
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target.clone();
};

/**
 * Applies one exact signed semantic view. This deliberately does not collapse
 * left/right, front/rear, or up/down into the retired UI camera modes.
 */
export const applySignedProjectViewPreset = (
  camera: THREE.PerspectiveCamera,
  view: ProjectSignedView,
  object?: THREE.Object3D,
  forward: ProjectForwardDirection = 'north'
): THREE.Vector3 => {
  const axes = projectSignedViewFrame(forward, view);
  const frame = signedObjectFrame(camera, view, object, forward);
  const target = frame?.target ?? CAMERA_TARGET;
  camera.up.set(...axes.cross);
  const direction = new THREE.Vector3(...axes.depth);
  const distance = frame?.distance ?? direction.length() * 68;
  camera.position.copy(target).add(direction.multiplyScalar(distance));
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target.clone();
};
