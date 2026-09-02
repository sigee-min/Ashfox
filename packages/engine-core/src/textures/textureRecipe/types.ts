import type { TextureAlphaMask, TextureCanvasDetail } from '../../model';

/** Deterministic composition of one source-owned explicit raster. */
export interface TextureComposition {
  background: string;
  backgroundAlpha: 0 | 255;
  canvasDetails: readonly TextureCanvasDetail[];
  alphaMasks: readonly TextureAlphaMask[];
}
