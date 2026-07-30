import type { MassProfile } from './types';

const PROFILE_EXPONENTS: Readonly<Record<MassProfile, 2 | 4 | 8>> = {
  soft: 2,
  balanced: 4,
  hard: 8
};

export const profileExponent = (profile: MassProfile): 2 | 4 | 8 => {
  const exponent = PROFILE_EXPONENTS[profile];
  if (exponent === undefined) {
    throw new TypeError(`unsupported mass profile: ${String(profile)}`);
  }
  return exponent;
};

export const superellipsoidScore = (
  delta: Readonly<{ x: number; y: number; z: number }>,
  radii: Readonly<{ x: number; y: number; z: number }>,
  exponent: 2 | 4 | 8
): number =>
  Math.pow(Math.abs(delta.x / radii.x), exponent) +
  Math.pow(Math.abs(delta.y / radii.y), exponent) +
  Math.pow(Math.abs(delta.z / radii.z), exponent);
