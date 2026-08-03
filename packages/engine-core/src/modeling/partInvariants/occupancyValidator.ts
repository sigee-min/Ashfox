import { compareStableText } from '../../stableOrder';
import { findSixConnectedComponents } from '../connectivity';
import { createOccupancyGrid } from '../lattice';
import {
  attachmentContactMetric,
  attachmentContactMetrics,
  orthographicContributionMetrics
} from '../partQualityMetrics';
import { compiledPartBoneId } from '../provenance';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './types';

export const validatePartOccupancy = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const owners = new Map<string, string>();
  const contactByPart = new Map(
    attachmentContactMetrics(parts).map((metric) => [metric.partId, metric])
  );
  for (const part of [...parts.values()].sort((left, right) =>
    compareStableText(left.partId, right.partId)
  )) {
    const components = findSixConnectedComponents(part.occupancy);
    if (part.parentPartId === null && components.length !== 1) {
      issues.push({
        code: 'connectivity',
        path: `scene.parts.${part.partId}`,
        message: 'A root part must be one connected semantic form.',
        entityIds: part.cubes.map((cube) => cube.id)
      });
    }
    for (const key of part.occupancy.cells) {
      const owner = owners.get(key);
      if (owner) {
        issues.push({
          code: 'overlap',
          path: `scene.parts.${part.partId}`,
          message: `Canonical emitted parts "${owner}" and "${part.partId}" share an owned cell.`,
          entityIds: [
            compiledPartBoneId(owner),
            compiledPartBoneId(part.partId)
          ]
        });
        break;
      }
      owners.set(key, part.partId);
    }
    if (part.parentPartId) {
      const parent = parts.get(part.parentPartId);
      const contact = contactByPart.get(part.partId);
      if (parent && (!contact || contact.anchorFaceCount === 0)) {
        issues.push({
          code: 'attachment',
          path: `scene.parts.${part.partId}`,
          message: 'A child part must share a full lattice face with its parent.',
          entityIds: [part.bone.id, parent.bone.id]
        });
      }
      if (
        parent &&
        components.some((component) =>
          attachmentContactMetric(
            part.partId,
            parent.partId,
            createOccupancyGrid(part.occupancy.density, component),
            parent.occupancy,
            { x: 0, y: 0, z: 0 }
          ).latticeFaceCount === 0
        )
      ) {
        issues.push({
          code: 'connectivity',
          path: `scene.parts.${part.partId}`,
          message:
            'Every disconnected cuboid group in a child part must contact its semantic parent.',
          entityIds: [part.bone.id, parent.bone.id]
        });
      }
    }
  }
  const visible = new Set(
    orthographicContributionMetrics(parts)
      .filter((metric) => metric.visibleCellCount > 0)
      .map((metric) => metric.partId)
  );
  for (const part of parts.values()) {
    if (!visible.has(part.partId)) {
      issues.push({
        code: 'silhouette',
        path: `scene.parts.${part.partId}`,
        message: 'Every compiled part must contribute to an orthographic silhouette.',
        entityIds: [part.bone.id]
      });
    }
  }
};
