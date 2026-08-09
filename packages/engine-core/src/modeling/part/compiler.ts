import type { ProjectDocument, SceneNode } from '../../model';
import { compareStableText } from '../../stableOrder';
import { canonicalizePartOccupancies } from '../occupancy';
import {
  comparePartSceneNodes,
  preparePartCompilation
} from './prepare';
import {
  partCompilationFailure,
  type CompilePartSceneInput,
  type CompilePartSceneResult
} from './compilation';
import { readCompiledParts } from '../invariants';
import {
  appendPartSceneNodes,
  foreignSceneNodeCollision,
  partBoneNode,
  partCubeNode
} from './emission';
import {
  partitionSurfaceOwnedCuboids
} from '../surface/ownership';
import { projectCompiledFeatures } from './projection';
import { indexSurfaceCuboids } from './surfaces';

export type {
  CompilePartSceneInput,
  CompilePartSceneResult
} from './compilation';

/**
 * Public modeling pipeline: read existing state, canonicalize occupancy,
 * resolve surface ownership, emit scene nodes, then verify the projection.
 */
export const compilePartScene = (
  document: ProjectDocument,
  input: CompilePartSceneInput
): CompilePartSceneResult => {
  const prepared = preparePartCompilation(document, input);
  if (!prepared.ok) return prepared;

  const canonicalized = canonicalizePartOccupancies(
    input.parts,
    document.settings.surfacePixelDensity
  );
  if (!canonicalized.ok) {
    return partCompilationFailure(
      'geometry', canonicalized.path, canonicalized.message
    );
  }
  const surfaceOwnership = partitionSurfaceOwnedCuboids(
    canonicalized.parts.flatMap((entry) => entry.cuboids.map((cuboid) => ({
      ownerId: entry.spec.partId,
      cuboid
    })))
  );
  if (!surfaceOwnership.ok) {
    return partCompilationFailure(
      'geometry', 'parts', surfaceOwnership.message
    );
  }
  const surfaces = indexSurfaceCuboids(surfaceOwnership.cuboids);
  const compiledNodes: SceneNode[] = [];
  try {
    for (const entry of canonicalized.parts) {
      const part = entry.spec;
      const baseColor = prepared.value.colors.get(part.materialId);
      if (!baseColor) {
        return partCompilationFailure(
          'missing_material',
          `parts.${part.partId}.materialId`,
          `Material "${part.materialId}" has no base color.`
        );
      }
      const ownedSurfaces = surfaces.get(part.partId);
      if (!ownedSurfaces || ownedSurfaces.length === 0) {
        return partCompilationFailure(
          'geometry',
          `parts.${part.partId}`,
          `Part "${part.partId}" has no canonical surface-owned cuboids.`
        );
      }
      const bone = partBoneNode(
        part,
        document.settings.surfacePixelDensity,
        entry.canonicalAttachmentAnchor
      );
      const cubes = ownedSurfaces.map((surface) => partCubeNode(
        document,
        part,
        surface.cuboid,
        surface.faces,
        baseColor,
        input.textureId
      ));
      const collision = foreignSceneNodeCollision(
        prepared.value.document,
        [bone, ...cubes]
      );
      if (collision) {
        return partCompilationFailure(
          'id_collision',
          `scene.nodes.${collision}`,
          `Stable generated node ID "${collision}" is already in use.`
        );
      }
      compiledNodes.push(bone, ...cubes);
    }
  } catch (error) {
    return partCompilationFailure(
      'geometry',
      'parts',
      error instanceof Error ? error.message : 'Part compilation failed.'
    );
  }

  const working = appendPartSceneNodes(
    prepared.value.document,
    compiledNodes
  );
  const validated = readCompiledParts(working);
  if (!validated.ok) {
    return partCompilationFailure(
      'geometry',
      validated.issues[0]?.path ?? 'scene.parts',
      validated.issues[0]?.message ?? 'Compiled model violates part invariants.',
      validated.issues,
      'document'
    );
  }
  const nextIds = compiledNodes.map((node) => node.id).sort(compareStableText);
  const changes = comparePartSceneNodes(
    document,
    working,
    prepared.value.removedIds,
    nextIds
  );
  const changed = changes.createdIds.length > 0 ||
    changes.changedIds.length > 0 || changes.removedIds.length > 0;
  return {
    ok: true,
    document: changed ? working : document,
    projectedParts: projectCompiledFeatures(
      input.parts,
      canonicalized.features
    ),
    ...changes
  };
};
