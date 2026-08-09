/** Deterministic object-space signals and exact role budgets. */
import { stableTextureSeed } from '../deterministicPixel';
import type { SurfacePatternComponent } from './components';
import type {
  SurfaceAppearanceV1,
  SurfaceDecorationProfile,
  SurfaceTextureDensity,
  SurfaceTextureScale
} from './contract';

const GENERATED_SURFACE_SEED = 0x41534846;
const FIELD_UNIT = 1024;

export interface AppearanceToneSample {
  readonly key: string;
  readonly u: number;
  readonly v: number;
  readonly score: number;
}

export interface AppearanceRoleBudget {
  readonly shadow: number;
  readonly light: number;
}

interface FixedProjectPosition {
  readonly lateral: number;
  readonly up: number;
  readonly forward: number;
}

const PROFILE_SHADOW_SHARE: Readonly<
  Record<SurfaceDecorationProfile, number>
> = {
  body: 0.56,
  articulated: 0.68,
  support: 0.74,
  rotary: 0.64,
  focal: 0.5,
  accent: 0.35,
  wing: 0.56,
  fin: 0.6,
  sail: 0.56,
  panel: 0.5
};

const DENSITY_VARIATION_SHARE: Readonly<
  Record<SurfaceTextureDensity, number>
> = {
  sparse: 0.12,
  balanced: 0.18,
  rich: 0.26
};

const SCALE_FREQUENCY: Readonly<Record<SurfaceTextureScale, number>> = {
  fine: 5,
  medium: 3,
  broad: 2
};

export const appearanceSampleKey = (u: number, v: number): string =>
  `${u},${v}`;

const hash3 = (x: number, y: number, z: number, seed: number): number => {
  let hash = (
    seed ^
    Math.imul(x, 0x9e3779b1) ^
    Math.imul(y, 0x85ebca6b) ^
    Math.imul(z, 0xc2b2ae35)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

const noiseAt = (x: number, y: number, z: number, seed: number): number =>
  hash3(x, y, z, seed) >>> 22;

const smoothFixed = (value: number): number => Math.floor(
  value * value * (3 * FIELD_UNIT - 2 * value) /
  (FIELD_UNIT * FIELD_UNIT)
);

const mixFixed = (left: number, right: number, ratio: number): number =>
  Math.floor((left * (FIELD_UNIT - ratio) + right * ratio) / FIELD_UNIT);

const coherentNoise = (
  position: FixedProjectPosition,
  seed: number,
  frequency: number
): number => {
  const scaled = [
    position.lateral * frequency,
    position.up * frequency,
    position.forward * frequency
  ] as const;
  const cell = scaled.map((value) => Math.floor(value / FIELD_UNIT));
  const fraction = scaled.map((value, index) =>
    smoothFixed(value - (cell[index] ?? 0) * FIELD_UNIT)
  );
  const plane = (zOffset: number): number => {
    const first = mixFixed(
      noiseAt(cell[0] ?? 0, cell[1] ?? 0, (cell[2] ?? 0) + zOffset, seed),
      noiseAt((cell[0] ?? 0) + 1, cell[1] ?? 0, (cell[2] ?? 0) + zOffset, seed),
      fraction[0] ?? 0
    );
    const second = mixFixed(
      noiseAt(cell[0] ?? 0, (cell[1] ?? 0) + 1, (cell[2] ?? 0) + zOffset, seed),
      noiseAt((cell[0] ?? 0) + 1, (cell[1] ?? 0) + 1, (cell[2] ?? 0) + zOffset, seed),
      fraction[0] ?? 0
    );
    return mixFixed(first, second, fraction[1] ?? 0);
  };
  return mixFixed(plane(0), plane(1), fraction[2] ?? 0);
};

const worldPointTwice = (
  appearance: SurfaceAppearanceV1,
  u: number,
  v: number
): readonly [number, number, number] => {
  const plane = appearance.plane * 2;
  switch (appearance.faceDirection) {
    case 'north': return [-2 * u + 1, -2 * v + 1, plane];
    case 'south': return [2 * u + 1, -2 * v + 1, plane];
    case 'east': return [plane, -2 * v + 1, -2 * u + 1];
    case 'west': return [plane, -2 * v + 1, 2 * u + 1];
    case 'up': return [2 * u + 1, plane, 2 * v + 1];
    case 'down': return [2 * u + 1, plane, -2 * v + 1];
  }
};

const dot = (
  left: readonly [number, number, number],
  right: readonly [number, number, number]
): number => left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const normalizedAlong = (
  valueTwice: number,
  range: { readonly minimum: number; readonly maximum: number }
): number => {
  const minimumTwice = range.minimum * 2;
  const spanTwice = (range.maximum - range.minimum) * 2;
  if (spanTwice <= 0) return FIELD_UNIT / 2;
  return Math.min(FIELD_UNIT, Math.max(0, Math.floor(
    ((valueTwice - minimumTwice) * FIELD_UNIT + spanTwice / 2) / spanTwice
  )));
};

const projectPosition = (
  appearance: SurfaceAppearanceV1,
  pointTwice: readonly [number, number, number]
): FixedProjectPosition => ({
  lateral: normalizedAlong(
    dot(pointTwice, appearance.frame.left),
    appearance.frame.lateralRange
  ),
  up: normalizedAlong(
    dot(pointTwice, appearance.frame.up),
    appearance.frame.upRange
  ),
  forward: normalizedAlong(
    dot(pointTwice, appearance.frame.forward),
    appearance.frame.forwardRange
  )
});

const compactMask = (distanceSquared: number, radius: number): number => {
  const radiusSquared = radius * radius;
  return distanceSquared >= radiusSquared
    ? 0
    : Math.floor((radiusSquared - distanceSquared) * FIELD_UNIT / radiusSquared);
};

const squaredDistance = (first: number, second: number): number =>
  first * first + second * second;

const attachmentSignal = (
  appearance: SurfaceAppearanceV1,
  position: FixedProjectPosition
): number => appearance.attachmentPoints.reduce((strongest, point) => {
  const attachment = projectPosition(appearance, [
    point[0] * 2,
    point[1] * 2,
    point[2] * 2
  ]);
  const distanceSquared = appearance.faceAspect === 'flank'
    ? squaredDistance(
        position.up - attachment.up,
        position.forward - attachment.forward
      )
    : appearance.faceAspect === 'dorsal' ||
        appearance.faceAspect === 'ventral'
      ? squaredDistance(
          position.lateral - attachment.lateral,
          position.forward - attachment.forward
        )
      : squaredDistance(
          position.lateral - attachment.lateral,
          position.up - attachment.up
        );
  return Math.max(strongest, compactMask(distanceSquared, 128));
}, 0);

const edgeSignal = (
  bounds: SurfacePatternComponent['bounds'],
  u: number,
  v: number,
  seed: number
): number => {
  const width = Math.max(1, bounds.width - 1);
  const height = Math.max(1, bounds.height - 1);
  const localU = Math.floor((u - bounds.x) * FIELD_UNIT / width);
  const localV = Math.floor((v - bounds.y) * FIELD_UNIT / height);
  const distances = [localU, FIELD_UNIT - localU, localV, FIELD_UNIT - localV];
  const distance = distances[seed % distances.length] ?? FIELD_UNIT;
  return Math.max(0, FIELD_UNIT - distance * 8);
};

const semanticSignal = (
  appearance: SurfaceAppearanceV1,
  bounds: SurfacePatternComponent['bounds'],
  position: FixedProjectPosition,
  u: number,
  v: number,
  seed: number
): number => {
  const attachment = attachmentSignal(appearance, position);
  const edge = edgeSignal(bounds, u, v, seed);
  const extremity = Math.max(
    Math.abs(position.lateral - FIELD_UNIT / 2),
    Math.abs(position.forward - FIELD_UNIT / 2)
  );
  switch (appearance.decoration) {
    case 'support':
      return -Math.floor((FIELD_UNIT - position.up) / 2) - Math.floor(attachment / 2);
    case 'articulated':
      return -Math.floor(attachment / 2) - Math.floor(extremity / 6);
    case 'rotary':
      return -Math.floor(edge / 2) + coherentNoise(position, seed ^ 0x27d4eb2d, 5) / 8;
    case 'focal':
      return Math.floor(compactMask(squaredDistance(
        position.lateral - FIELD_UNIT / 2,
        position.up - Math.floor(FIELD_UNIT * 0.68)
      ), 220) / 3) - Math.floor(attachment / 6);
    case 'accent':
      return Math.floor(coherentNoise(position, seed ^ 0x165667b1, 4) / 2) - Math.floor(edge / 8);
    case 'wing':
      return -Math.floor(edge / 4) + Math.floor(extremity / 6);
    case 'fin':
      return Math.floor((position.up - FIELD_UNIT / 2) / 3) - Math.floor(edge / 4);
    case 'sail':
      return Math.floor((position.up - FIELD_UNIT / 2) / 4) - Math.floor(edge / 5);
    case 'panel':
      return -Math.floor(edge / 3) + Math.floor(coherentNoise(position, seed ^ 0x85ebca6b, 4) / 8);
    case 'body':
      return -Math.floor(attachment / 5);
  }
};

const seedValue = (appearance: SurfaceAppearanceV1): string =>
  appearance.seed.kind === 'explicit'
    ? `explicit:${appearance.seed.value}`
    : `auto:${appearance.seed.semanticKey}`;

const textureFrequency = (appearance: SurfaceAppearanceV1): number => {
  const base = SCALE_FREQUENCY[appearance.texture.scale];
  return appearance.texture.kind === 'grain' ? base * 2 : base;
};

const createToneScore = (
  appearance: SurfaceAppearanceV1,
  bounds: SurfacePatternComponent['bounds']
): ((u: number, v: number) => number) => {
  const seed = seedValue(appearance);
  const rootSeed = stableTextureSeed(seed, GENERATED_SURFACE_SEED);
  const semanticSeed = stableTextureSeed(
    `${seed}:${appearance.semanticOwnerKey}:${appearance.decoration}:` +
      `${appearance.geometry}:${appearance.texture.kind}:` +
      `${appearance.texture.scale}:${appearance.texture.density}`,
    GENERATED_SURFACE_SEED
  );
  const frequency = textureFrequency(appearance);
  return (u, v) => {
    const position = projectPosition(appearance, worldPointTwice(appearance, u, v));
    const broad = coherentNoise(position, rootSeed, Math.max(2, frequency - 1)) - 512;
    const local = coherentNoise(position, semanticSeed, frequency) - 512;
    const sideFace = appearance.faceAspect === 'flank' ||
      appearance.faceAspect === 'anterior' ||
      appearance.faceAspect === 'posterior';
    let score = broad * 3 + local * (appearance.domain === 'organism' ? 2 : 1);
    if (sideFace) {
      score += Math.floor((position.up - 512) * (
        appearance.domain === 'organism' ? 2 : 1
      ) / 3);
    }
    if (
      appearance.domain === 'organism' &&
      appearance.faceAspect === 'flank' &&
      (appearance.decoration === 'body' || appearance.decoration === 'fin')
    ) {
      const stripeLevel = 470 + semanticSeed % 130;
      const stripe = Math.max(0, 90 - Math.abs(position.up - stripeLevel));
      const broken = coherentNoise(position, semanticSeed ^ 0x9e3779b9, 5);
      score -= Math.floor(stripe * (256 + broken) / 128);
    }
    if (appearance.texture.kind === 'brushed') {
      score += Math.floor(coherentNoise(
        { ...position, lateral: Math.floor(position.lateral / 3) },
        semanticSeed ^ 0x632be59b,
        frequency + 2
      ) / 2);
    }
    if (appearance.texture.kind === 'weathered') {
      score -= Math.floor(edgeSignal(bounds, u, v, semanticSeed) / 3);
    }
    if (appearance.texture.kind !== 'quiet') {
      score += semanticSignal(
        appearance,
        bounds,
        position,
        u,
        v,
        semanticSeed
      );
    }
    return score * 2048 + (hash3(u, v, appearance.plane, semanticSeed) & 2047);
  };
};

const totalRoleBudget = (
  texelCount: number,
  appearance: SurfaceAppearanceV1
): number => {
  if (texelCount <= 4) return 0;
  if (texelCount <= 7) return 1;
  if (texelCount <= 15) return 2;
  const density = appearance.texture.kind === 'quiet'
    ? 0.04
    : DENSITY_VARIATION_SHARE[appearance.texture.density];
  const profileFactor = appearance.decoration === 'focal'
    ? 0.56
    : appearance.decoration === 'support' || appearance.decoration === 'accent'
      ? 1.08
      : 1;
  return Math.max(1, Math.min(
    Math.floor(texelCount * 0.28),
    Math.round(texelCount * density * profileFactor)
  ));
};

export const appearanceRoleBudget = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1
): AppearanceRoleBudget => {
  const total = totalRoleBudget(component.texelCount, appearance);
  if (total === 0) return { shadow: 0, light: 0 };
  if (total === 1) {
    return appearance.decoration === 'accent'
      ? { shadow: 0, light: 1 }
      : { shadow: 1, light: 0 };
  }
  const shadow = Math.max(1, Math.min(
    total - 1,
    Math.round(total * PROFILE_SHADOW_SHARE[appearance.decoration])
  ));
  return { shadow, light: total - shadow };
};

export const appearanceToneSamples = (
  component: SurfacePatternComponent,
  appearance: SurfaceAppearanceV1
): readonly AppearanceToneSample[] => {
  const score = createToneScore(appearance, component.bounds);
  return component.occupiedSpans.flatMap((span) =>
    Array.from({ length: span.width }, (_, offset) => {
      const u = span.x + offset;
      return {
        key: appearanceSampleKey(u, span.y),
        u,
        v: span.y,
        score: score(u, span.y)
      };
    })
  );
};

export const protectedAppearanceKeys = (
  appearance: SurfaceAppearanceV1,
  samples: readonly AppearanceToneSample[]
): ReadonlySet<string> => new Set(samples.flatMap((sample) =>
  appearance.protectedRegions.some((region) =>
    sample.u >= region.x - 1 &&
    sample.v >= region.y - 1 &&
    sample.u < region.x + region.width + 1 &&
    sample.v < region.y + region.height + 1
  ) ? [sample.key] : []
));
