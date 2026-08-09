'use client';

import {
  useEffect,
  useRef,
  type RefObject
} from 'react';
import * as THREE from 'three';

import {
  createViewportRuntime,
  disposeViewportRuntime,
  type ViewportRuntime
} from './viewportRuntime';
import type { ViewportStats } from './viewportTypes';

interface ViewportRuntimeRefs {
  onSelectNode: RefObject<(nodeId: string | null) => void>;
  onStats: RefObject<(stats: ViewportStats) => void>;
  onFrame: RefObject<(frameNonce: number) => void>;
}

const resizeRenderer = (
  runtime: ViewportRuntime,
  host: HTMLDivElement
): void => {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  runtime.renderer.setSize(width, height, false);
  runtime.camera.aspect = width / height;
  runtime.camera.updateProjectionMatrix();
};

export const useViewportRuntime = (
  hostRef: RefObject<HTMLDivElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  refs: ViewportRuntimeRefs
): RefObject<ViewportRuntime | null> => {
  const runtimeRef = useRef<ViewportRuntime | null>(null);
  const onSelectNodeRef = refs.onSelectNode;
  const onStatsRef = refs.onStats;
  const onFrameRef = refs.onFrame;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const runtime = createViewportRuntime(canvas);
    runtimeRef.current = runtime;

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent): void => {
      runtime.pointerStart.set(event.clientX, event.clientY);
    };
    const handlePointerUp = (event: PointerEvent): void => {
      if (!runtime.projection) return;
      const distance = runtime.pointerStart.distanceTo(
        new THREE.Vector2(event.clientX, event.clientY)
      );
      if (distance > 4) return;

      const bounds = canvas.getBoundingClientRect();
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      );
      raycaster.setFromCamera(pointer, runtime.camera);
      const nodeId = raycaster
        .intersectObjects(runtime.projection.selectable, false)
        .find(
          (intersection) =>
            typeof intersection.object.userData.nodeId === 'string'
        )?.object.userData.nodeId as string | undefined;
      onSelectNodeRef.current(nodeId ?? null);
    };
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointerup', handlePointerUp);

    const resizeObserver = new ResizeObserver(() =>
      resizeRenderer(runtime, host)
    );
    resizeObserver.observe(host);
    resizeRenderer(runtime, host);

    let animationFrame = 0;
    let lastStatsUpdate = 0;
    let frameNonce = 0;
    const render = (time: number): void => {
      runtime.orbit.update();
      runtime.renderer.render(runtime.scene, runtime.camera);
      frameNonce += 1;
      onFrameRef.current(frameNonce);
      if (time - lastStatsUpdate > 500) {
        lastStatsUpdate = time;
        onStatsRef.current({
          calls: runtime.renderer.info.render.calls,
          triangles: runtime.renderer.info.render.triangles
        });
      }
      animationFrame = requestAnimationFrame(render);
    };
    animationFrame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerup', handlePointerUp);
      disposeViewportRuntime(runtime);
      runtimeRef.current = null;
    };
  }, [
    canvasRef,
    hostRef,
    onFrameRef,
    onSelectNodeRef,
    onStatsRef
  ]);

  return runtimeRef;
};
