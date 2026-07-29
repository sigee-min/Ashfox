import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  TransformControls,
  type TransformControlsMode
} from 'three/addons/controls/TransformControls.js';

import type { ProjectSceneProjection } from './sceneTypes';
import type { CameraCommand } from './viewportTypes';

export interface ViewportRuntime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  transform: TransformControls;
  projection: ProjectSceneProjection | null;
  grid: THREE.GridHelper;
  axes: THREE.AxesHelper;
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.ShadowMaterial>;
  pointerStart: THREE.Vector2;
  transformDragging: boolean;
}

const addLighting = (scene: THREE.Scene): void => {
  scene.add(new THREE.HemisphereLight('#dfe9ff', '#22242a', 1.45));

  const keyLight = new THREE.DirectionalLight('#fff3df', 2.7);
  keyLight.position.set(14, 26, -18);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far = 80;
  keyLight.shadow.camera.left = -24;
  keyLight.shadow.camera.right = 24;
  keyLight.shadow.camera.top = 28;
  keyLight.shadow.camera.bottom = -8;
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight('#7fa8ff', 1.1);
  rimLight.position.set(-18, 12, 16);
  scene.add(rimLight);
};

export const createViewportRuntime = (
  canvas: HTMLCanvasElement
): ViewportRuntime => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#171b20');
  scene.fog = new THREE.Fog('#171b20', 46, 92);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 300);
  camera.position.set(30, 23, -35);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const orbit = new OrbitControls(camera, canvas);
  orbit.target.set(0, 12, 0);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.minDistance = 8;
  orbit.maxDistance = 90;
  orbit.update();

  const transform = new TransformControls(camera, canvas);
  transform.setMode('translate');
  transform.setSpace('local');
  transform.size = 0.78;
  scene.add(transform.getHelper());

  const grid = new THREE.GridHelper(64, 64, '#49515a', '#2b3138');
  grid.material.transparent = true;
  grid.material.opacity = 0.62;
  scene.add(grid);

  const axes = new THREE.AxesHelper(2.25);
  axes.position.set(-10, 0.03, 10);
  scene.add(axes);

  addLighting(scene);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(64, 64),
    new THREE.ShadowMaterial({
      color: '#000000',
      opacity: 0.2
    })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.015;
  floor.receiveShadow = true;
  scene.add(floor);

  return {
    renderer,
    scene,
    camera,
    orbit,
    transform,
    projection: null,
    grid,
    axes,
    floor,
    pointerStart: new THREE.Vector2(),
    transformDragging: false
  };
};

const disposeMaterials = (
  material: THREE.Material | THREE.Material[]
): void => {
  const materials = Array.isArray(material) ? material : [material];
  for (const entry of materials) entry.dispose();
};

export const disposeViewportRuntime = (
  runtime: ViewportRuntime
): void => {
  runtime.transform.detach();
  runtime.transform.dispose();
  runtime.orbit.dispose();
  runtime.projection?.dispose();
  runtime.grid.geometry.dispose();
  disposeMaterials(runtime.grid.material);
  runtime.axes.geometry.dispose();
  disposeMaterials(runtime.axes.material);
  runtime.floor.geometry.dispose();
  runtime.floor.material.dispose();
  runtime.renderer.dispose();
};

export const configureTransformControls = (
  runtime: ViewportRuntime,
  mode: TransformControlsMode,
  snapEnabled: boolean
): void => {
  runtime.transform.setMode(mode);
  runtime.transform.translationSnap = snapEnabled ? 0.5 : null;
  runtime.transform.rotationSnap = snapEnabled
    ? THREE.MathUtils.degToRad(15)
    : null;
  runtime.transform.scaleSnap = snapEnabled ? 0.1 : null;
};

export const applyCameraCommand = (
  runtime: ViewportRuntime,
  command: CameraCommand
): void => {
  const target = new THREE.Vector3(0, 12, 0);
  runtime.camera.up.set(0, 1, 0);
  switch (command.mode) {
    case 'front':
      runtime.camera.position.set(0, 10, -48);
      break;
    case 'side':
      runtime.camera.position.set(48, 10, 0);
      break;
    case 'top':
      runtime.camera.up.set(0, 0, -1);
      runtime.camera.position.set(0, 54, 0.01);
      break;
    case 'perspective':
      runtime.camera.position.set(30, 23, -35);
      break;
  }
  runtime.orbit.target.copy(target);
  runtime.camera.lookAt(target);
  runtime.orbit.update();
};
