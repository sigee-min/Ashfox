import assert from 'node:assert/strict';

import {
  composeTextureRaster,
  createProjectFromInput,
  executeSystemCommandBatch,
  paintEyeMotifPixel,
  paintFeatureMotifPixel,
  readCompiledParts,
  readPartRecipe,
  validateProjectDocument,
  type CommandBatch,
  type ProjectDocument
} from '../src';

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) => executeSystemCommandBatch(
  document,
  {
    batchId,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  }
);

const empty = createProjectFromInput(
  {
    id: 'surface-eye',
    name: 'Surface eye',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'surface_eye',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'surface-eye-empty'
);

const authored = execute(empty, 'surface-eye-author', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'cranium',
      materialId: 'coat',
      center: [0, 0, -8],
      radii: [4, 4, 3],
      profile: 'hard'
    }, {
      kind: 'mass',
      partId: 'head',
      parentPartId: 'cranium',
      materialId: 'coat',
      center: [0, 0, 0],
      radii: [5, 5, 5],
      profile: 'hard'
    }, {
      kind: 'feature',
      partId: 'eye.left',
      parentPartId: 'head',
      materialId: 'iris.gold',
      motif: 'eye',
      face: 'south',
      anchor: [0, 1, 5],
      size: [4, 3]
    }],
    materials: [{ id: 'coat', baseColor: '#9B5D2E' }, {
      id: 'iris.gold',
      baseColor: '#E6A72F'
    }]
  }
}]);
assert.equal(authored.ok, true);
if (!authored.ok) throw new Error(authored.error.message);

const recipe = readPartRecipe(authored.document);
assert.equal(recipe.ok, true);
if (!recipe.ok || recipe.recipe === null) {
  throw new Error('Surface feature recipe is unavailable.');
}
assert.equal(recipe.recipe.parts.length, 3);
assert.equal(
  recipe.recipe.parts.find((part) => part.partId === 'eye.left')?.kind,
  'feature'
);

const compiled = readCompiledParts(authored.document);
assert.equal(compiled.ok, true);
if (!compiled.ok) throw new Error(compiled.issues[0]?.message);
assert.deepEqual(
  [...compiled.parts.keys()],
  ['cranium', 'head'],
  'a surface feature must not create a bone or geometry part'
);
assert.equal(
  Object.values(authored.document.scene.nodes).some(
    (node) => node.generation?.partId === 'eye.left'
  ),
  false
);

const texture = Object.values(authored.document.textures).find(
  (candidate) => candidate.atlasMode === 'generate'
);
assert.ok(texture);
const composition = composeTextureRaster(authored.document, texture);
const eyeMarkings = composition.regions.flatMap(
  (region) => region.markings ?? []
).filter((marking) => marking.id === 'eye.left');
assert.ok(eyeMarkings.length > 0);
assert.ok(
  eyeMarkings.every((marking) => marking.glyph === 'square'),
  'new semantic eyes default to the square pixel glyph'
);
assert.equal(
  eyeMarkings.reduce(
    (area, marking) => area + marking.width * marking.height,
    0
  ),
  12,
  'one semantic eye must cover its exact 4 × 3 parent-surface rectangle'
);

const report = validateProjectDocument(authored.document);
assert.equal(
  report.findings.some((finding) => finding.severity === 'error'),
  false
);

const iris = { r: 230, g: 167, b: 47 };
assert.equal(paintEyeMotifPixel(iris, 0, 0, 4, 3), null);
assert.notDeepEqual(
  paintEyeMotifPixel(iris, 1, 1, 4, 3),
  paintEyeMotifPixel(iris, 2, 1, 4, 3),
  'the flat glyph must distinguish iris and pupil pixels'
);
const flatIris = paintEyeMotifPixel(iris, 1, 1, 4, 3);
assert.ok(flatIris);
assert.ok(
  flatIris.r > flatIris.g && flatIris.g > flatIris.b,
  'the flat iris cluster must preserve the authored hue'
);
assert.deepEqual(
  paintEyeMotifPixel(iris, 1, 1, 5, 4),
  paintEyeMotifPixel(iris, 3, 1, 5, 4),
  'matching iris roles must use one flat tone without a gloss highlight'
);

const snoutField = paintFeatureMotifPixel(
  'nose',
  { r: 214, g: 158, b: 112 },
  1,
  0,
  4,
  2,
  'snout'
);
assert.ok(snoutField);
assert.deepEqual(
  snoutField,
  paintFeatureMotifPixel(
    'nose',
    { r: 214, g: 158, b: 112 },
    2,
    0,
    4,
    2,
    'snout'
  ),
  'a snout template must use one flat role color across symmetric pixels'
);
assert.notDeepEqual(
  snoutField,
  paintFeatureMotifPixel(
    'nose',
    { r: 214, g: 158, b: 112 },
    1,
    1,
    4,
    2,
    'snout'
  ),
  'a snout template must reserve its centered nose role'
);
assert.deepEqual(
  paintFeatureMotifPixel(
    'mouth',
    { r: 176, g: 70, b: 67 },
    1,
    1,
    3,
    2,
    'fang'
  ),
  { r: 245, g: 239, b: 215 },
  'the fang role must use one flat focal color'
);
assert.notDeepEqual(
  paintFeatureMotifPixel(
    'mouth',
    { r: 224, g: 141, b: 48 },
    1,
    0,
    3,
    2,
    'beak'
  ),
  paintFeatureMotifPixel(
    'mouth',
    { r: 224, g: 141, b: 48 },
    0,
    0,
    3,
    2,
    'beak'
  ),
  'the beak template must derive a dark center division from role colors'
);

const focalFeatures = execute(
  authored.document,
  'surface-focal-features',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'nose.center',
        parentPartId: 'head',
        materialId: 'nose.rose',
        motif: 'nose',
        glyph: 'snout',
        face: 'south',
        anchor: [0, -1, 5],
        size: [4, 2]
      }, {
        kind: 'feature',
        partId: 'mouth.center',
        parentPartId: 'head',
        materialId: 'mouth.rose',
        motif: 'mouth',
        glyph: 'fang',
        face: 'south',
        anchor: [0, -3, 5],
        size: [3, 2]
      }],
      materials: [{
        id: 'nose.rose',
        baseColor: '#D69E70'
      }, {
        id: 'mouth.rose',
        baseColor: '#B04643'
      }]
    }
  }]
);
assert.equal(focalFeatures.ok, true);
if (!focalFeatures.ok) throw new Error(focalFeatures.error.message);
const focalTexture = Object.values(focalFeatures.document.textures).find(
  (candidate) => candidate.atlasMode === 'generate'
);
assert.ok(focalTexture);
const focalMarkings = composeTextureRaster(
  focalFeatures.document,
  focalTexture
).regions.flatMap((region) => region.markings ?? []);
assert.ok(focalMarkings.some(
  (marking) => marking.motif === 'nose' && marking.glyph === 'snout'
));
assert.ok(focalMarkings.some(
  (marking) => marking.motif === 'mouth' && marking.glyph === 'fang'
));
assert.deepEqual(
  [...readCompiledParts(focalFeatures.document).parts.keys()],
  ['cranium', 'head'],
  'nose and mouth templates must remain zero-geometry surface features'
);

const patched = execute(
  authored.document,
  'surface-patch-author',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'muzzle.patch',
        parentPartId: 'head',
        materialId: 'muzzle.cream',
        motif: 'patch',
        face: 'south',
        anchor: [0, -1, 5],
        size: [4, 2]
      }],
      materials: [{
        id: 'muzzle.cream',
        baseColor: '#E7C98D'
      }]
    }
  }]
);
assert.equal(patched.ok, true);
if (!patched.ok) throw new Error(patched.error.message);
const patchedRecipe = readPartRecipe(patched.document);
assert.equal(patchedRecipe.ok, true);
if (!patchedRecipe.ok || patchedRecipe.recipe === null) {
  throw new Error('Surface patch recipe is unavailable.');
}
const muzzlePatch = patchedRecipe.recipe.parts.find(
  (part) => part.partId === 'muzzle.patch'
);
assert.equal(muzzlePatch?.kind, 'feature');
if (muzzlePatch?.kind === 'feature') {
  assert.equal(muzzlePatch.motif, 'patch');
  assert.equal(muzzlePatch.glyph, undefined);
}
const patchedCompiled = readCompiledParts(patched.document);
assert.equal(patchedCompiled.ok, true);
if (!patchedCompiled.ok) throw new Error(patchedCompiled.issues[0]?.message);
assert.deepEqual(
  [...patchedCompiled.parts.keys()],
  ['cranium', 'head'],
  'a semantic surface patch must not add geometry'
);
const patchedTexture = Object.values(patched.document.textures).find(
  (candidate) => candidate.atlasMode === 'generate'
);
assert.ok(patchedTexture);
const patchedComposition = composeTextureRaster(
  patched.document,
  patchedTexture
);
const patchMarkings = patchedComposition.regions.flatMap(
  (region) => region.markings ?? []
).filter((marking) => marking.id === 'muzzle.patch');
assert.ok(patchMarkings.length > 0);
assert.ok(
  patchMarkings.every(
    (marking) =>
      marking.motif === 'patch' && marking.glyph === undefined
  )
);
assert.equal(
  patchMarkings.reduce(
    (area, marking) => area + marking.width * marking.height,
    0
  ),
  8,
  'the system must project the exact semantic patch region'
);

const protrudingFeaturePayload = execute(
  authored.document,
  'surface-eye-relief-rejected',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'eye.left',
        relief: 1
      }]
    }
  }]
);
assert.equal(protrudingFeaturePayload.ok, false);

const outsideParent = execute(
  authored.document,
  'surface-eye-outside-parent',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'eye.left',
        anchor: [5, 5, 5]
      }]
    }
  }]
);
assert.equal(outsideParent.ok, true);
if (outsideParent.ok) {
  const projectedRecipe = readPartRecipe(outsideParent.document);
  assert.equal(projectedRecipe.ok, true);
  assert.deepEqual(
    projectedRecipe.ok
      ? projectedRecipe.recipe?.parts.find(
          (part) => part.partId === 'eye.left'
        )?.anchor
      : null,
    [3, 3, 5],
    'an out-of-bounds preferred anchor must project deterministically'
  );
}

const deleted = execute(
  authored.document,
  'surface-eye-delete',
  [{
    name: 'model.parts.delete',
    payload: { partIds: ['eye.left'] }
  }]
);
assert.equal(deleted.ok, true);
if (!deleted.ok) throw new Error(deleted.error.message);
const deletedRecipe = readPartRecipe(deleted.document);
assert.equal(deletedRecipe.ok, true);
if (!deletedRecipe.ok || deletedRecipe.recipe === null) {
  throw new Error('Deleted surface feature recipe is unavailable.');
}
assert.deepEqual(
  deletedRecipe.recipe.parts.map((part) => part.partId),
  ['cranium', 'head']
);
