import type { GifFrameEvent } from './gifFramePlan';
import {
  GIF_CAPTURE_HEIGHT,
  GIF_CAPTURE_WIDTH
} from './gifCaptureSurface';

const roundedRect = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void => {
  const right = x + width;
  const bottom = y + height;
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(right - radius, y);
  context.quadraticCurveTo(right, y, right, y + radius);
  context.lineTo(right, bottom - radius);
  context.quadraticCurveTo(right, bottom, right - radius, bottom);
  context.lineTo(x + radius, bottom);
  context.quadraticCurveTo(x, bottom, x, bottom - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
};

const fillPanel = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void => {
  context.fillStyle = 'rgba(10, 14, 18, 0.78)';
  roundedRect(context, x, y, width, height, 7);
  context.fill();
};

const eventText = (event: GifFrameEvent): string =>
  `${event.type.toUpperCase()} · ${event.label}`;

export const drawAnimationFrameOverlay = (
  context: CanvasRenderingContext2D,
  clipName: string,
  timeSeconds: number,
  events: readonly GifFrameEvent[]
): void => {
  context.save();
  context.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
  fillPanel(context, 14, 14, 210, 30);
  context.fillStyle = '#f1e7d2';
  context.fillText(
    `${clipName.slice(0, 22)} · ${timeSeconds.toFixed(1)}s`,
    25,
    34
  );

  let y = GIF_CAPTURE_HEIGHT - 18;
  for (const event of [...events].reverse()) {
    const text = eventText(event).slice(0, 64);
    const width = Math.min(
      GIF_CAPTURE_WIDTH - 28,
      context.measureText(text).width + 24
    );
    y -= 34;
    fillPanel(context, 14, y, width, 28);
    context.fillStyle = '#f0b65d';
    context.fillText(text, 26, y + 19);
  }
  context.restore();
};
