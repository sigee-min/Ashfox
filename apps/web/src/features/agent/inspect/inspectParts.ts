import {
  attachmentContactMetrics,
  canonicalizePartOccupancies,
  orthographicContributionMetrics,
  projectSpacePartAuthoringSpec,
  readCompiledParts,
  readPartRecipe,
  type PartSpec,
  type ProjectDocument,
  type ValidationReport
} from '@ashfox/engine-core';

import {
  boundedSuccess
} from '../boundedResult';
import type {
  InspectResult
} from '../types';
import {
  DETAIL_INSPECT_LIMIT,
  INSPECT_ID_LIMIT,
  invalidInspectRequest
} from './inspectResult';

const missingPartId = (
  document: ProjectDocument,
  ids: readonly string[]
): { id: string; index: number } | null => {
  const recipe = readPartRecipe(document);
  const known = new Set(
    recipe.ok && recipe.recipe
      ? recipe.recipe.parts.map((part) => part.partId)
      : []
  );
  const index = ids.findIndex((id) => !known.has(id));
  return index < 0 ? null : { id: ids[index], index };
};

const authoringPartSpec = (
  spec: PartSpec | undefined
) => spec ? projectSpacePartAuthoringSpec(spec) : null;

const compiledPartSummaries = (
  document: ProjectDocument,
  ids: readonly string[],
  report: ValidationReport
): unknown => {
  const compiled = readCompiledParts(document);
  if (!compiled.ok) {
    return {
      valid: false,
      firstIssue: compiled.issues[0] ?? null
    };
  }
  const recipe = readPartRecipe(document);
  if (!recipe.ok) {
    return {
      valid: false,
      firstIssue: recipe.issues[0] ?? null
    };
  }
  const specs = new Map(
    (recipe.recipe?.parts ?? []).map(
      (spec) => [spec.partId, spec]
    )
  );
  const materials = new Map(
    (recipe.recipe?.materials ?? []).map(
      (material) => [material.id, material]
    )
  );
  const canonicalized = recipe.recipe === null
    ? { ok: true as const, parts: [] }
    : canonicalizePartOccupancies(
        recipe.recipe.parts,
        document.settings.surfacePixelDensity
      );
  if (!canonicalized.ok) {
    return {
      valid: false,
      firstIssue: {
        path: `modeling.${canonicalized.path}`,
        message: canonicalized.message
      }
    };
  }
  const canonicalizationByPart = new Map(
    canonicalized.parts.map((part) => [
      part.spec.partId,
      part.metric
    ])
  );
  const contactByPart = new Map(
    attachmentContactMetrics(compiled.parts).map((metric) => [
      metric.partId,
      metric
    ])
  );
  const projectionByPart = new Map<string, unknown[]>();
  for (const metric of orthographicContributionMetrics(compiled.parts)) {
    const entries = projectionByPart.get(metric.partId) ?? [];
    entries.push(metric);
    projectionByPart.set(metric.partId, entries);
  }
  const projectionFinding = report.findings.find(
    (finding) =>
      finding.severity === 'error' &&
      finding.code === 'model.part_projection'
  );
  return {
    valid: projectionFinding === undefined,
    firstIssue: projectionFinding ?? null,
    parts: ids
      .map((id): unknown => {
        const spec = specs.get(id);
        if (!spec) return null;
        if (spec.kind === 'feature') {
          return {
            partId: spec.partId,
            parentPartId: spec.parentPartId,
            materialId: spec.materialId,
            primitive: spec.kind,
            joint: spec.joint,
            spec: authoringPartSpec(spec),
            material: materials.get(spec.materialId) ?? null,
            projection: {
              kind: 'surface',
              motif: spec.motif,
              face: spec.face,
              anchor: spec.anchor,
              size: spec.size
            },
            boneId: null,
            cubeCount: 0,
            modelBounds: null,
            canonicalization: null,
            attachmentContact: null,
            orthographicContribution: []
          };
        }
        const part = compiled.parts.get(id);
        if (!part) return null;
        const from = [0, 1, 2].map((axis) =>
          Math.min(
            ...part.cubes.map((cube) => cube.bounds.from[axis])
          )
        );
        const to = [0, 1, 2].map((axis) =>
          Math.max(
            ...part.cubes.map((cube) => cube.bounds.to[axis])
          )
        );
        return {
          partId: part.partId,
          parentPartId: part.parentPartId,
          materialId: part.materialId,
          primitive: part.primitive,
          joint: part.joint,
          spec: authoringPartSpec(spec),
          material: materials.get(part.materialId) ?? null,
          boneId: part.bone.id,
          cubeCount: part.cubes.length,
          modelBounds: { from, to },
          canonicalization:
            canonicalizationByPart.get(part.partId) ?? null,
          attachmentContact: contactByPart.get(part.partId) ?? null,
          orthographicContribution:
            projectionByPart.get(part.partId) ?? []
        };
      })
      .filter((part) => part !== null)
  };
};

export const inspectParts = (
  document: ProjectDocument,
  ids: readonly string[],
  report: ValidationReport
): InspectResult => {
  if (ids.length > INSPECT_ID_LIMIT) {
    return invalidInspectRequest(
      document.revision,
      'ids',
      `at most ${INSPECT_ID_LIMIT} part IDs`
    );
  }
  const missing = missingPartId(document, ids);
  if (missing) {
    return {
      ok: false,
      revision: document.revision,
      error: {
        code: 'not_found',
        path: `ids[${missing.index}]`,
        expected: 'existing canonical part ID'
      }
    };
  }
  return boundedSuccess(
    document.revision,
    compiledPartSummaries(document, ids, report),
    DETAIL_INSPECT_LIMIT
  );
};
