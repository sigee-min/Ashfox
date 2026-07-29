'use client';

import {
  useEffect,
  useRef,
  type RefObject
} from 'react';
import * as THREE from 'three';

import type {
  ProjectDocument,
  Transform
} from '@ashfox/engine-core';

import { objectTransformToCanonical } from './sceneTransform';
import {
  createViewportRuntime,
  disposeViewportRuntime,
  type ViewportRuntime
} from './viewportRuntime';
import type { ViewportStats } from './viewportTypes';

interface ViewportRuntimeRefs {
  document: RefObject<ProjectDocument>;
  selectedNodeId: RefObject<string | null>;
  onSelectNode: RefObject<(nodeId: string | null) => void>;
  onCommitTransform: RefObject<
    (nodeId: string, transform: Transform) => void
  >;
  onStats: RefObject<(stats: ViewportStats) => void>;
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
  const documentRef = refs.document;
  const selectedNodeIdRef = refs.selectedNodeId;
  const onSelectNodeRef = refs.onSelectNode;
  const onCommitTransformRef = refs.onCommitTransform;
  const onStatsRef = refs.onStats;

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;

    const runtime = createViewportRuntime(canvas);
    runtimeRef.current = runtime;

    const handleTransformDragging = (event: { value?: unknown }): void => {
      runtime.transformDragging = Boolean(event.value);
      runtime.orbit.enabled = !runtime.transformDragging;
    };
    const handleTransformCommit = (): void => {
      const nodeId = selectedNodeIdRef.current;
      const projection = runtime.projection;
      if (!nodeId || !projection) return;
      const object = projection.objectsByNodeId.get(nodeId);
      const node = documentRef.current.scene.nodes[nodeId];
      if (!object || !node) return;
      onCommitTransformRef.current(
        nodeId,
        objectTransformToCanonical(documentRef.current, node, object)
      );
    };
    runtime.transform.addEventListener(
      'dragging-changed',
      handleTransformDragging
    );
    runtime.transform.addEventListener('mouseUp', handleTransformCommit);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const handlePointerDown = (event: PointerEvent): void => {
      runtime.pointerStart.set(event.clientX, event.clientY);
    };
    const handlePointerUp = (event: PointerEvent): void => {
      if (runtime.transformDragging || !runtime.projection) return;
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
    const render = (time: number): void => {
      runtime.orbit.update();
      runtime.renderer.render(runtime.scene, runtime.camera);
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
      runtime.transform.removeEventListener(
        'dragging-changed',
        handleTransformDragging
      );
      runtime.transform.removeEventListener(
        'mouseUp',
        handleTransformCommit
      );
      disposeViewportRuntime(runtime);
      runtimeRef.current = null;
    };
  }, [
    canvasRef,
    documentRef,
    hostRef,
    onCommitTransformRef,
    onSelectNodeRef,
    onStatsRef,
    selectedNodeIdRef
  ]);

  return runtimeRef;
};
