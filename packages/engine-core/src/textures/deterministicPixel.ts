export const deterministicPixelNoise = (
  x: number,
  y: number,
  seed: number
): number => {
  let hash = (
    seed ^
    Math.imul(Math.trunc(x), 0x9e3779b1) ^
    Math.imul(Math.trunc(y), 0x85ebca6b)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  hash = (hash ^ (hash >>> 16)) >>> 0;
  return hash / 0xffffffff;
};

export const stableTextureSeed = (
  value: string,
  seed: number
): number => {
  let hash = (2166136261 ^ Math.trunc(seed)) >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash;
};
