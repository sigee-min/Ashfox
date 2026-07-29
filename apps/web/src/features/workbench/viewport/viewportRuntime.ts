import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  TransformControls,
  type TransformControlsMode
} from 'three/addons/controls/TransformControls.js';

import type { ProjectSceneProjection } from './sceneTypes';
import type { CameraCommand } from './viewportTypes';
import { applyCameraPreset } from './cameraPresets';
import {
  addViewportLighting,
  createViewportEnvironment,
  type ViewportEnvironment,
  type ViewportEnvironmentId
} from './viewportEnvironment';

export interface ViewportRuntime {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  orbit: OrbitControls;
  transform: TransformControls;
  projection: ProjectSceneProjection | null;
  environment: ViewportEnvironment;
  grid: THREE.GridHelper;
  axes: THREE.AxesHelper;
  pointerStart: THREE.Vector2;
  transformDragging: boolean;
}

export const createViewportRuntime = (
  canvas: HTMLCanvasElement,
  environmentId: ViewportEnvironmentId = 'studio'
): ViewportRuntime => {
  const scene = new THREE.Scene();
  const environment = createViewportEnvironment(environmentId);
  scene.background = environment.background;
  scene.fog = environment.fog;

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

  addViewportLighting(scene);

  return {
    renderer,
    scene,
    camera,
    orbit,
    transform,
    projection: null,
    environment,
    grid,
    axes,
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
  runtime.environment.dispose();
  runtime.renderer.dispose();
};

export const applyViewportEnvironment = (
  runtime: ViewportRuntime,
  environmentId: ViewportEnvironmentId
): void => {
  if (runtime.environment.id === environmentId) return;
  runtime.environment.dispose();
  runtime.environment = createViewportEnvironment(environmentId);
  runtime.scene.background = runtime.environment.background;
  runtime.scene.fog = runtime.environment.fog;
  runtime.grid.material.opacity = environmentId === 'studio' ? 0.62 : 0.14;
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
  const target = applyCameraPreset(
    runtime.camera,
    command.mode,
    runtime.projection?.root
  );
  runtime.orbit.target.copy(target);
  runtime.orbit.update();
};
