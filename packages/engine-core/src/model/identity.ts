import { INTERNAL_CONTRACT_VERSIONS } from '@ashfox/internal-contracts';

export const PROJECT_DOCUMENT_SCHEMA_VERSION =
  INTERNAL_CONTRACT_VERSIONS.projectDocument;

// Delivery-target compatibility version for exported ashfox.generic assets.
// It is intentionally independent from internal persistence contracts.
export const ASHFOX_GENERIC_FORMAT_VERSION = '1' as const;

export type ProjectId = string;
export type EntityId = string;
export type AssetId = string;
export type ClipId = string;
export type ChannelId = string;
export type KeyframeId = string;
export type Revision = string;
export type Vec2 = readonly [number, number];
export type Vec3 = readonly [number, number, number];
export type UvRect = readonly [number, number, number, number];

export const SURFACE_PIXEL_DENSITIES = [1, 2, 4] as const;
export type SurfacePixelDensity =
  (typeof SURFACE_PIXEL_DENSITIES)[number];

export const isSurfacePixelDensity = (
  value: unknown
): value is SurfacePixelDensity =>
  typeof value === 'number' &&
  SURFACE_PIXEL_DENSITIES.includes(value as SurfacePixelDensity);

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface ProjectSettings {
  textureResolution: {
    width: number;
    height: number;
  };
  surfacePixelDensity: SurfacePixelDensity;
  coordinateSystem: {
    up: 'y';
    handedness: 'right';
    unit: 'pixel' | 'block' | 'meter';
    rotationUnit: 'degree';
    rotationOrder: 'xyz';
  };
}
