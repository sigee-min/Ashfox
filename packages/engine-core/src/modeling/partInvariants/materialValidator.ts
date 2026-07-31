import { compiledPartBoneId } from '../provenance';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './types';

export const validatePartMaterials = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const colors = new Map<string, { color: string; partId: string }>();
  for (const part of parts.values()) {
    const color = part.cubes[0].baseColor.toLowerCase();
    const existing = colors.get(part.materialId);
    if (existing && existing.color !== color) {
      issues.push({
        code: 'provenance',
        path: `scene.parts.${part.partId}.materialId`,
        message: `Material "${part.materialId}" has conflicting base colors.`,
        entityIds: [
          compiledPartBoneId(existing.partId),
          part.bone.id
        ]
      });
      continue;
    }
    colors.set(part.materialId, { color, partId: part.partId });
  }
};
