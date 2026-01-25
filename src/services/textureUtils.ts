import { CUBE_FACE_DIRECTIONS } from '../shared/toolConstants';
import { hashTextToHex } from '../shared/hash';
import type { CubeFaceDirection, TextureUsageResult } from '../ports/editor';
import type { SessionState } from '../session';
import type { PreflightUsageSummary, PreflightUvBounds } from '../types';

export const hashCanvasImage = (image: CanvasImageSource | undefined): string | null => {
  if (!image) return null;
  const candidate = image as { toDataURL?: (type?: string) => string };
  if (typeof candidate.toDataURL !== 'function') return null;
  return hashTextToHex(candidate.toDataURL('image/png'));
};

export const parseDataUriMimeType = (dataUri: string): string | null => {
  const match = /^data:([^;]+);base64,/i.exec(String(dataUri ?? ''));
  return match?.[1] ?? null;
};

export const normalizeTextureDataUri = (value?: string): string | null => {
  if (!value) return null;
  return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
};

export const resolveTextureSize = (
  primary: { width?: number; height?: number },
  ...fallbacks: Array<{ width?: number; height?: number } | undefined>
): { width?: number; height?: number } => {
  const pick = (value?: number): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
  const candidates = [primary, ...fallbacks].filter(Boolean) as Array<{ width?: number; height?: number }>;
  let width: number | undefined;
  let height: number | undefined;
  candidates.forEach((entry) => {
    if (width === undefined) width = pick(entry.width);
    if (height === undefined) height = pick(entry.height);
  });
  return { width, height };
};

const VALID_CUBE_FACES: ReadonlySet<CubeFaceDirection> = new Set(CUBE_FACE_DIRECTIONS);

export const normalizeCubeFaces = (faces?: CubeFaceDirection[]): CubeFaceDirection[] | null => {
  if (!faces || faces.length === 0) return null;
  const normalized: CubeFaceDirection[] = [];
  for (const face of faces) {
    if (!VALID_CUBE_FACES.has(face)) {
      return null;
    }
    if (!normalized.includes(face)) {
      normalized.push(face);
    }
  }
  return normalized.length > 0 ? normalized : null;
};

export const resolveCubeTargets = (cubes: SessionState['cubes'], cubeIds?: string[], cubeNames?: string[]) => {
  const ids = new Set(cubeIds ?? []);
  const names = new Set(cubeNames ?? []);
  if (ids.size === 0 && names.size === 0) {
    return [...cubes];
  }
  return cubes.filter((cube) => (cube.id && ids.has(cube.id)) || names.has(cube.name));
};

export const summarizeTextureUsage = (usage: TextureUsageResult): PreflightUsageSummary => {
  let cubeCount = 0;
  let faceCount = 0;
  usage.textures.forEach((entry) => {
    cubeCount += entry.cubeCount;
    faceCount += entry.faceCount;
  });
  return {
    textureCount: usage.textures.length,
    cubeCount,
    faceCount,
    unresolvedCount: usage.unresolved?.length ?? 0
  };
};

export const computeUvBounds = (usage: TextureUsageResult): PreflightUvBounds | null => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let faceCount = 0;
  usage.textures.forEach((entry) => {
    entry.cubes.forEach((cube) => {
      cube.faces.forEach((face) => {
        if (!face.uv) return;
        const [x1, y1, x2, y2] = face.uv;
        const localMinX = Math.min(x1, x2);
        const localMinY = Math.min(y1, y2);
        const localMaxX = Math.max(x1, x2);
        const localMaxY = Math.max(y1, y2);
        if (localMinX < minX) minX = localMinX;
        if (localMinY < minY) minY = localMinY;
        if (localMaxX > maxX) maxX = localMaxX;
        if (localMaxY > maxY) maxY = localMaxY;
        faceCount += 1;
      });
    });
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY),
    faceCount
  };
};

export const recommendResolution = (
  bounds: PreflightUvBounds | null,
  current: { width: number; height: number } | undefined,
  maxSize: number
): { width: number; height: number; reason: string } | null => {
  if (!bounds) return null;
  const requiredWidth = Math.max(bounds.maxX, current?.width ?? 0);
  const requiredHeight = Math.max(bounds.maxY, current?.height ?? 0);
  const width = clampResolution(roundUpResolution(requiredWidth), maxSize);
  const height = clampResolution(roundUpResolution(requiredHeight), maxSize);
  if (current && width <= current.width && height <= current.height) return null;
  const reason = current ? 'uv_bounds_exceed_resolution' : 'resolution_missing';
  return { width, height, reason };
};

const roundUpResolution = (value: number): number => {
  if (!Number.isFinite(value) || value <= 0) return 16;
  if (value <= 16) return 16;
  return Math.ceil(value / 32) * 32;
};

const clampResolution = (value: number, maxSize: number): number => {
  if (value <= 0) return 16;
  if (value > maxSize) return maxSize;
  return value;
};
