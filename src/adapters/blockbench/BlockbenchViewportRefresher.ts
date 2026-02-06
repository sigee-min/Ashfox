import { errorMessage, type Logger } from '../../logging';
import type { ViewportRefresherPort, ViewportRefreshRequest } from '../../ports/viewportRefresher';
import type { AnimationClip, BlockbenchCanvasApi, CanvasUpdateViewOptions, PreviewItem } from '../../types/blockbench';
import { readGlobals } from './blockbenchUtils';

export class BlockbenchViewportRefresher implements ViewportRefresherPort {
  private readonly log: Logger;

  constructor(log: Logger) {
    this.log = log;
  }

  refresh(request: ViewportRefreshRequest): void {
    try {
      const globals = readGlobals();
      if (request.effect === 'animation') {
        this.reevaluateAnimation(globals);
      }
      const invalidated = invalidateCanvas(globals.Canvas, request.effect);
      const rendered = renderViewportPreviews(globals);
      if (!invalidated && rendered === 0) {
        globals.Blockbench?.dispatchEvent?.('bbmcp:viewport_changed', request);
      }
    } catch (err) {
      this.log.warn('viewport refresh failed', {
        source: request.source,
        effect: request.effect,
        message: errorMessage(err, 'viewport refresh failed')
      });
    }
  }

  private reevaluateAnimation(globals: ReturnType<typeof readGlobals>): void {
    const clip = globals.Animation?.selected as AnimationClip | undefined;
    if (!clip) return;
    const currentTime = readAnimationTime(clip, globals.Animator?.time);
    if (!Number.isFinite(currentTime)) return;
    if (typeof clip.select === 'function') {
      clip.select();
    } else if (globals.Animation?.selected) {
      globals.Animation.selected = clip;
    }
    if (typeof clip.setTime === 'function') {
      clip.setTime(currentTime);
      return;
    }
    if (typeof globals.Animator?.setTime === 'function') {
      globals.Animator.setTime(currentTime);
      return;
    }
    if (typeof globals.Animator?.preview === 'function') {
      globals.Animator.preview(currentTime);
      return;
    }
    if (typeof clip.time === 'number') {
      clip.time = currentTime;
    }
  }
}

const readAnimationTime = (clip: AnimationClip, animatorTime: unknown): number => {
  const clipTime = Number(clip.time);
  if (Number.isFinite(clipTime)) return clipTime;
  const fallback = Number(animatorTime);
  return Number.isFinite(fallback) ? fallback : NaN;
};

const renderViewportPreviews = (globals: ReturnType<typeof readGlobals>): number => {
  const registry = globals.Preview;
  const selected = registry?.selected;
  const all = registry?.all ?? [];
  const candidates = [selected, ...all].filter((entry): entry is PreviewItem => Boolean(entry));
  const rendered = new Set<PreviewItem>();
  for (const preview of candidates) {
    if (rendered.has(preview)) continue;
    if (typeof preview.render !== 'function') continue;
    preview.render();
    rendered.add(preview);
  }
  return rendered.size;
};

const invalidateCanvas = (
  canvas: BlockbenchCanvasApi | undefined,
  effect: ViewportRefreshRequest['effect']
): boolean => {
  if (!canvas) return false;
  const updateViewOptions = resolveUpdateViewOptions(effect);
  const usedUpdateView = updateViewOptions ? runCanvasCall(canvas.updateView, updateViewOptions) : false;
  if (usedUpdateView) return true;
  switch (effect) {
    case 'geometry': {
      const changed =
        runCanvasCall(canvas.updateAllPositions) ||
        runCanvasCall(canvas.updateAllBones) ||
        runCanvasCall(canvas.updateAllUVs) ||
        runCanvasCall(canvas.updateAllFaces) ||
        runCanvasCall(canvas.updateVisibility);
      return changed || runCanvasCall(canvas.updateAll);
    }
    case 'texture': {
      const changed =
        runCanvasCall(canvas.updateAllUVs) ||
        runCanvasCall(canvas.updateAllFaces) ||
        runCanvasCall(canvas.updateLayeredTextures) ||
        runCanvasCall(canvas.updateSelectedFaces);
      return changed || runCanvasCall(canvas.updateAll);
    }
    case 'animation': {
      const changed =
        runCanvasCall(canvas.updateAllBones) ||
        runCanvasCall(canvas.updateAllPositions) ||
        runCanvasCall(canvas.updateAllFaces);
      return changed || runCanvasCall(canvas.updateAll);
    }
    case 'project':
      return runCanvasCall(canvas.updateAll);
    case 'none':
    default:
      return false;
  }
};

const resolveUpdateViewOptions = (effect: ViewportRefreshRequest['effect']): CanvasUpdateViewOptions | null => {
  switch (effect) {
    case 'geometry':
      return {
        element_aspects: { geometry: true, transform: true, faces: true, uv: true, visibility: true },
        group_aspects: { transform: true, visibility: true },
        selection: true
      };
    case 'texture':
      return {
        element_aspects: { faces: true, uv: true, painting_grid: true },
        selection: true
      };
    case 'animation':
      return {
        element_aspects: { transform: true, faces: true, geometry: true, visibility: true },
        group_aspects: { transform: true, visibility: true },
        selection: true
      };
    case 'project':
      return {
        element_aspects: { faces: true, geometry: true, painting_grid: true, transform: true, uv: true, visibility: true },
        group_aspects: { transform: true, visibility: true },
        selection: true
      };
    case 'none':
    default:
      return null;
  }
};

const runCanvasCall = <TArgs extends unknown[]>(fn: ((...args: TArgs) => void) | undefined, ...args: TArgs): boolean => {
  if (typeof fn !== 'function') return false;
  fn(...args);
  return true;
};
