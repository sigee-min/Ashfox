export type UvAtlasMessages = {
  readonly resolutionPositive: string;
  readonly maxResolutionPositive: string;
  readonly exceedsMax: string;
  readonly cubeMissing: (name: string) => string;
  readonly deriveSizeFailed: (cube: string, face: string) => string;
  readonly uvSizeExceeds: (cube: string, face: string) => string;
  readonly overflow: string;
};
