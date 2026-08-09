import type {
  CubeNode,
  ProjectDocument
} from '../../model';
import { isCompiledPartNode } from '../provenance';
import {
  worldBoundsOverlap,
  worldCubeBounds
} from '../world/bounds';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './contract';

export const validateForeignGeometry = (
  document: ProjectDocument,
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const generated = [...parts.values()].flatMap((part) => part.cubes);
  const foreign = Object.values(document.scene.nodes).filter(
    (node): node is CubeNode =>
      node.kind === 'cube' && !isCompiledPartNode(node)
  );
  try {
    for (const cube of generated) {
      const bounds = worldCubeBounds(document, cube);
      const overlap = foreign.find((candidate) =>
        worldBoundsOverlap(bounds, worldCubeBounds(document, candidate))
      );
      if (!overlap) continue;
      issues.push({
        code: 'overlap',
        path: `scene.nodes.${cube.id}.bounds`,
        message: `Compiled cube world bounds overlap foreign cube "${overlap.id}".`,
        entityIds: [cube.id, overlap.id]
      });
      return;
    }
  } catch (error) {
    issues.push({
      code: 'hierarchy',
      path: 'scene.nodes',
      message:
        error instanceof Error
          ? error.message
          : 'World cube bounds could not be evaluated.',
      entityIds: []
    });
  }
};
