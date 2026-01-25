import type { ToolError } from '../types';
import type { UsecaseResult } from './result';
import type { RigMergeStrategy } from '../domain/rig';
import type { SessionState } from '../session';
import { ok, fail } from './result';
import { buildRigTemplate } from '../templates';
import { mergeRigParts } from '../domain/rig';
import { isZeroSize } from '../domain/geometry';
import { ensureActiveAndRevision } from './guards';
import { RIG_TEMPLATE_KINDS } from '../shared/toolConstants';

type AddBoneInternal = (
  payload: { name: string; parent?: string; pivot: [number, number, number] },
  options?: { skipRevisionCheck?: boolean }
) => UsecaseResult<{ id: string; name: string }>;

type AddCubeInternal = (
  payload: {
    name: string;
    from: [number, number, number];
    to: [number, number, number];
    bone: string;
    inflate?: number;
    mirror?: boolean;
  },
  options?: { skipRevisionCheck?: boolean }
) => UsecaseResult<{ id: string; name: string }>;

export type ApplyRigTemplateDeps = {
  ensureActive: () => ToolError | null;
  ensureRevisionMatch: (ifRevision?: string) => ToolError | null;
  getSnapshot: () => SessionState;
  getRigMergeStrategy: () => RigMergeStrategy | undefined;
  ensureCubeLimit: (increment: number) => ToolError | null;
  addBoneInternal: AddBoneInternal;
  addCubeInternal: AddCubeInternal;
};

export const applyRigTemplate = (
  deps: ApplyRigTemplateDeps,
  payload: { templateId: string; ifRevision?: string }
): UsecaseResult<{ templateId: string }> => {
  const guardErr = ensureActiveAndRevision(deps.ensureActive, deps.ensureRevisionMatch, payload.ifRevision);
  if (guardErr) return fail(guardErr);
  const templateId = payload.templateId;
  if (!RIG_TEMPLATE_KINDS.includes(templateId as (typeof RIG_TEMPLATE_KINDS)[number])) {
    return fail({ code: 'invalid_payload', message: `Unknown template: ${templateId}` });
  }
  const templateParts = buildRigTemplate(templateId, []);
  const cubeParts = templateParts.filter((part) => !isZeroSize(part.size));
  const limitErr = deps.ensureCubeLimit(cubeParts.length);
  if (limitErr) return fail(limitErr);
  const snapshot = deps.getSnapshot();
  const existing = new Set(snapshot.bones.map((b) => b.name));
  let partsToAdd = templateParts;
  try {
    const merged = mergeRigParts(templateParts, existing, deps.getRigMergeStrategy() ?? 'skip_existing');
    partsToAdd = merged.parts;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'rig template merge failed';
    return fail({ code: 'invalid_payload', message });
  }

  for (const part of partsToAdd) {
    const boneRes = deps.addBoneInternal(
      {
        name: part.id,
        parent: part.parent,
        pivot: part.pivot ?? [0, 0, 0]
      },
      { skipRevisionCheck: true }
    );
    if (!boneRes.ok) return boneRes;
    if (!isZeroSize(part.size)) {
      const from: [number, number, number] = [...part.offset];
      const to: [number, number, number] = [
        part.offset[0] + part.size[0],
        part.offset[1] + part.size[1],
        part.offset[2] + part.size[2]
      ];
      const cubeRes = deps.addCubeInternal(
        {
          name: part.id,
          from,
          to,
          bone: part.id,
          inflate: part.inflate,
          mirror: part.mirror
        },
        { skipRevisionCheck: true }
      );
      if (!cubeRes.ok) return cubeRes;
    }
  }
  return ok({ templateId });
};
