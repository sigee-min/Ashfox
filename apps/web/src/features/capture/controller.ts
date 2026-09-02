'use client';

import {
  useCallback,
  useMemo
} from 'react';

import type { GifCaptureRequest } from './gifCaptureRequest';
import {
  captureRequestPort,
  presentCaptureMenu,
  type CaptureMenuAuthority,
  type CaptureMenuViewModel
} from './menu';

export interface CaptureMenuControllerInput extends CaptureMenuAuthority {
  readonly onCapture: (request: GifCaptureRequest) => void;
  readonly onCancel: () => void;
  readonly onDownload: () => void;
}

export interface CaptureMenuController {
  readonly view: CaptureMenuViewModel;
  readonly start: () => void;
  readonly cancel: () => void;
  readonly download: () => void;
}

export const useCaptureMenuController = (
  input: CaptureMenuControllerInput
): CaptureMenuController => {
  const authority = useMemo<CaptureMenuAuthority>(() => Object.freeze({
    document: input.document,
    environment: input.environment,
    cameraMode: input.cameraMode,
    operation: input.operation,
    captureFile: input.captureFile,
    canDownload: input.canDownload,
    blockedReason: input.blockedReason
  }), [
    input.cameraMode,
    input.canDownload,
    input.blockedReason,
    input.captureFile,
    input.document,
    input.environment,
    input.operation
  ]);
  const view = useMemo(
    () => presentCaptureMenu(authority),
    [authority]
  );
  const start = useCallback((): void => {
    if (!view.startDisabled) {
      input.onCapture(captureRequestPort.create(authority));
    }
  }, [authority, input.onCapture, view.startDisabled]);

  return useMemo(() => Object.freeze({
    view,
    start,
    cancel: input.onCancel,
    download: input.onDownload
  }), [input.onCancel, input.onDownload, start, view]);
};
