import { compiledPartBoneId } from '../provenance';
import type {
  CompiledPartState,
  PartInvariantIssue
} from './contract';

export const validatePartHierarchy = (
  parts: ReadonlyMap<string, CompiledPartState>,
  issues: PartInvariantIssue[]
): void => {
  const roots = [...parts.values()].filter(
    (part) => part.parentPartId === null
  );
  if (parts.size > 0 && roots.length !== 1) {
    issues.push({
      code: 'hierarchy',
      path: 'scene.parts',
      message: 'A compiled model must contain exactly one root part.',
      entityIds: roots.map((part) => part.bone.id)
    });
  }
  for (const part of parts.values()) {
    const expectedParentId =
      part.parentPartId === null
        ? null
        : compiledPartBoneId(part.parentPartId);
    if (
      part.bone.parentId !== expectedParentId ||
      (part.parentPartId !== null && !parts.has(part.parentPartId))
    ) {
      issues.push({
        code: 'hierarchy',
        path: `scene.nodes.${part.bone.id}.parentId`,
        message: 'Compiled part parent must reference the stable parent-part bone.',
        entityIds: [part.bone.id]
      });
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (partId: string): void => {
    if (visited.has(partId)) return;
    if (visiting.has(partId)) {
      issues.push({
        code: 'hierarchy',
        path: `scene.parts.${partId}`,
        message: 'Compiled part hierarchy contains a cycle.',
        entityIds: [compiledPartBoneId(partId)]
      });
      return;
    }
    visiting.add(partId);
    const parentId = parts.get(partId)?.parentPartId;
    if (parentId && parts.has(parentId)) visit(parentId);
    visiting.delete(partId);
    visited.add(partId);
  };
  [...parts.keys()].sort().forEach(visit);
};
