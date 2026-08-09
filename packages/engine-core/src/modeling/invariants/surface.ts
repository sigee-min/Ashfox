import {
  CUBE_FACE_DIRECTIONS,
  type CubeNode,
  type ProjectDocument
} from '../../model';
import { worldToLattice } from '../lattice';
import { classifySurfaceFace } from '../surface/ownership';
import type { CellKey, LatticeBounds } from '../contract';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './contract';

const latticeBounds = (
  document: ProjectDocument,
  cube: CubeNode
): LatticeBounds | null => {
  try {
    const density = document.settings.surfacePixelDensity;
    return {
      min: {
        x: worldToLattice(cube.bounds.from[0], density),
        y: worldToLattice(cube.bounds.from[1], density),
        z: worldToLattice(cube.bounds.from[2], density)
      },
      max: {
        x: worldToLattice(cube.bounds.to[0], density),
        y: worldToLattice(cube.bounds.to[1], density),
        z: worldToLattice(cube.bounds.to[2], density)
      }
    };
  } catch {
    return null;
  }
};

/**
 * Generated geometry is a boundary representation of the canonical occupied
 * solid. Every emitted face must be wholly exterior or wholly interior; a
 * mixed rectangle is not representable by one CubeNode and creates partial
 * coplanar seams. This makes such a document invalid instead of asking a
 * renderer or exporter to guess draw order.
 */
export const validatePartSurfaceOwnership = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const occupancy = new Set<CellKey>(
    [...parts.values()].flatMap((part) => [...part.occupancy.cells])
  );
  for (const part of [...parts.values()].sort((left, right) =>
    left.partId.localeCompare(right.partId)
  )) {
    for (const cube of part.cubes) {
      const bounds = latticeBounds(document, cube);
      if (!bounds) continue;
      for (const direction of CUBE_FACE_DIRECTIONS) {
        const ownership = classifySurfaceFace(bounds, direction, occupancy);
        if (ownership === 'mixed') {
          issues.push({
            code: 'surface',
            path: `scene.nodes.${cube.id}.faces.${direction}`,
            message:
              'A compiled cube face mixes exterior area with an internal ' +
              'seam. Recompile through canonical surface ownership.',
            entityIds: [cube.id]
          });
          continue;
        }
        const expectedEnabled = ownership === 'external';
        if (cube.faces[direction].enabled === expectedEnabled) continue;
        issues.push({
          code: 'surface',
          path: `scene.nodes.${cube.id}.faces.${direction}.enabled`,
          message: expectedEnabled
            ? 'A canonical exterior face must be emitted exactly once.'
            : 'An internal canonical seam must not emit a renderable face.',
          entityIds: [cube.id]
        });
      }
    }
  }
};
