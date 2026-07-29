export const PROJECT_TEXTURE_RESOLUTIONS = [
  16,
  32,
  64,
  128,
  256
] as const;

export type ProjectTextureResolution =
  (typeof PROJECT_TEXTURE_RESOLUTIONS)[number];
