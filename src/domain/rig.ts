import { ModelPart } from '../spec';

export type RigMergeStrategy = 'error' | 'skip_existing' | 'rename_on_conflict';

export interface RigMergeResult {
  parts: ModelPart[];
  renamed: Record<string, string>;
}

export function mergeRigParts(
  parts: ModelPart[],
  existingIds: Set<string>,
  strategy: RigMergeStrategy
): RigMergeResult {
  const renamed: Record<string, string> = {};
  const resolved: ModelPart[] = [];

  parts.forEach((part) => {
    if (!existingIds.has(part.id)) {
      resolved.push(part);
      existingIds.add(part.id);
      return;
    }

    if (strategy === 'skip_existing') {
      return;
    }

    if (strategy === 'rename_on_conflict') {
      const nextId = generateUniqueId(part.id, existingIds);
      renamed[part.id] = nextId;
      resolved.push({ ...part, id: nextId });
      existingIds.add(nextId);
      return;
    }

    if (strategy === 'error') {
      throw new Error(`Rig template conflict: ${part.id}`);
    }
  });

  return { parts: resolved, renamed };
}

function generateUniqueId(base: string, existing: Set<string>): string {
  let index = 1;
  let candidate = `${base}_${index}`;
  while (existing.has(candidate)) {
    index += 1;
    candidate = `${base}_${index}`;
  }
  return candidate;
}
