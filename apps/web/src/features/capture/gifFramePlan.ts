import type {
  AnimationClip,
  AnimationEffectValue,
  AnimationTriggerTrack
} from '@ashfox/engine-core';

export const GIF_CAPTURE_FPS = 10;
export const MAX_GIF_CAPTURE_FRAMES = 300;

export interface GifFrameEvent {
  trackId: string;
  type: AnimationTriggerTrack['type'];
  label: string;
  timeSeconds: number;
}

export interface GifFrame {
  index: number;
  timeSeconds: number;
  events: readonly GifFrameEvent[];
}

export interface GifFramePlan {
  fps: number;
  durationSeconds: number;
  frames: readonly GifFrame[];
  eventCount: number;
}

const effectLabels = (value: AnimationEffectValue): readonly string[] =>
  (Array.isArray(value) ? value : [value]).map((entry) => entry.effect);

const triggerLabels = (
  trigger: AnimationTriggerTrack,
  value: AnimationTriggerTrack['keys'][number]['value']
): readonly string[] => {
  if (trigger.type === 'timeline') {
    return Array.isArray(value) ? value : [value as string];
  }
  return effectLabels(value as AnimationEffectValue);
};

const collectEvents = (
  clip: AnimationClip,
  frameCount: number,
  fps: number
): Map<number, GifFrameEvent[]> => {
  const events = new Map<number, GifFrameEvent[]>();
  for (const trigger of Object.values(clip.triggers)) {
    for (const key of trigger.keys) {
      const frameIndex = Math.min(
        frameCount - 1,
        Math.max(0, Math.round(key.timeSeconds * fps))
      );
      const frameEvents = events.get(frameIndex) ?? [];
      for (const label of triggerLabels(trigger, key.value)) {
        frameEvents.push({
          trackId: trigger.id,
          type: trigger.type,
          label,
          timeSeconds: key.timeSeconds
        });
      }
      events.set(frameIndex, frameEvents);
    }
  }
  return events;
};

export const createGifFramePlan = (
  clip: AnimationClip,
  fps = GIF_CAPTURE_FPS
): GifFramePlan => {
  if (!Number.isInteger(fps) || fps <= 0) {
    throw new Error('GIF capture FPS must be a positive integer.');
  }
  const frameCount = Math.max(1, Math.ceil(clip.durationSeconds * fps));
  if (frameCount > MAX_GIF_CAPTURE_FRAMES) {
    throw new Error(
      `GIF capture supports at most ${MAX_GIF_CAPTURE_FRAMES} frames.`
    );
  }
  const eventsByFrame = collectEvents(clip, frameCount, fps);
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    index,
    timeSeconds: Math.min(index / fps, clip.durationSeconds),
    events: eventsByFrame.get(index) ?? []
  }));
  return {
    fps,
    durationSeconds: clip.durationSeconds,
    frames,
    eventCount: frames.reduce(
      (total, frame) => total + frame.events.length,
      0
    )
  };
};
