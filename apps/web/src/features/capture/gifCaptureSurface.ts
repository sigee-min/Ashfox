import * as THREE from 'three';
import {
  GIFEncoder,
  applyPalette,
  quantize
} from 'gifenc';

import type { CameraMode } from '../workbench/viewport/cameraPresets';
import { applyCameraPreset } from '../workbench/viewport/cameraPresets';
import {
  addViewportLighting,
  createViewportEnvironment,
  type ViewportEnvironment
} from '../workbench/viewport/viewportEnvironment';
import type { ViewportEnvironmentId } from '../workbench/viewport/viewportEnvironment';
import {
  captureAbortError,
  throwIfCaptureAborted
} from './captureAbort';
import { GIF_CAPTURE_FPS } from './gifFramePlan';

export const GIF_CAPTURE_WIDTH = 640;
export const GIF_CAPTURE_HEIGHT = 360;

export interface GifCaptureSurface {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderCanvas: HTMLCanvasElement;
  outputContext: CanvasRenderingContext2D;
  encoder: ReturnType<typeof GIFEncoder>;
  environment: ViewportEnvironment;
  frameCount: number;
}

export interface GifCaptureResult {
  bytes: Uint8Array;
  frameCount: number;
  eventCount: number;
  fps: number;
}

export type GifFrameOverlay = (
  context: CanvasRenderingContext2D
) => void;

const createRenderer = (
  canvas: HTMLCanvasElement
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
  renderer.setSize(GIF_CAPTURE_WIDTH, GIF_CAPTURE_HEIGHT, false);
  return renderer;
};

export const createGifCaptureSurface = (
  environmentId: ViewportEnvironmentId,
  cameraMode: CameraMode
): GifCaptureSurface => {
  const renderCanvas = window.document.createElement('canvas');
  const outputCanvas = window.document.createElement('canvas');
  outputCanvas.width = GIF_CAPTURE_WIDTH;
  outputCanvas.height = GIF_CAPTURE_HEIGHT;
  const outputContext = outputCanvas.getContext('2d', {
    willReadFrequently: true
  });
  if (!outputContext) {
    throw new Error('GIF capture canvas is unavailable.');
  }

  const renderer = createRenderer(renderCanvas);
  const scene = new THREE.Scene();
  const environment = createViewportEnvironment(environmentId);
  scene.background = environment.background;
  scene.fog = environment.fog;
  addViewportLighting(scene);

  const camera = new THREE.PerspectiveCamera(
    42,
    GIF_CAPTURE_WIDTH / GIF_CAPTURE_HEIGHT,
    0.05,
    300
  );
  applyCameraPreset(camera, cameraMode);

  return {
    renderer,
    scene,
    camera,
    renderCanvas,
    outputContext,
    encoder: GIFEncoder(),
    environment,
    frameCount: 0
  };
};

export const encodeGifSurfaceFrame = (
  surface: GifCaptureSurface,
  overlay?: GifFrameOverlay
): void => {
  surface.renderer.render(surface.scene, surface.camera);
  surface.outputContext.clearRect(
    0,
    0,
    GIF_CAPTURE_WIDTH,
    GIF_CAPTURE_HEIGHT
  );
  surface.outputContext.drawImage(
    surface.renderCanvas,
    0,
    0,
    GIF_CAPTURE_WIDTH,
    GIF_CAPTURE_HEIGHT
  );
  overlay?.(surface.outputContext);

  const rgba = surface.outputContext.getImageData(
    0,
    0,
    GIF_CAPTURE_WIDTH,
    GIF_CAPTURE_HEIGHT
  ).data;
  const palette = quantize(rgba, 128, {
    format: 'rgba4444',
    oneBitAlpha: false
  });
  const indexed = applyPalette(rgba, palette, 'rgba4444');
  surface.encoder.writeFrame(
    indexed,
    GIF_CAPTURE_WIDTH,
    GIF_CAPTURE_HEIGHT,
    {
      palette,
      delay: 1000 / GIF_CAPTURE_FPS,
      repeat: surface.frameCount === 0 ? 0 : undefined
    }
  );
  surface.frameCount += 1;
};

export const finishGifCaptureSurface = (
  surface: GifCaptureSurface
): Uint8Array => {
  surface.encoder.finish();
  return surface.encoder.bytes();
};

export const disposeGifCaptureSurface = (
  surface: GifCaptureSurface
): void => {
  surface.environment.dispose();
  surface.renderer.dispose();
};

const waitForImage = (
  image: HTMLImageElement,
  signal: AbortSignal
): Promise<void> => {
  if (image.complete) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onLoad = (): void => {
      cleanup();
      resolve();
    };
    const onError = (): void => {
      cleanup();
      resolve();
    };
    const onAbort = (): void => {
      cleanup();
      reject(captureAbortError());
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
  });
};

export const waitForSceneTextures = async (
  root: THREE.Object3D,
  signal: AbortSignal
): Promise<void> => {
  throwIfCaptureAborted(signal);
  const images = new Set<HTMLImageElement>();
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];
    for (const material of materials) {
      const map = (material as THREE.MeshStandardMaterial).map;
      if (map?.image instanceof HTMLImageElement) images.add(map.image);
    }
  });
  await Promise.all([...images].map((image) => waitForImage(image, signal)));
};
