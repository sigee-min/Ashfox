import type {
  ConstrainedModelRecipe,
  ProjectDocument
} from '../model';
import { compareStableText } from '../stableOrder';
import {
  isPartBaseColor,
  isPartId,
  normalizePartSpecs,
  PART_CONTRACT_LIMITS,
  type PartMaterialDefinition,
  type PartSpec
} from './partContract';

export interface PartRecipeIssue {
  path: string;
  message: string;
}

export type NormalizePartRecipeResult =
  | {
      ok: true;
      recipe: ConstrainedModelRecipe;
    }
  | {
      ok: false;
      issues: readonly PartRecipeIssue[];
    };

export type ReadPartRecipeResult =
  | {
      ok: true;
      recipe: ConstrainedModelRecipe | null;
    }
  | {
      ok: false;
      issues: readonly PartRecipeIssue[];
    };

const isRecord = (
  value: unknown
): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort(compareStableText)
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson(value[key])}`
      )
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const normalizeMaterials = (
  input: unknown,
  usedMaterialIds: ReadonlySet<string>
):
  | {
      ok: true;
      materials: readonly PartMaterialDefinition[];
    }
  | {
      ok: false;
      issues: readonly PartRecipeIssue[];
    } => {
  if (!Array.isArray(input)) {
    return {
      ok: false,
      issues: [{
        path: 'modeling.materials',
        message: 'Canonical model materials must be an array.'
      }]
    };
  }
  const issues: PartRecipeIssue[] = [];
  const materials = new Map<string, PartMaterialDefinition>();
  input.forEach((entry, index) => {
    const path = `modeling.materials[${index}]`;
    if (
      !isRecord(entry) ||
      Object.keys(entry).some(
        (key) => key !== 'id' && key !== 'baseColor'
      ) ||
      !isPartId(entry.id) ||
      !isPartBaseColor(entry.baseColor)
    ) {
      issues.push({
        path,
        message:
          'Each material requires only a stable ID and #RRGGBB base color.'
      });
      return;
    }
    if (materials.has(entry.id)) {
      issues.push({
        path: `${path}.id`,
        message: `Material ID "${entry.id}" is duplicated.`
      });
      return;
    }
    materials.set(entry.id, {
      id: entry.id,
      baseColor: entry.baseColor.toUpperCase()
    });
  });
  for (const materialId of usedMaterialIds) {
    if (!materials.has(materialId)) {
      issues.push({
        path: 'modeling.materials',
        message:
          `Part material "${materialId}" has no canonical color definition.`
      });
    }
  }
  if (issues.length > 0) return { ok: false, issues };
  return {
    ok: true,
    materials: [...materials.values()]
      .filter((material) => usedMaterialIds.has(material.id))
      .sort((left, right) => compareStableText(left.id, right.id))
  };
};

const validateCompleteHierarchy = (
  parts: readonly PartSpec[]
): readonly PartRecipeIssue[] => {
  const issues: PartRecipeIssue[] = [];
  const partIds = new Set(parts.map((part) => part.partId));
  const roots = parts.filter((part) => part.parentPartId === null);
  if (roots.length !== 1) {
    issues.push({
      path: 'modeling.parts',
      message: 'Canonical modeling recipe requires exactly one root part.'
    });
  }
  parts.forEach((part, index) => {
    if (
      part.parentPartId !== null &&
      !partIds.has(part.parentPartId)
    ) {
      issues.push({
        path: `modeling.parts[${index}].parentPartId`,
        message:
          `Parent part "${part.parentPartId}" does not exist in the canonical recipe.`
      });
    }
  });
  return issues;
};

export const normalizePartRecipe = (
  parts: unknown,
  materials: unknown
): NormalizePartRecipeResult => {
  const normalizedParts = normalizePartSpecs(parts, {
    maxParts: PART_CONTRACT_LIMITS.maxPartsPerDocument,
    maxOccupancyCells:
      PART_CONTRACT_LIMITS.maxOccupancyCellsPerDocument
  });
  if (!normalizedParts.ok) {
    return {
      ok: false,
      issues: normalizedParts.issues.map((issue) => ({
        path: `modeling.parts${issue.path.slice(1)}`,
        message: issue.message
      }))
    };
  }
  const orderedParts = [...normalizedParts.value].sort(
    (left, right) => compareStableText(left.partId, right.partId)
  );
  const hierarchyIssues = validateCompleteHierarchy(orderedParts);
  if (hierarchyIssues.length > 0) {
    return {
      ok: false,
      issues: hierarchyIssues
    };
  }
  const normalizedMaterials = normalizeMaterials(
    materials,
    new Set(orderedParts.map((part) => part.materialId))
  );
  if (!normalizedMaterials.ok) return normalizedMaterials;
  return {
    ok: true,
    recipe: {
      authority: 'ashfox.part-compiler',
      parts: orderedParts,
      materials: normalizedMaterials.materials
    }
  };
};

export const readPartRecipe = (
  document: ProjectDocument
): ReadPartRecipeResult => {
  const value = document.modeling;
  if (value === undefined) return { ok: true, recipe: null };
  if (
    !isRecord(value) ||
    value.authority !== 'ashfox.part-compiler' ||
    Object.keys(value).some(
      (key) =>
        key !== 'authority' &&
        key !== 'parts' &&
        key !== 'materials'
    )
  ) {
    return {
      ok: false,
      issues: [{
        path: 'modeling',
        message:
          'Modeling recipe must use the ashfox part compiler authority.'
      }]
    };
  }
  const normalized = normalizePartRecipe(
    value.parts,
    value.materials
  );
  if (!normalized.ok) return normalized;
  if (canonicalJson(value) !== canonicalJson(normalized.recipe)) {
    return {
      ok: false,
      issues: [{
        path: 'modeling',
        message:
          'Modeling recipe must be normalized, sorted, and contain only used materials.'
      }]
    };
  }
  return normalized;
};

export const withPartRecipe = (
  document: ProjectDocument,
  recipe: ConstrainedModelRecipe | null
): ProjectDocument => {
  if (recipe === null) {
    if (document.modeling === undefined) return document;
    const { modeling: _removed, ...withoutRecipe } = document;
    return withoutRecipe;
  }
  if (
    document.modeling !== undefined &&
    canonicalJson(document.modeling) === canonicalJson(recipe)
  ) {
    return document;
  }
  return {
    ...document,
    modeling: recipe
  };
};
