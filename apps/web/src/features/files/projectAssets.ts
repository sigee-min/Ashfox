export interface ProjectAsset {
  contentType: string;
  bytes: Uint8Array;
}

export type ProjectAssets = Readonly<Record<string, ProjectAsset>>;

export const isProjectAssets = (
  value: unknown
): value is ProjectAssets => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (asset) =>
      typeof asset === 'object' &&
      asset !== null &&
      'contentType' in asset &&
      typeof asset.contentType === 'string' &&
      asset.contentType.length > 0 &&
      'bytes' in asset &&
      asset.bytes instanceof Uint8Array
  );
};

export const areProjectAssetsEqual = (
  left: ProjectAssets,
  right: ProjectAssets
): boolean => {
  const leftIds = Object.keys(left).sort((a, b) => a.localeCompare(b));
  const rightIds = Object.keys(right).sort((a, b) => a.localeCompare(b));
  if (
    leftIds.length !== rightIds.length ||
    leftIds.some((id, index) => id !== rightIds[index])
  ) {
    return false;
  }
  return leftIds.every((id) => {
    const leftAsset = left[id];
    const rightAsset = right[id];
    if (
      leftAsset.contentType !== rightAsset.contentType ||
      leftAsset.bytes.length !== rightAsset.bytes.length
    ) {
      return false;
    }
    return leftAsset.bytes.every(
      (byte, index) => byte === rightAsset.bytes[index]
    );
  });
};
