import * as THREE from 'three';

export type CameraMode =
  | 'perspective'
  | 'native'
  | 'front'
  | 'side'
  | 'top';

const CAMERA_TARGET = new THREE.Vector3(0, 16, 0);
const CAMERA_PADDING = 1.18;

const cameraDirection = (mode: CameraMode): THREE.Vector3 => {
  switch (mode) {
    case 'front':
      return new THREE.Vector3(0, 0, -1);
    case 'side':
      return new THREE.Vector3(1, 0, 0);
    case 'top':
      return new THREE.Vector3(0, 1, 0);
    case 'perspective':
    case 'native':
      return new THREE.Vector3(41, 13, -52).normalize();
  }
};

const frameDimensions = (
  mode: CameraMode,
  size: THREE.Vector3
): readonly [number, number, number] => {
  switch (mode) {
    case 'front':
      return [size.x, size.y, size.z];
    case 'side':
      return [size.z, size.y, size.x];
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
  object?: THREE.Object3D
): { target: THREE.Vector3; distance: number } | null => {
  if (!object) return null;
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) return null;

  const target = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  const [width, height, depth] = frameDimensions(mode, size);
  const verticalFov = THREE.MathUtils.degToRad(camera.fov);
  const horizontalFov = 2 * Math.atan(
    Math.tan(verticalFov / 2) * camera.aspect
  );
  const widthDistance = width / 2 / Math.tan(horizontalFov / 2);
  const heightDistance = height / 2 / Math.tan(verticalFov / 2);
  const distance = Math.max(
    12,
    (Math.max(widthDistance, heightDistance) + depth / 2) *
      (mode === 'native' ? 2.35 : CAMERA_PADDING)
  );
  return { target, distance };
};

export const applyCameraPreset = (
  camera: THREE.PerspectiveCamera,
  mode: CameraMode,
  object?: THREE.Object3D
): THREE.Vector3 => {
  const frame = objectFrame(camera, mode, object);
  const target = frame?.target ?? CAMERA_TARGET;
  camera.up.set(0, 1, 0);
  if (mode === 'top') camera.up.set(0, 0, -1);
  const distance = frame?.distance ?? cameraDirection(mode).length() * 68;
  camera.position.copy(target).add(
    cameraDirection(mode).multiplyScalar(distance)
  );
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return target.clone();
};
