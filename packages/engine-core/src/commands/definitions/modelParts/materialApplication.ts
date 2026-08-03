import type {
  ConstrainedModelRecipe,
  ProjectDocument
} from '../../../model';
import { compareStableText } from '../../../stableOrder';
import {
  isPartBaseColor,
  isPartId
} from '../../../modeling/partContract';
import { compilePartScene } from '../../../modeling/partCompiler';
import {
  normalizePartRecipe,
  readPartRecipe,
  withPartRecipe
} from '../../../modeling/partRecipe';
import { ensureGeneratedTexture } from '../../../textures/generatedMaterial';
import type { CommandApplicationResult } from '../../definition';
import type { CommandPayloadMap } from '../../types';

type MaterialPayload = CommandPayloadMap['model.parts.material'];
type ApplicationFailure = Extract<CommandApplicationResult, { ok: false }>;

interface ResolvedMaterial {
  id: string;
  color: string;
}

const canonicalColor = (color: string): string => color.toUpperCase();

const materialForColor = (
  materials: readonly { id: string; baseColor: string }[],
  color: string
): { id: string; baseColor: string } | undefined =>
  materials
    .filter(
      (material) =>
        canonicalColor(material.baseColor) === canonicalColor(color)
    )
    .sort((left, right) => compareStableText(left.id, right.id))[0];

const deriveMaterialId = (
  materials: readonly { id: string }[],
  color: string
): string => {
  const used = new Set(materials.map((material) => material.id));
  const base = `material.${color.slice(1).toLowerCase()}`;
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}.${suffix}`)) suffix += 1;
  return `${base}.${suffix}`;
};

const validatePayload = (
  payload: MaterialPayload
): ApplicationFailure | null => {
  const invalidMaterialId =
    payload.materialId !== undefined &&
    !isPartId(payload.materialId);
  const invalidColor =
    payload.baseColor !== undefined &&
    !isPartBaseColor(payload.baseColor);
  return invalidMaterialId || invalidColor
    ? {
        ok: false,
        error: {
          code: 'invalid_payload',
          message: 'Material ID must be stable lowercase text and color must be #RRGGBB.',
          path: invalidMaterialId
            ? 'payload.materialId'
            : 'payload.baseColor',
          expected: 'lowercase ID or #RRGGBB base color'
        }
      }
    : null;
};

const validateSelectedParts = (
  recipe: ConstrainedModelRecipe,
  partIds: readonly string[]
): ApplicationFailure | null => {
  const missingIndex = partIds.findIndex(
    (partId) =>
      !recipe.parts.some((part) => part.partId === partId)
  );
  if (missingIndex < 0) return null;
  const missingId = partIds[missingIndex];
  return {
    ok: false,
    error: {
      code: 'invalid_state',
      message: `Compiled part "${missingId}" does not exist.`,
      path: `payload.partIds[${missingIndex}]`,
      expected: 'existing canonical part IDs'
    }
  };
};

const resolveMaterial = (
  recipe: ConstrainedModelRecipe,
  payload: MaterialPayload,
  selected: ReadonlySet<string>
): ResolvedMaterial | ApplicationFailure => {
  const requestedMaterial =
    payload.materialId === undefined
      ? undefined
      : recipe.materials.find(
          (material) => material.id === payload.materialId
        );
  if (
    payload.materialId !== undefined &&
    payload.baseColor === undefined &&
    requestedMaterial === undefined
  ) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: `Material "${payload.materialId}" does not exist, so its color cannot be reused.`,
        path: 'payload.materialId',
        expected: 'an existing material ID or a baseColor'
      }
    };
  }
  const requestedColor =
    payload.baseColor === undefined
      ? requestedMaterial?.baseColor
      : canonicalColor(payload.baseColor);
  if (requestedColor === undefined) {
    return {
      ok: false,
      error: {
        code: 'invalid_payload',
        message: 'A material color could not be resolved.',
        path: 'payload.baseColor',
        expected: '#RRGGBB'
      }
    };
  }
  const changesRequestedMaterial =
    requestedMaterial !== undefined &&
    canonicalColor(requestedMaterial.baseColor) !== requestedColor;
  const hasUnselectedRequestedUser =
    requestedMaterial !== undefined &&
    recipe.parts.some(
      (part) =>
        !selected.has(part.partId) &&
        part.materialId === requestedMaterial.id
    );
  const mustFork = changesRequestedMaterial && hasUnselectedRequestedUser;
  const matchingMaterial = materialForColor(
    recipe.materials,
    requestedColor
  );
  const id =
    payload.materialId === undefined
      ? matchingMaterial?.id ??
        deriveMaterialId(recipe.materials, requestedColor)
      : mustFork
        ? matchingMaterial?.id ??
          deriveMaterialId(recipe.materials, requestedColor)
        : payload.materialId;
  return { id, color: requestedColor };
};

const compileMaterialChange = (
  document: ProjectDocument,
  recipe: ConstrainedModelRecipe,
  material: ResolvedMaterial,
  selected: ReadonlySet<string>,
  selectedCount: number
): CommandApplicationResult => {
  const nextParts = recipe.parts.map((part) =>
    selected.has(part.partId)
      ? { ...part, materialId: material.id }
      : part
  );
  const nextMaterials = [
    ...recipe.materials.filter((entry) => entry.id !== material.id),
    { id: material.id, baseColor: material.color }
  ];
  const normalized = normalizePartRecipe(nextParts, nextMaterials);
  if (!normalized.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_state',
        message: normalized.issues[0]?.message ??
          'Updated modeling recipe is invalid.',
        path: 'payload.partIds',
        expected: 'a valid complete material reassignment'
      }
    };
  }
  const setup = ensureGeneratedTexture(document);
  const compiled = compilePartScene(setup.document, {
    parts: normalized.recipe.parts,
    materials: normalized.recipe.materials,
    textureId: setup.textureId
  });
  if (!compiled.ok) {
    return {
      ok: false,
      error: {
        code: 'invalid_state',
        message: compiled.message,
        path:
          compiled.pathScope === 'document'
            ? compiled.path
            : `payload.${compiled.path}`,
        pathScope:
          compiled.pathScope === 'document'
            ? 'document'
            : 'operation'
      }
    };
  }
  const projected = withPartRecipe(compiled.document, {
    ...normalized.recipe,
    parts: compiled.projectedParts
  });
  const recipeChanged = projected !== compiled.document;
  return {
    ok: true,
    value: {
      document: projected,
      summary:
        `Set material ${material.id} on ` +
        `${selectedCount} part` +
        `${selectedCount === 1 ? '' : 's'}`,
      effects: {
        createdEntityIds: [
          ...(setup.createdTextureId ? [setup.createdTextureId] : []),
          ...compiled.createdIds
        ],
        changedEntityIds: recipeChanged
          ? [...compiled.changedIds, document.id]
          : compiled.changedIds,
        removedEntityIds: compiled.removedIds,
        invalidated: [
          'scene',
          'textures',
          'uv',
          'validation',
          'preview'
        ]
      }
    }
  };
};

export const applySetModelPartMaterial = (
  document: ProjectDocument,
  payload: MaterialPayload
): CommandApplicationResult => {
  const payloadIssue = validatePayload(payload);
  if (payloadIssue) return payloadIssue;
  const current = readPartRecipe(document);
  if (!current.ok || current.recipe === null) {
    return {
      ok: false,
      error: {
        code: 'invalid_state',
        message:
          current.ok
            ? 'Canonical modeling recipe does not exist.'
            : current.issues[0]?.message ??
              'Canonical modeling recipe is invalid.',
        path:
          current.ok
            ? 'modeling'
            : current.issues[0]?.path ?? 'modeling',
        pathScope: 'document'
      }
    };
  }
  const partIssue = validateSelectedParts(current.recipe, payload.partIds);
  if (partIssue) return partIssue;
  const selected = new Set(payload.partIds);
  const material = resolveMaterial(current.recipe, payload, selected);
  if ('ok' in material) return material;
  return compileMaterialChange(
    document,
    current.recipe,
    material,
    selected,
    payload.partIds.length
  );
};
