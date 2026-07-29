'use client';

import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent
} from 'react';
import * as THREE from 'three';

import { applyAnimationPose } from './viewport/animationPose';
import { projectToThreeScene } from './viewport/projectSceneProjection';
import { useViewportRuntime } from './viewport/useViewportRuntime';
import {
  applyCameraCommand,
  configureTransformControls,
  disposeSelectionBox
} from './viewport/viewportRuntime';
import type { ViewportProps } from './viewport/viewportTypes';

export function Viewport({
  document,
  assets,
  selectedNodeId,
  transformMode,
  snapEnabled,
  options,
  cameraCommand,
  activeClipId,
  playhead,
  playing,
  onSelectNode,
  onCommitTransform,
  onRenderedRevision,
  onStats
}: ViewportProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef(document);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const onSelectNodeRef = useRef(onSelectNode);
  const onCommitTransformRef = useRef(onCommitTransform);
  const onRenderedRevisionRef = useRef(onRenderedRevision);
  const onStatsRef = useRef(onStats);

  documentRef.current = document;
  selectedNodeIdRef.current = selectedNodeId;
  onSelectNodeRef.current = onSelectNode;
  onCommitTransformRef.current = onCommitTransform;
  onRenderedRevisionRef.current = onRenderedRevision;
  onStatsRef.current = onStats;

  const runtimeRef = useViewportRuntime(hostRef, canvasRef, {
    document: documentRef,
    selectedNodeId: selectedNodeIdRef,
    onSelectNode: onSelectNodeRef,
    onCommitTransform: onCommitTransformRef,
    onStats: onStatsRef
  });

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;

    runtime.transform.detach();
    disposeSelectionBox(runtime);
    if (runtime.projection) {
      runtime.scene.remove(runtime.projection.root);
      runtime.projection.dispose();
    }

    const projection = projectToThreeScene(document, {
      assets,
      showSkeleton: options.showSkeleton,
      showWireframe: options.showWireframe
    });
    runtime.projection = projection;
    runtime.scene.add(projection.root);
    applyAnimationPose(document, projection, activeClipId, playhead);
    onRenderedRevisionRef.current(document.revision);
  }, [
    activeClipId,
    assets,
    document,
    options.showSkeleton,
    options.showWireframe,
    runtimeRef
  ]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const projection = runtime?.projection;
    if (!runtime || !projection) return;
    applyAnimationPose(document, projection, activeClipId, playhead);
  }, [activeClipId, document, playhead, runtimeRef]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const projection = runtime?.projection;
    if (!runtime || !projection) return;

    runtime.transform.detach();
    disposeSelectionBox(runtime);
    if (!selectedNodeId) return;
    const object = projection.objectsByNodeId.get(selectedNodeId);
    if (!object) return;

    runtime.selectionBox = new THREE.BoxHelper(object, '#f1b24c');
    runtime.selectionBox.material.depthTest = false;
    runtime.selectionBox.material.transparent = true;
    runtime.selectionBox.material.opacity = 0.9;
    runtime.selectionBox.renderOrder = 6;
    runtime.scene.add(runtime.selectionBox);
    if (!playing) runtime.transform.attach(object);
  }, [document, playing, runtimeRef, selectedNodeId]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) configureTransformControls(runtime, transformMode, snapEnabled);
  }, [runtimeRef, snapEnabled, transformMode]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    runtime.grid.visible = options.showGrid;
    runtime.axes.visible = options.showGrid;
  }, [options.showGrid, runtimeRef]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (runtime) applyCameraCommand(runtime, cameraCommand);
  }, [cameraCommand, runtimeRef]);

  const stopContextMenu = (event: ReactPointerEvent): void => {
    if (event.button === 2) event.preventDefault();
  };

  return (
    <div
      ref={hostRef}
      className="viewport-host"
      data-testid="viewport"
      onPointerDown={stopContextMenu}
    >
      <canvas ref={canvasRef} aria-label="3D project viewport" />
      <div className="viewport-gradient" />
      <div className="viewport-help">
        <span><b>LMB</b> orbit</span>
        <span><b>RMB</b> pan</span>
        <span><b>Wheel</b> zoom</span>
      </div>
    </div>
  );
}
