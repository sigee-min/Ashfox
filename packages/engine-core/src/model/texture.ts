import type { AssetId, EntityId } from './identity';

export interface BlobRef {
  bucket: string;
  key: string;
  contentType: string;
  contentHash: string;
  byteLength?: number;
}

export interface TextureCanvasDetail {
  id: EntityId;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextureRaster {
  background: string;
  canvasDetails: readonly TextureCanvasDetail[];
}

export interface TextureAsset {
  id: AssetId;
  name: string;
  width: number;
  height: number;
  source: BlobRef;
  visible: boolean;
  sampling: 'nearest' | 'linear';
  colorSpace: 'srgb' | 'linear';
  renderMode: 'default' | 'emissive' | 'additive' | 'layered';
  renderSides: 'auto' | 'front' | 'double';
  atlasMode?: 'generate' | 'preserve';
  pbrChannel?: 'color' | 'normal' | 'height' | 'mer';
  raster?: TextureRaster;
  metadata?: Readonly<Record<string, string | number | boolean>>;
}
