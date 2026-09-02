import type { BuildGifExportOptions } from './createBuildGif';

export type GifCaptureRequest =
  { readonly kind: 'build' } & BuildGifExportOptions;
