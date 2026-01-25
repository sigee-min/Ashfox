import { ModelPart } from '../spec';

import { fail, ok, type DomainResult } from './result';

export type RigMergeStrategy = 'error' | 'skip_existing' | 'rename_on_conflict';

export interface RigMergeResult {
  parts: ModelPart[];
  renamed: Record<string, string>;
}

export function mergeRigParts(
  parts: ModelPart[],
  existingIds: Set<string>,
  strategy: RigMergeStrategy
): DomainResult<RigMergeResult> {
  const renamed: Record<string, string> = {};
  const resolved: ModelPart[] = [];

  for (const part of parts) {
    if (!existingIds.has(part.id)) {
      resolved.push(part);
      existingIds.add(part.id);
      continue;
    }

    if (strategy === 'skip_existing') {
      continue;
    }

    if (strategy === 'rename_on_conflict') {
      const nextId = generateUniqueId(part.id, existingIds);
      renamed[part.id] = nextId;
      resolved.push({ ...part, id: nextId });
      existingIds.add(nextId);
      continue;
    }

    return fail('invalid_payload', `Rig template conflict: ${part.id}`);
  }

  return ok({ parts: resolved, renamed });
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
