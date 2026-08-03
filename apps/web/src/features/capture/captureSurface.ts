import * as THREE from 'three';

import type { CameraMode } from '../../rendering/cameraPresets';
import { applyCameraPreset } from '../../rendering/cameraPresets';
import type {
  ProjectSceneProjection
} from '../../rendering/sceneTypes';
import {
  addViewportLighting,
  createViewportEnvironment,
  type ViewportEnvironment,
  type ViewportEnvironmentId
} from '../../rendering/viewportEnvironment';
import {
  captureAbortError,
  throwIfCaptureAborted
} from './captureAbort';

export interface CaptureDimensions {
  width: number;
  height: number;
}

export interface CaptureSurfaceOptions extends CaptureDimensions {
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
}

export interface CaptureSurface extends CaptureDimensions {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderCanvas: HTMLCanvasElement;
  environment: ViewportEnvironment;
}

const createRenderer = (
  canvas: HTMLCanvasElement,
  dimensions: CaptureDimensions
): THREE.WebGLRenderer => {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(1);
  renderer.setSize(dimensions.width, dimensions.height, false);
  return renderer;
};

export const createCaptureSurface = (
  options: CaptureSurfaceOptions
): CaptureSurface => {
  const renderCanvas = window.document.createElement('canvas');
  const renderer = createRenderer(renderCanvas, options);
  const scene = new THREE.Scene();
  const environment = createViewportEnvironment(options.environment);
  scene.background = environment.background;
  scene.fog = environment.fog;
  addViewportLighting(scene);

  const camera = new THREE.PerspectiveCamera(
    42,
    options.width / options.height,
    0.05,
    300
  );
  applyCameraPreset(camera, options.cameraMode);

  return {
    renderer,
    scene,
    camera,
    renderCanvas,
    environment,
    width: options.width,
    height: options.height
  };
};

const CAPTURE_FRAME_DISTANCE_SCALE = 0.82;

export const frameCaptureObject = (
  surface: CaptureSurface,
  cameraMode: CameraMode,
  object: THREE.Object3D
): void => {
  const target = applyCameraPreset(
    surface.camera,
    cameraMode,
    object
  );
  const offset = surface.camera.position
    .clone()
    .sub(target)
    .multiplyScalar(CAPTURE_FRAME_DISTANCE_SCALE);
  surface.camera.position.copy(target).add(offset);
  surface.camera.lookAt(target);
  surface.camera.updateProjectionMatrix();

  // Gallery and process captures must keep every authored edge readable.
  // Environment fog remains available in the live viewport, but it should
  // not wash out large models in exported marketing artifacts.
  surface.scene.fog = null;
};

export const renderCaptureSurface = (
  surface: CaptureSurface
): void => {
  surface.renderer.render(surface.scene, surface.camera);
};

export const canvasToPngBytes = (
  canvas: HTMLCanvasElement
): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('PNG capture could not be encoded.'));
        return;
      }
      void blob.arrayBuffer().then(
        (buffer) => resolve(new Uint8Array(buffer)),
        reject
      );
    }, 'image/png');
  });

export const captureSurfacePngBytes = async (
  surface: CaptureSurface
): Promise<Uint8Array> => {
  renderCaptureSurface(surface);
  return canvasToPngBytes(surface.renderCanvas);
};

export const disposeCaptureSurface = (
  surface: CaptureSurface
): void => {
  surface.environment.dispose();
  surface.renderer.dispose();
};

export const waitForProjectionTextures = async (
  projection: ProjectSceneProjection,
  signal: AbortSignal
): Promise<void> => {
  throwIfCaptureAborted(signal);
  let abort: (() => void) | null = null;
  const aborted = new Promise<never>((_resolve, reject) => {
    abort = () => reject(captureAbortError());
    signal.addEventListener('abort', abort, { once: true });
  });
  try {
    await Promise.race([projection.ready, aborted]);
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
  }
  throwIfCaptureAborted(signal);
  if (projection.readiness.status === 'failed') {
    throw new Error(
      projection.readiness.error ??
      'A project texture could not be decoded.'
    );
  }
  if (projection.readiness.status !== 'ready') {
    throw new Error('Project textures did not reach a ready state.');
  }
};
