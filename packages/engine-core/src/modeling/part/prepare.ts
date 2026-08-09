import type { ProjectDocument } from '../../model';
import { compareStableText } from '../../stableOrder';
import { readCompiledParts, type CompiledPartState } from '../invariants';
import type { PartMaterialDefinition } from './index';
import {
  partCompilationFailure,
  type CompilePartSceneFailure,
  type CompilePartSceneInput
} from './compilation';
import { isCompiledPartNode } from '../provenance';

export interface PreparedPartCompilation {
  readonly colors: ReadonlyMap<string, string>;
  readonly document: ProjectDocument;
  readonly removedIds: readonly string[];
}

export type PreparePartCompilationResult =
  | { readonly ok: true; readonly value: PreparedPartCompilation }
  | CompilePartSceneFailure;

const resolveMaterialColors = (
  existingParts: ReadonlyMap<string, CompiledPartState>,
  inputs: readonly PartMaterialDefinition[],
  replacedPartIds: ReadonlySet<string>
): { readonly ok: true; readonly colors: ReadonlyMap<string, string> } |
  CompilePartSceneFailure => {
  const colors = new Map<string, string>();
  for (const part of existingParts.values()) {
    if (replacedPartIds.has(part.partId)) continue;
    const color = part.cubes[0]?.baseColor;
    if (!color) continue;
    const current = colors.get(part.materialId);
    if (current && current.toLowerCase() !== color.toLowerCase()) {
      return partCompilationFailure(
        'invalid_existing_model',
        `scene.parts.${part.partId}.materialId`,
        `Material "${part.materialId}" has conflicting base colors.`
      );
    }
    colors.set(part.materialId, color);
  }
  for (const input of inputs) {
    const current = colors.get(input.id);
    if (current && current.toLowerCase() !== input.baseColor.toLowerCase()) {
      return partCompilationFailure(
        'geometry',
        `materials.${input.id}`,
        'Recompile the Intent Program to change a generated material palette.'
      );
    }
    colors.set(input.id, input.baseColor);
  }
  return { ok: true, colors };
};

const stripReplacedPartNodes = (
  document: ProjectDocument,
  replacedPartIds: ReadonlySet<string>
): { readonly document: ProjectDocument; readonly removedIds: readonly string[] } => {
  const removedIds = Object.values(document.scene.nodes)
    .filter((node) => isCompiledPartNode(node) &&
      node.generation !== undefined &&
      replacedPartIds.has(node.generation.partId))
    .map((node) => node.id)
    .sort(compareStableText);
  const removed = new Set(removedIds);
  return {
    document: {
      ...document,
      scene: {
        roots: document.scene.roots.filter((nodeId) => !removed.has(nodeId)),
        nodes: Object.fromEntries(Object.entries(document.scene.nodes)
          .filter(([nodeId]) => !removed.has(nodeId)))
      }
    },
    removedIds
  };
};

/** Reads and validates every existing-document dependency before emission. */
export const preparePartCompilation = (
  document: ProjectDocument,
  input: CompilePartSceneInput
): PreparePartCompilationResult => {
  const existing = readCompiledParts(document);
  if (!existing.ok) {
    return partCompilationFailure(
      'invalid_existing_model',
      existing.issues[0]?.path ?? 'scene.parts',
      'Existing compiled model violates part invariants.',
      existing.issues,
      'document'
    );
  }
  const replacedPartIds = new Set(input.parts.map((part) => part.partId));
  const colors = resolveMaterialColors(
    existing.parts, input.materials, replacedPartIds
  );
  if (!colors.ok) return colors;
  if ([...existing.parts.keys()].some((partId) => !replacedPartIds.has(partId))) {
    return partCompilationFailure(
      'geometry',
      'parts',
      'Part compilation requires the complete canonical part recipe.'
    );
  }
  const stripped = stripReplacedPartNodes(document, replacedPartIds);
  return {
    ok: true,
    value: {
      colors: colors.colors,
      document: stripped.document,
      removedIds: stripped.removedIds
    }
  };
};

export interface SceneNodeChanges {
  readonly createdIds: readonly string[];
  readonly changedIds: readonly string[];
  readonly removedIds: readonly string[];
}

export const comparePartSceneNodes = (
  before: ProjectDocument,
  after: ProjectDocument,
  oldIds: readonly string[],
  newIds: readonly string[]
): SceneNodeChanges => {
  const oldSet = new Set(oldIds);
  const nextSet = new Set(newIds);
  return {
    createdIds: newIds.filter((id) => !oldSet.has(id)),
    changedIds: newIds.filter((id) => oldSet.has(id) &&
      JSON.stringify(before.scene.nodes[id]) !== JSON.stringify(after.scene.nodes[id])),
    removedIds: oldIds.filter((id) => !nextSet.has(id))
  };
};
