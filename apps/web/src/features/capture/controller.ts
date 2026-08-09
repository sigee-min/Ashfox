'use client';

import {
  useCallback,
  useMemo,
  useState
} from 'react';

import type { GifCaptureRequest } from './gifCaptureRequest';
import {
  captureRequestPort,
  presentCaptureMenu,
  type CaptureMenuAuthority,
  type CaptureMenuMode,
  type CaptureMenuViewModel
} from './menu';

export interface CaptureMenuControllerInput extends CaptureMenuAuthority {
  readonly onActiveClipChange: (clipId: string | null) => void;
  readonly onCapture: (request: GifCaptureRequest) => void;
  readonly onCancel: () => void;
  readonly onDownload: () => void;
}

export interface CaptureMenuController {
  readonly view: CaptureMenuViewModel;
  readonly selectMode: (mode: CaptureMenuMode) => void;
  readonly selectClip: (clipId: string | null) => void;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly download: () => void;
}

export const useCaptureMenuController = (
  input: CaptureMenuControllerInput
): CaptureMenuController => {
  const [mode, setMode] = useState<CaptureMenuMode>('build');
  const authority = useMemo<CaptureMenuAuthority>(() => Object.freeze({
    document: input.document,
    buildDocuments: input.buildDocuments,
    activity: input.activity,
    activeClipId: input.activeClipId,
    environment: input.environment,
    cameraMode: input.cameraMode,
    operation: input.operation,
    captureFile: input.captureFile,
    canDownload: input.canDownload
  }), [
    input.activeClipId,
    input.activity,
    input.buildDocuments,
    input.cameraMode,
    input.canDownload,
    input.captureFile,
    input.document,
    input.environment,
    input.operation
  ]);
  const view = useMemo(
    () => presentCaptureMenu(authority, mode),
    [authority, mode]
  );
  const start = useCallback((): void => {
    if (view.startDisabled) return;
    const request = captureRequestPort.create(authority, mode);
    if (request) input.onCapture(request);
  }, [authority, input.onCapture, mode, view.startDisabled]);

  return useMemo(() => Object.freeze({
    view,
    selectMode: setMode,
    selectClip: input.onActiveClipChange,
    start,
    cancel: input.onCancel,
    download: input.onDownload
  }), [
    input.onActiveClipChange,
    input.onCancel,
    input.onDownload,
    start,
    view
  ]);
};
