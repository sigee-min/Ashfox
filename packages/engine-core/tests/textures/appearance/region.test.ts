import assert from 'node:assert/strict';

import type { AuthoringSlotAssignment } from '../../../src/authoring/contract';
import { materializeIntentProgram } from '../../../src/compiler/program';
import type {
  CubeNode,
  ProjectDocument
} from '../../../src/model';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import {
  generatedSurfaceFaceKey,
  type CompiledFaceAuthority,
  type GeneratedSurfacePattern
} from '../../../src/textures/appearance/authority';
import { selectedSurfaceMarkingAt } from '../../../src/textures/appearance/budget';
import { surfaceMarkingAt } from '../../../src/textures/appearance/marks';
import { generatedSurfacePixel } from '../../../src/textures/appearance/pixel';
import {
  buildSurfaceAppearanceRegionAuthority
} from '../../../src/textures/appearance/region';
import {
  compileTextureSurfaceAuthority,
  exactGeneratedTexelSize
} from '../../../src/textures/textureRecipe/surfaceMetrics';
import type { TextureCompositionRegion } from '../../../src/textures/textureRecipe/types';

const source = (
  shaped: boolean,
  appearance: boolean
): string => [
  'metadata {',
  '  name "Semantic fin skin"',
  '  track essential',
  '  domain organism',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core torso',
  '  }',
  '  surface fins paired fin parent torso anchor sides growth outward lane center',
  ...(shaped ? [
    '  shape fins {',
    '    axis longitudinal',
    '    span medium',
    '    chord broad',
    '    tip pointed',
    '    offset posterior',
    '    edge convex',
    '  }'
  ] : []),
  '  face {',
  '    none',
  '  }',
  '}',
  'animation {',
  '  idle still',
  '}',
  'appearance {',
  '  palette ocean',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed auto',
  ...(appearance ? [
    '  mark skin target surface fins region full placement whole as wash ' +
      'tone darker scale broad density rich contrast medium'
  ] : []),
  '}'
].join('\n');

const materialize = (value: string, id: string): ProjectDocument => {
  const parsed = parseIntentProgram(value);
  assert.deepEqual(parsed.diagnostics, []);
  assert.ok(parsed.hash);
  const result = materializeIntentProgram(createProjectDocument({
    id,
    name: id,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source: value, hash: parsed.hash });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

type SupportedSlot = AuthoringSlotAssignment & {
  readonly span: Extract<
    AuthoringSlotAssignment['span'],
    { readonly kind: 'supported-surface' }
  >;
};

const supportedSlots = (
  document: ProjectDocument
): readonly SupportedSlot[] =>
  (document.authoringProfile?.slots ?? []).filter(
    (slot): slot is SupportedSlot => slot.span.kind === 'supported-surface'
  );

const membranePartIds = (slot: SupportedSlot): readonly string[] =>
  slot.span.membranes.flatMap((membrane) => membrane.partIds);

interface SkinFace {
  readonly node: CubeNode;
  readonly partId: string;
  readonly width: number;
  readonly height: number;
  readonly authority: CompiledFaceAuthority & {
    readonly pattern: GeneratedSurfacePattern;
  };
}

const topSkinFaces = (
  document: ProjectDocument,
  slot: SupportedSlot
): readonly SkinFace[] => {
  const partIds = new Set(membranePartIds(slot));
  const compiled = compileTextureSurfaceAuthority(document);
  return Object.values(document.scene.nodes).flatMap((node) => {
    if (
      node.kind !== 'cube' ||
      !node.generation ||
      !partIds.has(node.generation.partId)
    ) return [];
    const authority = compiled.faces.get(
      generatedSurfaceFaceKey(node.id, 'up')
    );
    const size = exactGeneratedTexelSize(document, node, 'up');
    if (!authority?.pattern || !size) return [];
    return [{
      node,
      partId: node.generation.partId,
      width: size.width,
      height: size.height,
      authority: {
        ...authority,
        pattern: authority.pattern
      }
    }];
  });
};

const selectedMark = (
  pattern: GeneratedSurfacePattern,
  u: number,
  v: number
): string | null => {
  const field = pattern.toneField;
  const marking = field.markingMasks === undefined
    ? surfaceMarkingAt(field.appearance, u, v)
    : selectedSurfaceMarkingAt(field.markingMasks, u, v);
  return marking?.id ?? null;
};

interface SkinTexel {
  readonly partId: string;
  readonly mark: string | null;
  readonly color: ReturnType<typeof generatedSurfacePixel>;
}

const skinTexels = (
  document: ProjectDocument,
  slot: SupportedSlot
): ReadonlyMap<string, SkinTexel> => {
  const texels = new Map<string, SkinTexel>();
  for (const face of topSkinFaces(document, slot)) {
    const pattern = face.authority.pattern;
    const region: TextureCompositionRegion = {
      nodeId: face.node.id,
      face: 'up',
      tonePolicy: face.authority.tonePolicy,
      x: 0,
      y: 0,
      width: face.width,
      height: face.height,
      color: face.node.baseColor,
      pattern
    };
    for (let y = 0; y < face.height; y += 1) {
      for (let x = 0; x < face.width; x += 1) {
        const u = pattern.origin[0] + x;
        const v = pattern.origin[1] + y;
        texels.set(`${u},${v}`, {
          partId: face.partId,
          mark: selectedMark(pattern, u, v),
          color: generatedSurfacePixel(region, x, y)
        });
      }
    }
  }
  return texels;
};

const shaped = materialize(source(true, true), 'semantic-fin-shaped');
const shapedSlots = supportedSlots(shaped);
assert.equal(shapedSlots.length, 2);
for (const slot of shapedSlots) {
  const parts = membranePartIds(slot);
  assert.ok(parts.length > 1, 'custom shape must decompose its membrane');
  const regions = buildSurfaceAppearanceRegionAuthority(shaped);
  const mapped = parts.map((partId) => regions.regionFor(partId));
  assert.ok(mapped.every((region) => region?.composite));
  assert.equal(new Set(mapped.map((region) => region?.semanticOwnerKey)).size, 1);
  assert.ok(mapped.every(Object.isFrozen));
  assert.ok(mapped.every((region) => Object.isFrozen(region?.partIds)));

  const faces = topSkinFaces(shaped, slot);
  assert.ok(faces.length > parts.length);
  assert.equal(
    new Set(faces.map((face) => face.authority.pattern.toneField)).size,
    1,
    'all convex pieces in one membrane must spend one shared field budget'
  );
  assert.equal(
    new Set(faces.map((face) => face.authority.pattern.seedKey)).size,
    1,
    'all convex pieces in one membrane must share one component seed'
  );
  assert.equal(
    new Set(faces.map((face) =>
      face.authority.pattern.toneField.appearance.semanticOwnerKey
    )).size,
    1
  );
  assert.ok(faces.every((face) =>
    face.authority.pattern.toneField.appearance.semanticRegion === 'membrane'
  ));

  const texels = skinTexels(shaped, slot);
  let markedBoundary: readonly [SkinTexel, SkinTexel] | null = null;
  for (const [key, texel] of texels) {
    const [u = 0, v = 0] = key.split(',').map(Number);
    for (const neighborKey of [`${u + 1},${v}`, `${u},${v + 1}`]) {
      const neighbor = texels.get(neighborKey);
      if (
        neighbor &&
        neighbor.partId !== texel.partId &&
        texel.mark === 'skin' &&
        neighbor.mark === 'skin'
      ) {
        markedBoundary = [texel, neighbor];
        break;
      }
    }
    if (markedBoundary) break;
  }
  assert.ok(
    markedBoundary,
    'the compiled wash must cross a real convex membrane-part boundary'
  );
  assert.deepEqual(
    markedBoundary[0].color,
    markedBoundary[1].color,
    'semantic mark color cannot restart at a decomposition seam'
  );
}

const left = shapedSlots.find((slot) => slot.slotId.endsWith('.left'));
const right = shapedSlots.find((slot) => slot.slotId.endsWith('.right'));
assert.ok(left && right);
const leftFaces = topSkinFaces(shaped, left);
const rightFaces = topSkinFaces(shaped, right);
const leftAppearance = leftFaces[0]?.authority.pattern.toneField.appearance;
const rightAppearance = rightFaces[0]?.authority.pattern.toneField.appearance;
assert.ok(leftAppearance && rightAppearance);
assert.notEqual(leftAppearance.semanticOwnerKey, rightAppearance.semanticOwnerKey);
const reflection = leftAppearance.markings?.[0]?.reflection;
assert.ok(reflection && reflection.axis === 'x');
const compiledMarks = (
  faces: readonly SkinFace[]
): ReadonlyMap<string, string | null> => {
  const marks = new Map<string, string | null>();
  for (const face of faces) {
    const pattern = face.authority.pattern;
    for (let y = 0; y < face.height; y += 1) {
      for (let x = 0; x < face.width; x += 1) {
        const u = pattern.origin[0] + x;
        const v = pattern.origin[1] + y;
        marks.set(
          `${u},${v}`,
          selectedMark(pattern, u, v)
        );
      }
    }
  }
  return marks;
};
const leftMarks = compiledMarks(leftFaces);
const rightMarks = compiledMarks(rightFaces);
for (const [key, mark] of leftMarks) {
  const [u = 0, v = 0] = key.split(',').map(Number);
  const reflectedCoordinate: string =
    `${reflection.planeTwice - u - 1},${v}`;
  assert.equal(
    rightMarks.get(reflectedCoordinate),
    mark,
    'paired compiled membrane marks must reflect exactly in object space'
  );
}

const renameCompositeParts = (
  document: ProjectDocument
): ProjectDocument => {
  const compositeIds = supportedSlots(document)
    .flatMap(membranePartIds)
    .sort();
  const renamed = new Map(compositeIds.map((partId, index) => [
    partId,
    `surface.skin.piece.${String(index + 1).padStart(2, '0')}`
  ]));
  const rename = (partId: string | null): string | null =>
    partId === null ? null : renamed.get(partId) ?? partId;
  if (!document.modeling || !document.authoringProfile || !document.intent) {
    throw new Error('Custom surface fixture is incomplete.');
  }
  const parts = document.modeling.parts.map((part) => ({
    ...part,
    partId: rename(part.partId)!,
    parentPartId: rename(part.parentPartId)
  })).sort((first, second) => first.partId.localeCompare(second.partId));
  const slots = [...document.authoringProfile.slots].reverse().map((slot) => ({
    ...slot,
    partIds: [...slot.partIds].reverse().map((partId) => rename(partId)!),
    span: slot.span.kind === 'supported-surface' ? {
      ...slot.span,
      rootPartIds: slot.span.rootPartIds.map((partId) => rename(partId)!),
      spars: slot.span.spars.map((spar) => ({
        ...spar,
        partIds: spar.partIds.map((partId) => rename(partId)!)
      })),
      membranes: slot.span.membranes.map((membrane) => ({
        ...membrane,
        partIds: [...membrane.partIds]
          .reverse()
          .map((partId) => rename(partId)!)
      }))
    } : slot.span
  }));
  const nodes = Object.fromEntries(Object.values(document.scene.nodes)
    .reverse()
    .map((node) => [node.id, node.generation ? {
      ...node,
      generation: {
        ...node.generation,
        partId: rename(node.generation.partId)!,
        parentPartId: rename(node.generation.parentPartId)
      }
    } : node]));
  return {
    ...document,
    modeling: { ...document.modeling, parts },
    authoringProfile: { ...document.authoringProfile, slots },
    scene: { ...document.scene, nodes },
    intent: {
      ...document.intent,
      appearanceBindings: document.intent.appearanceBindings?.map((binding) => ({
        ...binding,
        partIds: [...binding.partIds]
          .reverse()
          .map((partId) => rename(partId)!)
      }))
    }
  };
};

const skinProjection = (
  document: ProjectDocument
): readonly (readonly [string, string])[] => supportedSlots(document)
  .flatMap((slot) => [...skinTexels(document, slot)].map(([key, texel]) => [
    `${slot.slotId}:${key}`,
    `${texel.mark ?? '-'}:${texel.color.r},${texel.color.g},${texel.color.b}`
  ] as const))
  .sort(([left], [right]) => left.localeCompare(right));

const reordered = renameCompositeParts(shaped);
assert.deepEqual(
  skinProjection(reordered),
  skinProjection(shaped),
  'part IDs, emitted-node order, and authoring slot order cannot move skin pixels'
);
const shapedSeed = leftAppearance.seed;
const reorderedLeft = supportedSlots(reordered).find(
  (slot) => slot.slotId === left.slotId
);
assert.ok(reorderedLeft);
assert.deepEqual(
  topSkinFaces(reordered, reorderedLeft)[0]
    ?.authority.pattern.toneField.appearance.seed,
  shapedSeed,
  'automatic appearance seed must consume semantic membrane identity'
);

const legacy = materialize(source(false, false), 'semantic-fin-legacy');
const legacyRegions = buildSurfaceAppearanceRegionAuthority(legacy);
assert.equal(legacyRegions.hasCompositeRegions, false);
for (const slot of supportedSlots(legacy)) {
  const partIds = membranePartIds(slot);
  assert.equal(partIds.length, 1);
  const partId = partIds[0]!;
  const region = legacyRegions.regionFor(partId);
  assert.equal(region?.semanticOwnerKey, partId);
  assert.deepEqual(region?.attachmentPartIds, [partId]);
  for (const face of topSkinFaces(legacy, slot)) {
    assert.equal(
      face.authority.pattern.toneField.appearance.semanticOwnerKey,
      partId,
      'shape-less V1 must retain its exact part-owned appearance path'
    );
    assert.equal(
      face.authority.pattern.toneField.appearance.semanticRegion,
      undefined
    );
  }
}
