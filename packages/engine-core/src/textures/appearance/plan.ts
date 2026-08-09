import { canonicalJsonString } from '../../canonicalJson';
import type {
  CubeNode,
  ProjectDocument,
  Vec3
} from '../../model';
import type {
  ProjectAppearanceBinding,
  ProjectAppearanceMarking
} from '../../project/appearance/contract';
import { readPartRecipe } from '../../modeling/recipe';
import type { LatticeBounds } from '../../modeling/contract';
import { projectSpatialFrame } from '../../project/frame';
import { compareStableText } from '../../stableOrder';
import { stableTextureSeed } from '../deterministicPixel';
import type {
  SurfaceAppearanceMarkingPlan,
  SurfaceAppearanceReflection,
  SurfaceAppearanceSeed,
  SurfaceFaceAspect
} from './contract';
import { createSurfaceAppearanceFrame } from './frame';
import {
  combinedLatticeBounds,
  compiledLatticeBounds
} from './geometry';
import type { SurfaceAppearanceRegionAuthority } from './region';

const MARKING_SEED = 0x4d41524b;

const MOTIF_CLASS: Readonly<
  Record<ProjectAppearanceMarking['motif'], number>
> = {
  wash: 0,
  band: 1,
  stripe: 2,
  bars: 2,
  spots: 3,
  patch: 3,
  rim: 3
};

interface PlannedMarkingAuthority {
  readonly plan: SurfaceAppearanceMarkingPlan;
  readonly partIds: readonly string[];
  readonly faceScope: ProjectAppearanceBinding['faceScope'];
}

const scaledBounds = (
  bounds: LatticeBounds,
  scale: number
): LatticeBounds => ({
  min: {
    x: bounds.min.x * scale,
    y: bounds.min.y * scale,
    z: bounds.min.z * scale
  },
  max: {
    x: bounds.max.x * scale,
    y: bounds.max.y * scale,
    z: bounds.max.z * scale
  }
});

const generatedBoundsByPart = (
  document: ProjectDocument,
  coordinateScale: number
): ReadonlyMap<string, readonly LatticeBounds[]> => {
  const drafts = new Map<string, LatticeBounds[]>();
  const cubes = Object.values(document.scene.nodes)
    .filter((node): node is CubeNode =>
      node.kind === 'cube' &&
      node.generation?.authority === 'ashfox.part-compiler' &&
      node.generation.role === 'geometry'
    )
    .sort((left, right) => compareStableText(left.id, right.id));
  for (const cube of cubes) {
    const bounds = compiledLatticeBounds(document, cube);
    const partId = cube.generation?.partId;
    if (!bounds || !partId) continue;
    const entries = drafts.get(partId) ?? [];
    entries.push(scaledBounds(bounds, coordinateScale));
    drafts.set(partId, entries);
  }
  return drafts;
};

const bindingOwnsSlotPair = (
  document: ProjectDocument,
  binding: ProjectAppearanceBinding
): boolean => {
  const partIds = new Set(binding.partIds);
  const pairCounts = new Map<string, number>();
  for (const slot of document.authoringProfile?.slots ?? []) {
    if (
      slot.symmetry.kind !== 'paired' ||
      !slot.partIds.some((partId) => partIds.has(partId))
    ) continue;
    pairCounts.set(
      slot.symmetry.pairId,
      (pairCounts.get(slot.symmetry.pairId) ?? 0) + 1
    );
  }
  return [...pairCounts.values()].some((count) => count >= 2);
};

const bindingOwnsPairedSurface = (
  document: ProjectDocument,
  marking: ProjectAppearanceMarking
): boolean => {
  const target = marking.target;
  if (target.kind !== 'surface') return false;
  return document.intent?.semanticContract.supportedSurfaces.some((surface) =>
    surface.id === target.id && surface.cardinality === 'paired'
  ) === true;
};

const reflectionFor = (
  document: ProjectDocument,
  marking: ProjectAppearanceMarking,
  binding: ProjectAppearanceBinding,
  coordinateScale: number
): SurfaceAppearanceReflection | null => {
  const intent = document.intent;
  if (!intent) return null;
  const paired = intent.symmetry.kind === 'bilateral' ||
    bindingOwnsPairedSurface(document, marking) ||
    bindingOwnsSlotPair(document, binding);
  const planeTwice = intent.symmetry.kind === 'bilateral'
    ? intent.symmetry.planeTwice
    : paired ? intent.symmetry.pairPlaneTwice : undefined;
  if (!paired || planeTwice === undefined) return null;
  const spatial = projectSpatialFrame(intent);
  const axis = spatial.lateralAxis;
  const axisIndex = axis === 'x' ? 0 : 2;
  return Object.freeze({
    axis,
    planeTwice: planeTwice * coordinateScale,
    leftSign: spatial.left[axisIndex] < 0 ? -1 : 1
  });
};

const canonicalBounds = (
  bounds: LatticeBounds,
  reflection: SurfaceAppearanceReflection | null
): LatticeBounds => {
  if (!reflection) return bounds;
  const axis = reflection.axis;
  const minimum = bounds.min[axis];
  const maximum = bounds.max[axis];
  const plane = reflection.planeTwice / 2;
  const centerOnLeft = reflection.leftSign * (
    (minimum + maximum) / 2 - plane
  ) >= 0;
  const reflectedMinimum = reflection.planeTwice - maximum;
  const reflectedMaximum = reflection.planeTwice - minimum;
  const canonicalMinimum = centerOnLeft ? minimum : reflectedMinimum;
  const canonicalMaximum = centerOnLeft ? maximum : reflectedMaximum;
  const crossesPlane = canonicalMinimum < plane && canonicalMaximum > plane;
  return {
    min: {
      ...bounds.min,
      [axis]: crossesPlane && reflection.leftSign > 0
        ? plane
        : canonicalMinimum
    },
    max: {
      ...bounds.max,
      [axis]: crossesPlane && reflection.leftSign < 0
        ? plane
        : canonicalMaximum
    }
  };
};

const canonicalPoint = (
  point: Vec3,
  reflection: SurfaceAppearanceReflection | null
): Vec3 => {
  if (!reflection) return point;
  const index = reflection.axis === 'x' ? 0 : 2;
  const onLeft = reflection.leftSign * (
    2 * point[index] - reflection.planeTwice
  ) >= 0;
  if (onLeft) return point;
  const result: [number, number, number] = [...point];
  result[index] = reflection.planeTwice - point[index];
  return Object.freeze(result);
};

const rootPointsByPart = (
  document: ProjectDocument,
  coordinateScale: number
): ReadonlyMap<string, Vec3> => {
  const recipe = readPartRecipe(document);
  if (!recipe.ok || !recipe.recipe) return new Map();
  return new Map(recipe.recipe.parts.flatMap((part) => {
    if (part.kind === 'feature' || !part.attachment) return [];
    const point = part.attachment.parentAnchor;
    return [[part.partId, Object.freeze([
      point[0] * coordinateScale,
      point[1] * coordinateScale,
      point[2] * coordinateScale
    ]) as Vec3]];
  }));
};

const seedValue = (seed: SurfaceAppearanceSeed): string =>
  seed.kind === 'explicit'
    ? `explicit:${seed.value}`
    : `auto:${seed.semanticKey}`;

const maskSeed = (
  seed: SurfaceAppearanceSeed,
  marking: ProjectAppearanceMarking,
  binding: ProjectAppearanceBinding,
  regions: SurfaceAppearanceRegionAuthority
): number => {
  const markingProjection = {
    id: marking.id,
    target: marking.target,
    region: marking.region,
    placement: marking.placement,
    motif: marking.motif,
    ...(marking.flow === undefined ? {} : { flow: marking.flow }),
    ...(marking.variant === undefined ? {} : { variant: marking.variant }),
    scale: marking.scale,
    density: marking.density
  };
  return stableTextureSeed(canonicalJsonString(seed.kind === 'explicit'
    ? {
        seed: seedValue(seed),
        marking: markingProjection
      }
    : {
        seed: seedValue(seed),
        marking: markingProjection,
        binding: {
          markingId: binding.markingId,
          partIds: regions.ownerKeysFor(binding.partIds),
          faceScope: binding.faceScope
        }
      }), MARKING_SEED);
};

const comparePlans = (
  left: SurfaceAppearanceMarkingPlan,
  right: SurfaceAppearanceMarkingPlan
): number => MOTIF_CLASS[left.motif] - MOTIF_CLASS[right.motif] ||
  compareStableText(left.id, right.id);

export const planSurfaceMarkings = (
  document: ProjectDocument,
  seed: SurfaceAppearanceSeed,
  coordinateScale: number,
  regions: SurfaceAppearanceRegionAuthority
): readonly PlannedMarkingAuthority[] => {
  const appearance = document.intent?.appearance;
  const bindings = document.intent?.appearanceBindings;
  if (!appearance || !bindings || appearance.markings.length === 0) return [];
  const markings = new Map(appearance.markings.map((marking) => [
    marking.id,
    marking
  ]));
  const boundsByPart = generatedBoundsByPart(document, coordinateScale);
  const rootsByPart = rootPointsByPart(document, coordinateScale);
  const authorities: PlannedMarkingAuthority[] = [];
  for (const binding of [...bindings].sort((left, right) =>
    compareStableText(left.markingId, right.markingId)
  )) {
    const marking = markings.get(binding.markingId);
    if (!marking) continue;
    const partIds = [...new Set(binding.partIds)].sort(compareStableText);
    const reflection = reflectionFor(
      document,
      marking,
      binding,
      coordinateScale
    );
    const bounds = partIds
      .flatMap((partId) => boundsByPart.get(partId) ?? [])
      .map((entry) => canonicalBounds(entry, reflection));
    if (bounds.length === 0) continue;
    const rootPointEntries = new Map<string, Vec3>();
    const seenOwners = new Set<string>();
    for (const partId of partIds) {
      const ownerKey = regions.ownerKeyFor(partId);
      if (seenOwners.has(ownerKey)) continue;
      seenOwners.add(ownerKey);
      const attachmentPartIds = regions.regionFor(partId)
        ?.attachmentPartIds ?? [partId];
      for (const attachmentPartId of attachmentPartIds) {
        const point = rootsByPart.get(attachmentPartId);
        if (!point) continue;
        const canonical = canonicalPoint(point, reflection);
        rootPointEntries.set(canonical.join(','), canonical);
      }
    }
    const rootPoints = [...rootPointEntries]
      .sort(([left], [right]) => compareStableText(left, right))
      .map(([, point]) => point);
    authorities.push(Object.freeze({
      partIds: Object.freeze(partIds),
      faceScope: binding.faceScope,
      plan: Object.freeze({
        ...marking,
        target: Object.freeze({ ...marking.target }),
        accentColor: binding.accentColor ?? null,
        maskSeed: maskSeed(seed, marking, binding, regions),
        frame: createSurfaceAppearanceFrame(
          document,
          combinedLatticeBounds(bounds)
        ),
        rootPoints: Object.freeze(rootPoints),
        reflection
      })
    }));
  }
  return Object.freeze(authorities.sort((left, right) =>
    comparePlans(left.plan, right.plan)
  ));
};

export const surfaceMarkingsForFace = (
  authorities: readonly PlannedMarkingAuthority[],
  partId: string,
  aspect: SurfaceFaceAspect
): readonly SurfaceAppearanceMarkingPlan[] => Object.freeze(authorities
  .filter((authority) =>
    authority.partIds.includes(partId) &&
    (authority.faceScope === 'full' || aspect === 'anterior')
  )
  .map((authority) => authority.plan));
