export type TextureRenderMode = 'default' | 'emissive' | 'additive' | 'layered' | string;

export type TextureRenderSides = 'auto' | 'front' | 'double' | string;

export const TEXTURE_PBR_CHANNELS = [
  'color',
  'normal',
  'height',
  'mer'
] as const;
export type TexturePbrChannel = typeof TEXTURE_PBR_CHANNELS[number];

export const TEXTURE_FRAME_ORDER_TYPES = [
  'custom',
  'loop',
  'backwards',
  'back_and_forth'
] as const;
export type TextureFrameOrderType =
  typeof TEXTURE_FRAME_ORDER_TYPES[number];

export type TextureMeta = {
  namespace?: string;
  folder?: string;
  particle?: boolean;
  visible?: boolean;
  renderMode?: TextureRenderMode;
  renderSides?: TextureRenderSides;
  pbrChannel?: TexturePbrChannel;
  group?: string;
  frameTime?: number;
  frameOrderType?: TextureFrameOrderType;
  frameOrder?: string;
  frameInterpolate?: boolean;
  internal?: boolean;
  keepSize?: boolean;
};
