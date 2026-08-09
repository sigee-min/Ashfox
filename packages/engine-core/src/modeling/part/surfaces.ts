import type { SurfaceOwnedCuboid } from '../surface/ownership';

export interface SurfaceCuboidIndexMetric {
  readonly indexedCuboids: number;
  readonly ownerArrays: number;
}

export interface MeasuredSurfaceCuboidIndex {
  readonly cuboidsByOwner: ReadonlyMap<
    string,
    readonly SurfaceOwnedCuboid[]
  >;
  readonly metric: SurfaceCuboidIndexMetric;
}

/** Uses one private mutable draft per owner, exposed only as a readonly map. */
export const indexSurfaceCuboidsMeasured = (
  cuboids: readonly SurfaceOwnedCuboid[]
): MeasuredSurfaceCuboidIndex => {
  const cuboidsByOwner = new Map<string, SurfaceOwnedCuboid[]>();
  let ownerArrays = 0;
  for (const cuboid of cuboids) {
    const owned = cuboidsByOwner.get(cuboid.ownerId);
    if (owned) owned.push(cuboid);
    else {
      cuboidsByOwner.set(cuboid.ownerId, [cuboid]);
      ownerArrays += 1;
    }
  }
  return {
    cuboidsByOwner,
    metric: { indexedCuboids: cuboids.length, ownerArrays }
  };
};

export const indexSurfaceCuboids = (
  cuboids: readonly SurfaceOwnedCuboid[]
): ReadonlyMap<string, readonly SurfaceOwnedCuboid[]> =>
  indexSurfaceCuboidsMeasured(cuboids).cuboidsByOwner;
