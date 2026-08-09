import {
  CUBE_FACE_DIRECTIONS,
  type ModelPartMaterial
} from '../../model';
import type { CompiledPartState } from '../invariants/contract';
import type { SurfaceOwnedCuboid } from '../surface/ownership';

export interface SurfaceProjectionExpectation {
  actual: CompiledPartState;
  expectedSurfaceById: ReadonlyMap<string, SurfaceOwnedCuboid>;
  material: ModelPartMaterial | undefined;
  generatedTextureId: string | undefined;
}

/** Verifies generated cube faces against canonical external-surface ownership. */
export const matchesSurfaceProjection = ({
  actual,
  expectedSurfaceById,
  material,
  generatedTextureId
}: SurfaceProjectionExpectation): boolean =>
  material !== undefined &&
  generatedTextureId !== undefined &&
  actual.cubes.every((cube) => {
    const expectedSurface = expectedSurfaceById.get(cube.id);
    return expectedSurface !== undefined &&
      cube.baseColor.toUpperCase() === material.baseColor &&
      cube.mirror === false &&
      cube.boxUv === false &&
      CUBE_FACE_DIRECTIONS.every(
        (direction) =>
          cube.faces[direction].textureId === generatedTextureId &&
          cube.faces[direction].enabled ===
            (expectedSurface.faces[direction] === 'external')
      );
  });
