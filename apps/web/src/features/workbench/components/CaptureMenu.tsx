import { useMemo, useState } from 'react';

import type {
  CommandReceipt,
  ProjectDocument
} from '@ashfox/engine-core';

import {
  createBuildCapturePlan
} from '../../capture/buildCaptureTimeline';
import type { GifCaptureFile } from '../../capture/gifCaptureFile';
import type { GifCaptureRequest } from '../../capture/gifCaptureRequest';
import {
  createGifFramePlan,
  GIF_CAPTURE_FPS
} from '../../capture/gifFramePlan';
import type { ArtifactFile } from '../../files/artifactFile';
import type { FileOperationState } from '../../files/fileOperationState';
import type { CameraMode } from '../../../rendering/cameraPresets';
import type { ViewportEnvironmentId } from '../../../rendering/viewportEnvironment';

type CaptureMode = 'build' | 'animation';

interface CaptureMenuProps {
  document: ProjectDocument;
  buildDocuments: readonly ProjectDocument[];
  activity: readonly CommandReceipt[];
  activeClipId: string | null;
  environment: ViewportEnvironmentId;
  cameraMode: CameraMode;
  operation: FileOperationState<ArtifactFile>;
  captureFile: GifCaptureFile | null;
  onActiveClipChange: (clipId: string | null) => void;
  onCapture: (request: GifCaptureRequest) => void;
  onCancel: () => void;
  onDownload: () => void;
  canDownload: boolean;
}

interface CapturePlanSummary {
  frames: number;
  events: number;
  error: string | null;
}

const animationPlanSummary = (
  document: ProjectDocument,
  clipId: string | null
): CapturePlanSummary => {
  const clip = clipId ? document.animations[clipId] : undefined;
  if (!clip) {
    return {
      frames: 0,
      events: 0,
      error: 'Add or select an animation clip first.'
    };
  }
  try {
    const plan = createGifFramePlan(clip);
    return {
      frames: plan.frames.length,
      events: plan.eventCount,
      error: null
    };
  } catch (error: unknown) {
    return {
      frames: 0,
      events: 0,
      error:
        error instanceof Error
          ? error.message
          : 'Animation capture is unavailable.'
    };
  }
};

const buildPlanSummary = (
  documents: readonly ProjectDocument[],
  activity: readonly CommandReceipt[]
): CapturePlanSummary => {
  try {
    const plan = createBuildCapturePlan(documents, activity);
    return {
      frames: plan.frames.length,
      events: plan.events.length,
      error: null
    };
  } catch (error: unknown) {
    return {
      frames: 0,
      events: 0,
      error:
        error instanceof Error
          ? error.message
          : 'Build process capture is unavailable.'
    };
  }
};

export function CaptureMenu({
  document,
  buildDocuments,
  activity,
  activeClipId,
  environment,
  cameraMode,
  operation,
  captureFile,
  onActiveClipChange,
  onCapture,
  onCancel,
  onDownload,
  canDownload
}: CaptureMenuProps) {
  const [mode, setMode] = useState<CaptureMode>('build');
  const readyFile = captureFile?.kind === mode ? captureFile : null;
  const buildPlan = useMemo(
    () => buildPlanSummary(buildDocuments, activity),
    [activity, buildDocuments]
  );
  const animationPlan = useMemo(
    () => animationPlanSummary(document, activeClipId),
    [activeClipId, document]
  );
  const plan = mode === 'build' ? buildPlan : animationPlan;
  const capturing =
    operation.phase === 'running' && operation.kind === 'capture';
  const captureMessage =
    operation.kind === 'capture' && operation.phase !== 'succeeded'
      ? operation.message
      : null;
  const captureFailed =
    operation.kind === 'capture' && operation.phase === 'failed';
  const defaultMessage =
    mode === 'build'
      ? 'Committed revisions are grouped into semantic build events.'
      : 'Sound, particle, and timeline events appear on their sampled frame.';
  const readyMessage = readyFile
    ? `Ready · ${readyFile.frameCount} frames${
        readyFile.eventCount > 0
          ? ` · ${readyFile.eventCount} ${
              readyFile.kind === 'build' ? 'build events' : 'events'
            }`
          : ''
      }`
    : null;

  const startCapture = (): void => {
    if (plan.error) return;
    if (mode === 'build') {
      onCapture({
        kind: 'build',
        documents: buildDocuments,
        receipts: activity,
        environment,
        cameraMode
      });
      return;
    }
    if (!activeClipId) return;
    onCapture({
      kind: 'animation',
      clipId: activeClipId,
      environment,
      cameraMode
    });
  };

  return (
    <section
      className="header-popover capture-menu"
      aria-label="Capture GIF"
    >
      <div className="popover-heading">
        <strong>Capture GIF</strong>
        <span>{GIF_CAPTURE_FPS} fps · 640 × 360 · browser local</span>
      </div>

      <div
        className="capture-mode-switch"
        role="tablist"
        aria-label="Capture mode"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'build'}
          className={mode === 'build' ? 'is-active' : ''}
          disabled={capturing}
          onClick={() => setMode('build')}
        >
          Build process
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'animation'}
          className={mode === 'animation' ? 'is-active' : ''}
          disabled={capturing}
          onClick={() => setMode('animation')}
        >
          Animation
        </button>
      </div>

      {mode === 'animation' ? (
        <label className="popover-field">
          <span>Animation</span>
          <select
            aria-label="Capture animation"
            value={activeClipId ?? ''}
            disabled={capturing}
            onChange={(event) =>
              onActiveClipChange(event.target.value || null)}
          >
            {Object.values(document.animations).length === 0 ? (
              <option value="">No animation clips</option>
            ) : null}
            {Object.values(document.animations).map((clip) => (
              <option key={clip.id} value={clip.id}>
                {clip.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="capture-summary">
        <span>{plan.frames} frames</span>
        <span>
          {plan.events} {mode === 'build' ? 'build events' : 'timed events'}
        </span>
        <span>{cameraMode} camera</span>
      </div>
      <p
        className={`capture-status${
          plan.error || captureFailed ? ' is-error' : ''
        }`}
      >
        {capturing
          ? operation.message
          : plan.error ?? captureMessage ?? readyMessage ?? defaultMessage}
      </p>

      {capturing ? (
        <button
          type="button"
          className="popover-secondary"
          data-ashfox-action="project.capture.cancel"
          onClick={onCancel}
        >
          Cancel capture
        </button>
      ) : readyFile ? (
        <div className="capture-ready-actions">
          <button
            type="button"
            className="popover-primary capture-download-link"
            onClick={onDownload}
            disabled={!canDownload}
          >
            Download GIF
          </button>
          <button
            type="button"
            className="popover-secondary"
            data-ashfox-action="project.capture.start"
            disabled={
              plan.error !== null ||
              (mode === 'animation' && activeClipId === null)
            }
            onClick={startCapture}
          >
            Capture again
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="popover-primary"
          data-ashfox-action="project.capture.start"
          disabled={
            plan.error !== null ||
            (mode === 'animation' && activeClipId === null)
          }
          onClick={startCapture}
        >
          Capture {mode === 'build' ? 'build process' : 'animation'}
        </button>
      )}
    </section>
  );
}
