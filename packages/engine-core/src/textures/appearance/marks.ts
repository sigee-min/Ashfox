import type { Vec3 } from '../../model';
import type {
  ProjectAppearanceFlow,
  ProjectAppearanceScale
} from '../../project/appearance/contract';
import { compareStableText } from '../../stableOrder';
import type {
  SurfaceAppearanceMarkingPlan,
  SurfaceAppearanceProjectFrame,
  SurfaceAppearanceV1
} from './contract';

const UNIT = 1024;

const MOTIF_CLASS: Readonly<
  Record<SurfaceAppearanceMarkingPlan['motif'], number>
> = {
  wash: 0,
  band: 1,
  stripe: 2,
  bars: 2,
  spots: 3,
  patch: 3,
  rim: 3
};

const orderedMarkings = (
  markings: readonly SurfaceAppearanceMarkingPlan[]
): readonly SurfaceAppearanceMarkingPlan[] => [...markings].sort(
  (left, right) => MOTIF_CLASS[left.motif] - MOTIF_CLASS[right.motif] ||
    compareStableText(left.id, right.id)
);

interface FixedProjectPosition {
  readonly lateral: number;
  readonly up: number;
  readonly forward: number;
}

interface FixedSurfacePosition {
  readonly first: number;
  readonly second: number;
  readonly along: number;
  readonly cross: number;
}

const SCALE_RADIUS: Readonly<Record<ProjectAppearanceScale, number>> = {
  fine: 96,
  medium: 152,
  broad: 216
};

const hash3 = (x: number, y: number, seed: number): number => {
  let hash = (
    seed ^
    Math.imul(x, 0x9e3779b1) ^
    Math.imul(y, 0x85ebca6b)
  ) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b) >>> 0;
  return (hash ^ (hash >>> 16)) >>> 0;
};

const streamUnit = (seed: number, stream: number): number =>
  hash3(stream, seed & 0xffff, seed ^ Math.imul(stream, 0x27d4eb2d)) %
  (UNIT + 1);

const centeredStream = (seed: number, stream: number, span: number): number =>
  Math.floor((streamUnit(seed, stream) - UNIT / 2) * span / UNIT);

const dot = (left: Vec3, right: Vec3): number =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2];

const worldPointTwice = (
  appearance: SurfaceAppearanceV1,
  u: number,
  v: number
): [number, number, number] => {
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

const reflectedPointTwice = (
  marking: SurfaceAppearanceMarkingPlan,
  point: [number, number, number]
): [number, number, number] => {
  const reflection = marking.reflection;
  if (!reflection) return point;
  const index = reflection.axis === 'x' ? 0 : 2;
  if (reflection.leftSign * (point[index] - reflection.planeTwice) >= 0) {
    return point;
  }
  const result: [number, number, number] = [...point];
  result[index] = 2 * reflection.planeTwice - point[index];
  return result;
};

/** Canonical object-space rank coordinate shared by reflected mark budgets. */
export const surfaceMarkingCanonicalPointTwice = (
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan,
  u: number,
  v: number
): readonly [number, number, number] => reflectedPointTwice(
  marking,
  worldPointTwice(appearance, u, v)
);

const normalizedAlong = (
  valueTwice: number,
  range: { readonly minimum: number; readonly maximum: number }
): number => {
  const minimumTwice = range.minimum * 2;
  const spanTwice = (range.maximum - range.minimum) * 2;
  if (spanTwice <= 0) return UNIT / 2;
  return Math.min(UNIT, Math.max(0, Math.floor(
    ((valueTwice - minimumTwice) * UNIT + spanTwice / 2) / spanTwice
  )));
};

const projectPosition = (
  frame: SurfaceAppearanceProjectFrame,
  pointTwice: Vec3
): FixedProjectPosition => ({
  lateral: normalizedAlong(dot(pointTwice, frame.left), frame.lateralRange),
  up: normalizedAlong(dot(pointTwice, frame.up), frame.upRange),
  forward: normalizedAlong(
    dot(pointTwice, frame.forward),
    frame.forwardRange
  )
});

const surfaceAxes = (
  appearance: SurfaceAppearanceV1,
  position: FixedProjectPosition,
  flow: ProjectAppearanceFlow
): FixedSurfacePosition => {
  let first: number;
  let second: number;
  if (appearance.faceAspect === 'flank') {
    first = position.forward;
    second = position.up;
  } else if (
    appearance.faceAspect === 'dorsal' ||
    appearance.faceAspect === 'ventral'
  ) {
    first = position.lateral;
    second = position.forward;
  } else {
    first = position.lateral;
    second = position.up;
  }
  const alongUsesFirst = flow === 'radial' ||
    (flow === 'longitudinal' && appearance.faceAspect === 'flank') ||
    (flow === 'transverse' && appearance.faceAspect !== 'flank');
  const along = alongUsesFirst ? first : second;
  return {
    first,
    second,
    along,
    cross: alongUsesFirst ? second : first
  };
};

const boundaryJitter = (
  position: FixedProjectPosition,
  seed: number
): number => (
  hash3(
    Math.floor(position.lateral / 128),
    Math.floor((position.up + position.forward) / 128),
    seed
  ) % 65
) - 32;

const regionContains = (
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan,
  position: FixedProjectPosition
): boolean => {
  const jitter = boundaryJitter(position, marking.maskSeed);
  const high = 608 + jitter;
  const low = UNIT - high;
  switch (marking.region) {
    case 'full': return true;
    case 'flank': return appearance.faceAspect === 'flank';
    case 'dorsal':
      return appearance.faceAspect !== 'ventral' && position.up >= high;
    case 'ventral':
      return appearance.faceAspect !== 'dorsal' && position.up <= low;
    case 'anterior':
      return appearance.faceAspect !== 'posterior' && position.forward >= high;
    case 'posterior':
      return appearance.faceAspect !== 'anterior' && position.forward <= low;
    case 'dorsal-flank':
      return appearance.faceAspect === 'flank' && position.up >= high;
    case 'ventral-flank':
      return appearance.faceAspect === 'flank' && position.up <= low;
    case 'anterior-flank':
      return appearance.faceAspect === 'flank' && position.forward >= high;
    case 'posterior-flank':
      return appearance.faceAspect === 'flank' && position.forward <= low;
  }
};

const ellipseContains = (
  x: number,
  y: number,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number
): boolean => {
  const deltaX = x - centerX;
  const deltaY = y - centerY;
  return deltaX * deltaX * radiusY * radiusY +
    deltaY * deltaY * radiusX * radiusX <=
    radiusX * radiusX * radiusY * radiusY;
};

const nearestRootDistance = (
  marking: SurfaceAppearanceMarkingPlan,
  position: FixedProjectPosition
): number | null => marking.rootPoints.reduce<number | null>((nearest, root) => {
  const projected = projectPosition(marking.frame, [
    root[0] * 2,
    root[1] * 2,
    root[2] * 2
  ]);
  const distance =
    (position.lateral - projected.lateral) ** 2 +
    (position.up - projected.up) ** 2 +
    (position.forward - projected.forward) ** 2;
  return nearest === null ? distance : Math.min(nearest, distance);
}, null);

const placementContains = (
  marking: SurfaceAppearanceMarkingPlan,
  position: FixedProjectPosition,
  surface: FixedSurfacePosition
): boolean => {
  const radius = SCALE_RADIUS[marking.scale];
  const rootDistance = nearestRootDistance(marking, position);
  switch (marking.placement) {
    case 'whole': return true;
    case 'center':
      return ellipseContains(
        surface.first,
        surface.second,
        UNIT / 2,
        UNIT / 2,
        radius * 2,
        radius * 2
      );
    case 'root':
      return rootDistance === null
        ? surface.along <= radius * 2
        : rootDistance <= (radius * 2) ** 2;
    case 'joint':
      return rootDistance !== null && rootDistance <= (radius * 2) ** 2;
    case 'tip':
      return rootDistance === null
        ? surface.along >= UNIT - radius * 2
        : rootDistance >= (UNIT - radius * 2) ** 2;
    case 'edge':
      return Math.min(
        surface.first,
        UNIT - surface.first,
        surface.second,
        UNIT - surface.second
      ) <= radius;
  }
};

const washContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const radius = marking.scale === 'fine'
    ? 278
    : marking.scale === 'medium' ? 336 : 388;
  const centerX = UNIT / 2 + centeredStream(marking.maskSeed, 1, 120);
  const centerY = UNIT / 2 + centeredStream(marking.maskSeed, 2, 120);
  const jitter = centeredStream(
    marking.maskSeed ^ hash3(
      Math.floor(surface.first / 96),
      Math.floor(surface.second / 96),
      marking.maskSeed
    ),
    3,
    40
  );
  return ellipseContains(
    surface.first,
    surface.second,
    centerX,
    centerY,
    radius + jitter,
    Math.floor(radius * 0.72) + jitter
  );
};

const bandContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const width = Math.floor(SCALE_RADIUS[marking.scale] * 0.62) +
    (marking.density === 'rich' ? 18 : marking.density === 'balanced' ? 8 : 0);
  const center = UNIT / 2 + centeredStream(marking.maskSeed, 4, 300);
  if (marking.flow === 'radial') {
    const deltaX = surface.first - UNIT / 2;
    const deltaY = surface.second - UNIT / 2;
    const radius = 300 + centeredStream(marking.maskSeed, 5, 120);
    const radialWidth = Math.max(24, Math.floor(width * 0.62));
    const distance = deltaX * deltaX + deltaY * deltaY;
    return distance >= (radius - radialWidth) ** 2 &&
      distance <= (radius + radialWidth) ** 2;
  }
  const bend = centeredStream(marking.maskSeed, 5, 42) *
    (Math.abs(surface.cross - UNIT / 2) - UNIT / 4) / (UNIT / 4);
  return Math.abs(surface.along - center - Math.trunc(bend)) <= width;
};

const stripeContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const width = Math.max(18, Math.floor(SCALE_RADIUS[marking.scale] * 0.3));
  const center = UNIT / 2 + centeredStream(marking.maskSeed, 6, 360);
  if (marking.flow === 'radial') {
    const deltaX = surface.first - UNIT / 2;
    const deltaY = surface.second - UNIT / 2;
    const radius = 330 + centeredStream(marking.maskSeed, 7, 160);
    const distance = deltaX * deltaX + deltaY * deltaY;
    return distance >= (radius - width) ** 2 &&
      distance <= (radius + width) ** 2;
  }
  const phase = (surface.along + streamUnit(marking.maskSeed, 7)) % 512;
  const wave = Math.floor((256 - Math.abs(phase - 256)) / 8) - 16;
  return Math.abs(surface.cross - center - wave) <= width;
};

const barsContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const count = marking.density === 'sparse' ? 2 :
    marking.density === 'balanced' ? 3 : 4;
  const width = Math.max(14, Math.floor(SCALE_RADIUS[marking.scale] * 0.2));
  if (marking.flow === 'radial') {
    const deltaX = surface.first - UNIT / 2;
    const deltaY = surface.second - UNIT / 2;
    const distance = deltaX * deltaX + deltaY * deltaY;
    for (let index = 0; index < count; index += 1) {
      const radius = Math.floor((index + 1) * 470 / (count + 1));
      if (
        distance >= (radius - width) ** 2 &&
        distance <= (radius + width) ** 2
      ) return true;
    }
    return false;
  }
  const offset = centeredStream(marking.maskSeed, 8, 110);
  if (Math.abs(surface.cross - UNIT / 2) > 300) return false;
  for (let index = 0; index < count; index += 1) {
    const center = Math.floor((index + 1) * UNIT / (count + 1)) + offset;
    if (Math.abs(surface.along - center) <= width) return true;
  }
  return false;
};

const spotsContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const count = marking.density === 'sparse' ? 2 :
    marking.density === 'balanced' ? 4 : 6;
  const radius = Math.max(34, Math.floor(SCALE_RADIUS[marking.scale] * 0.42));
  for (let index = 0; index < count; index += 1) {
    const centerX = 160 + streamUnit(marking.maskSeed, 20 + index * 2) * 704 / UNIT;
    const centerY = 160 + streamUnit(marking.maskSeed, 21 + index * 2) * 704 / UNIT;
    if (ellipseContains(
      surface.first,
      surface.second,
      Math.floor(centerX),
      Math.floor(centerY),
      radius,
      radius
    )) return true;
  }
  return false;
};

const patchContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const radius = SCALE_RADIUS[marking.scale];
  const centerX = UNIT / 2 + centeredStream(marking.maskSeed, 40, 440);
  const centerY = UNIT / 2 + centeredStream(marking.maskSeed, 41, 440);
  return ellipseContains(
    surface.first,
    surface.second,
    centerX,
    centerY,
    radius,
    Math.floor(radius * 0.78)
  );
};

const rimContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  const width = Math.max(24, Math.floor(SCALE_RADIUS[marking.scale] * 0.36));
  switch (marking.maskSeed % 4) {
    case 0: return surface.first <= width;
    case 1: return surface.first >= UNIT - width;
    case 2: return surface.second <= width;
    default: return surface.second >= UNIT - width;
  }
};

const motifContains = (
  marking: SurfaceAppearanceMarkingPlan,
  surface: FixedSurfacePosition
): boolean => {
  switch (marking.motif) {
    case 'wash': return washContains(marking, surface);
    case 'band': return bandContains(marking, surface);
    case 'stripe': return stripeContains(marking, surface);
    case 'bars': return barsContains(marking, surface);
    case 'spots': return spotsContains(marking, surface);
    case 'patch': return patchContains(marking, surface);
    case 'rim': return rimContains(marking, surface);
  }
};

/** Tests one semantic object-space texel; tone, contrast, palette, and UVs are absent. */
export const surfaceMarkingContains = (
  appearance: SurfaceAppearanceV1,
  marking: SurfaceAppearanceMarkingPlan,
  u: number,
  v: number
): boolean => {
  if (appearance.protectedRegions.some((region) =>
    u >= region.x - 1 &&
    v >= region.y - 1 &&
    u < region.x + region.width + 1 &&
    v < region.y + region.height + 1
  )) return false;
  const point = surfaceMarkingCanonicalPointTwice(
    appearance,
    marking,
    u,
    v
  );
  const position = projectPosition(marking.frame, point);
  const surface = surfaceAxes(
    appearance,
    position,
    marking.flow ?? 'longitudinal'
  );
  return regionContains(appearance, marking, position) &&
    placementContains(marking, position, surface) &&
    motifContains(marking, surface);
};

/** Last match wins after compiler-owned class/ID ordering. */
export const surfaceMarkingAt = (
  appearance: SurfaceAppearanceV1,
  u: number,
  v: number
): SurfaceAppearanceMarkingPlan | null => {
  let selected: SurfaceAppearanceMarkingPlan | null = null;
  for (const marking of orderedMarkings(appearance.markings ?? [])) {
    if (surfaceMarkingContains(appearance, marking, u, v)) {
      selected = marking;
    }
  }
  return selected;
};
