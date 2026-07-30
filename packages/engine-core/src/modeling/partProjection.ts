import {
  CUBE_FACE_DIRECTIONS,
  type ProjectDocument
} from '../model';
import { compareStableText } from '../stableOrder';
import { decomposeOccupancy } from './decompose';
import { latticeToWorld } from './lattice';
import {
  compiledPartBoneId,
  compiledPartCubeId
} from './provenance';
import {
  readPartRecipe
} from './partRecipe';
import {
  rasterizePart
} from './partPrimitiveAdapter';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './partInvariants';

const equalSets = (
  left: ReadonlySet<string>,
  right: ReadonlySet<string>
): boolean =>
  left.size === right.size &&
  [...left].every((entry) => right.has(entry));

export const validatePartRecipeProjection = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>
): readonly PartInvariantIssue[] => {
  const issues: PartInvariantIssue[] = [];
  const recipeResult = readPartRecipe(document);
  if (!recipeResult.ok) {
    return recipeResult.issues.map((issue) => ({
      code: 'projection',
      path: issue.path,
      message: issue.message,
      entityIds: []
    }));
  }
  const recipe = recipeResult.recipe;
  if (recipe === null) {
    if (parts.size > 0) {
      issues.push({
        code: 'projection',
        path: 'modeling',
        message:
          'Generated part geometry requires its canonical modeling recipe.',
        entityIds: [...parts.values()].map((part) => part.bone.id)
      });
    }
    return issues;
  }
  if (parts.size !== recipe.parts.length) {
    issues.push({
      code: 'projection',
      path: 'modeling.parts',
      message:
        'Generated part count does not match the canonical modeling recipe.',
      entityIds: [...parts.values()].map((part) => part.bone.id)
    });
  }

  const materials = new Map(
    recipe.materials.map((material) => [material.id, material])
  );
  const generatedTextureId = Object.values(document.textures)
    .filter((texture) => texture.atlasMode === 'generate')
    .sort((left, right) => compareStableText(left.id, right.id))[0]?.id;

  for (const spec of recipe.parts) {
    const actual = parts.get(spec.partId);
    if (!actual) {
      issues.push({
        code: 'projection',
        path: `modeling.parts.${spec.partId}`,
        message:
          `Canonical part "${spec.partId}" has no generated projection.`,
        entityIds: [compiledPartBoneId(spec.partId)]
      });
      continue;
    }
    const expectedOccupancy = rasterizePart(
      document.settings.surfacePixelDensity,
      spec
    );
    const expectedDecomposition =
      decomposeOccupancy(expectedOccupancy);
    const expectedIds = new Set(
      expectedDecomposition.cuboids.map((cuboid) =>
        compiledPartCubeId(
          spec.partId,
          document.settings.surfacePixelDensity,
          cuboid.bounds
        )
      )
    );
    const actualIds = new Set(
      actual.cubes.map((cube) => cube.id)
    );
    const expectedPivot: readonly [number, number, number] =
      spec.attachment === null
        ? [0, 0, 0]
        : spec.attachment.parentAnchor.map((coordinate) =>
            latticeToWorld(
              coordinate,
              document.settings.surfacePixelDensity
            )
          ) as [number, number, number];
    const material = materials.get(spec.materialId);
    const metadataMatches =
      actual.parentPartId === spec.parentPartId &&
      actual.materialId === spec.materialId &&
      actual.primitive === spec.kind &&
      JSON.stringify(actual.joint) === JSON.stringify(spec.joint) &&
      actual.bone.parentId === (
        spec.parentPartId === null
          ? null
          : compiledPartBoneId(spec.parentPartId)
      ) &&
      actual.bone.transform.pivot.every(
        (coordinate, axis) =>
          coordinate === expectedPivot[axis]
      );
    const surfacesMatch =
      material !== undefined &&
      generatedTextureId !== undefined &&
      actual.cubes.every(
        (cube) =>
          cube.baseColor.toUpperCase() === material.baseColor &&
          cube.mirror === false &&
          cube.boxUv === false &&
          CUBE_FACE_DIRECTIONS.every(
            (direction) =>
              cube.faces[direction].textureId === generatedTextureId
          )
      );
    if (
      metadataMatches &&
      surfacesMatch &&
      equalSets(expectedOccupancy.cells, actual.occupancy.cells) &&
      equalSets(expectedIds, actualIds)
    ) {
      continue;
    }
    issues.push({
      code: 'projection',
      path: `scene.parts.${spec.partId}`,
      message:
        `Generated part "${spec.partId}" has drifted from its canonical modeling recipe.`,
      entityIds: [
        actual.bone.id,
        ...actual.cubes.map((cube) => cube.id)
      ]
    });
  }
  return issues;
};
