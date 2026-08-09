import type { BuildGifExportOptions } from './createBuildGif';
import type { AnimatedGifExportOptions } from './createAnimatedGif';

export type GifCaptureRequest =
  | ({ readonly kind: 'build' } & BuildGifExportOptions)
  | ({ readonly kind: 'animation' } & AnimatedGifExportOptions);
