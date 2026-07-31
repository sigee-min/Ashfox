import assert from 'node:assert/strict';

import {
  composeTextureRaster,
  createProjectFromInput,
  executeCommandBatch,
  paintEyeMotifPixel,
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
) => executeCommandBatch(
  document,
  {
    batchId,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  },
  { source: 'agent' }
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
      partId: 'head',
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
assert.equal(recipe.recipe.parts.length, 2);
assert.equal(
  recipe.recipe.parts.find((part) => part.partId === 'eye.left')?.kind,
  'feature'
);

const compiled = readCompiledParts(authored.document);
assert.equal(compiled.ok, true);
if (!compiled.ok) throw new Error(compiled.issues[0]?.message);
assert.deepEqual(
  [...compiled.parts.keys()],
  ['head'],
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
  'the derived eye must distinguish highlight and pupil pixels'
);
const compactHighlight = paintEyeMotifPixel(iris, 1, 1, 4, 3);
assert.ok(compactHighlight);
assert.ok(
  compactHighlight.r > compactHighlight.g &&
    compactHighlight.g > compactHighlight.b,
  'a compact eye highlight must preserve the authored iris hue'
);

const protrudingLegacyPayload = execute(
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
assert.equal(protrudingLegacyPayload.ok, false);

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
assert.equal(outsideParent.ok, false);
if (!outsideParent.ok) {
  assert.match(outsideParent.error.message, /outside parent/i);
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
  ['head']
);
