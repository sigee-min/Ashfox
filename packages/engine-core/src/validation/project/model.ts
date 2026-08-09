import type { ProjectDocument } from '../../model';
import {
  readCompiledParts,
  validateCompiledPartEnvironment,
  type PartInvariantCode
} from '../../modeling/invariants';
import { validateCompiledPartRig } from '../../modeling/invariants/rig';
import { validatePartRecipeProjection } from '../../modeling/projection';
import type {
  FindingSink,
  InvariantCode
} from '../contract';

const FINDING_CODES: Readonly<Record<PartInvariantCode, InvariantCode>> = {
  provenance: 'model.part_provenance',
  grid: 'model.part_grid',
  hierarchy: 'model.part_hierarchy',
  connectivity: 'model.part_connectivity',
  attachment: 'model.part_attachment',
  overlap: 'model.part_overlap',
  surface: 'model.part_surface',
  silhouette: 'model.part_silhouette',
  rig: 'model.part_rig',
  budget: 'model.part_budget',
  projection: 'model.part_projection'
};

export const validateModelParts = (
  document: ProjectDocument,
  add: FindingSink
): void => {
  const compiledParts = readCompiledParts(document);
  if (!compiledParts.ok) {
    for (const issue of compiledParts.issues) {
      add({
        code: FINDING_CODES[issue.code],
        severity: 'error',
        message: issue.message,
        path: issue.path,
        entityIds: issue.entityIds,
        clipIds: issue.clipIds,
        fix: 'Correct and recompile the authoritative Intent Program source.'
      });
    }
    return;
  }

  const environmentIssues = [
    ...validateCompiledPartEnvironment(document, compiledParts.parts),
    ...validatePartRecipeProjection(document, compiledParts.parts)
  ];
  validateCompiledPartRig(document, compiledParts.parts, environmentIssues);
  for (const issue of environmentIssues) {
    add({
      code: FINDING_CODES[issue.code],
      severity: 'error',
      message: issue.message,
      path: issue.path,
      entityIds: issue.entityIds,
      clipIds: issue.clipIds,
      fix:
        issue.code === 'rig'
          ? 'Animate stable part bones within their declared joint constraints.'
          : issue.code === 'projection'
            ? 'Regenerate the model through its canonical part recipe.'
            : issue.code === 'overlap'
              ? 'Move or remove foreign geometry that intersects the canonical generated model.'
              : 'Correct the canonical part environment through the registered modeling commands.'
    });
  }
};
