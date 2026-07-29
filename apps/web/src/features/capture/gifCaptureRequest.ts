import type { BuildGifExportOptions } from './createBuildGif';
import type { AnimatedGifExportOptions } from './createAnimatedGif';

export type GifCaptureRequest =
  | ({ kind: 'build' } & BuildGifExportOptions)
  | ({ kind: 'animation' } & AnimatedGifExportOptions);
