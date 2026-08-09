'use client';

import { useCallback, useReducer, useState } from 'react';

import type { ProjectDocument } from '@ashfox/engine-core';

import type {
  ViewportEnvironmentId
} from '../../../rendering/viewportEnvironment';
import {
  useAnimationPlayback
} from '../hooks/useAnimationPlayback';
import {
  resolveActiveClipId,
  resolveSelectedNodeId
} from '../state/workbenchSelection';
import {
  createWorkbenchViewState,
  workbenchViewReducer,
  type BottomWorkspaceMode,
  type WorkbenchOverlay
} from '../state/workbenchViewState';
import type {
  CameraCommand,
  ViewportOptions,
  ViewportStats
} from '../viewport/viewportTypes';

interface UseWorkbenchViewControllerInput {
  document: ProjectDocument;
  initialSelectionId: string | null;
  initialClipId: string | null;
}

interface AgentViewRequest {
  clipId: string | null;
  camera: CameraCommand['mode'];
}

export const useWorkbenchViewController = ({
  document,
  initialSelectionId,
  initialClipId
}: UseWorkbenchViewControllerInput) => {
  const [view, dispatchView] = useReducer(
    workbenchViewReducer,
    { initialSelectionId, initialClipId },
    (initial) => createWorkbenchViewState(
      initial.initialSelectionId,
      initial.initialClipId
    )
  );
  const [viewportStats, setViewportStats] = useState<ViewportStats>({
    calls: 0,
    triangles: 0
  });
  const selectedNodeId = resolveSelectedNodeId(
    document,
    view.preferredNodeId
  );
  const activeClipId = resolveActiveClipId(
    document,
    view.preferredClipId
  );
  const activeClip = activeClipId
    ? document.animations[activeClipId]
    : undefined;
  const {
    playhead,
    setPlayhead,
    playing,
    setPlaying
  } = useAnimationPlayback(activeClip);
  const canPlay = activeClip !== undefined;

  const selectNode = useCallback((nodeId: string | null): void => {
    dispatchView({ type: 'node.select', nodeId });
  }, []);

  const setEnvironment = useCallback((
    environment: ViewportEnvironmentId
  ): void => {
    dispatchView({ type: 'environment.set', environment });
  }, []);

  const setActiveOverlay = useCallback((
    overlay: WorkbenchOverlay
  ): void => {
    dispatchView({ type: 'overlay.set', overlay });
  }, []);

  const setBottomMode = useCallback((
    mode: BottomWorkspaceMode
  ): void => {
    dispatchView({ type: 'bottom.set', mode });
  }, []);

  const closePanels = useCallback((): void => {
    dispatchView({ type: 'overlay.set', overlay: null });
  }, []);

  const setCamera = useCallback((
    mode: CameraCommand['mode']
  ): void => {
    dispatchView({ type: 'camera.set', mode });
  }, []);

  const toggleViewportOption = useCallback((
    option: keyof ViewportOptions
  ): void => {
    dispatchView({ type: 'viewport.toggle', option });
  }, []);

  const changeActiveClip = useCallback((
    clipId: string | null
  ): void => {
    dispatchView({ type: 'clip.select', clipId });
    setPlayhead(0);
  }, [setPlayhead]);

  const togglePlayback = useCallback((): void => {
    if (!canPlay) return;
    setPlaying((current) => !current);
  }, [canPlay, setPlaying]);

  const prepareAgentView = useCallback((
    request: AgentViewRequest
  ): void => {
    dispatchView({ type: 'clip.select', clipId: request.clipId });
    dispatchView({ type: 'bottom.set', mode: 'animation' });
    dispatchView({ type: 'overlay.set', overlay: null });
    dispatchView({ type: 'camera.set', mode: request.camera });
  }, []);

  const resetProjectView = useCallback((): void => {
    dispatchView({ type: 'node.select', nodeId: null });
    dispatchView({ type: 'clip.select', clipId: null });
    dispatchView({ type: 'overlay.set', overlay: null });
    setPlaying(false);
    setPlayhead(0);
  }, [setPlayhead, setPlaying]);

  return {
    ...view,
    selectedNodeId,
    activeClipId,
    activeClip,
    viewportStats,
    playhead,
    playing,
    setPlayhead,
    setPlaying,
    setViewportStats,
    selectNode,
    setEnvironment,
    setActiveOverlay,
    setBottomMode,
    closePanels,
    setCamera,
    toggleViewportOption,
    changeActiveClip,
    togglePlayback,
    prepareAgentView,
    resetProjectView
  };
};
