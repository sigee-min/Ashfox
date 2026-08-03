import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  measureDocumentFormComposition,
  measureFormComposition,
  readPartRecipe,
  type CommandBatch,
  type ProjectDocument,
  type SceneNode
} from '../src';

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) => executeCommandBatch(document, {
  batchId,
  baseProjectId: document.id,
  baseRevision: document.revision,
  operations
}, { source: 'agent' });

const emptyProject = (id: string): ProjectDocument =>
  createProjectFromInput({
    id,
    name: 'Iconic form',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: id.replaceAll('-', '_'),
    createdAt: '2026-08-03T00:00:00.000Z'
  }, `${id}-revision`);

const iconic = execute(
  emptyProject('iconic-form-defaults'),
  'iconic-form-author',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'head',
        parentPartId: null,
        materialId: 'coat',
        center: [0, 0, 0],
        radii: [3, 3, 2]
      }, {
        kind: 'feature',
        partId: 'eye.left',
        parentPartId: 'head',
        materialId: 'eye',
        motif: 'eye',
        face: 'north',
        anchor: [0, 0, -2],
        size: [2, 2]
      }],
      materials: [{ id: 'coat', baseColor: '#8A6A44' }, {
        id: 'eye',
        baseColor: '#D9F36A'
      }]
    }
  }]
);
assert.equal(iconic.ok, true);
if (!iconic.ok) throw new Error(iconic.error.message);

const recipe = readPartRecipe(iconic.document);
assert.equal(recipe.ok, true);
if (!recipe.ok || recipe.recipe === null) {
  throw new Error('Iconic recipe is unavailable.');
}
const head = recipe.recipe.parts.find((part) => part.partId === 'head');
const eye = recipe.recipe.parts.find((part) => part.partId === 'eye.left');
assert.equal(head?.kind === 'mass' ? head.profile : null, 'block');
assert.equal(eye?.kind === 'feature' ? eye.glyph : null, 'square');
assert.deepEqual(
  measureDocumentFormComposition(iconic.document),
  {
    compiledCuboids: 1,
    semanticParts: 1,
    cellScaleCuboids: 0,
    parts: [{
      partId: 'head',
      compiledCuboids: 1,
      cellScaleCuboids: 0
    }]
  },
  'one semantic block mass ordinarily compiles to one cuboid'
);

const roundedMass = execute(
  emptyProject('iconic-form-rounded'),
  'iconic-form-rounded-author',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'body',
        parentPartId: null,
        materialId: 'coat',
        center: [0, 0, 0],
        radii: [3, 3, 3],
        profile: 'soft'
      }],
      materials: [{ id: 'coat', baseColor: '#8A6A44' }]
    }
  }]
);
assert.equal(
  roundedMass.ok,
  true,
  'compiler composition is diagnostic and must not reject a valid silhouette'
);

const compiledCube = (
  index: number,
  size: number
): SceneNode => ({
  id: `cube-${index}`,
  kind: 'cube',
  generation: {
    authority: 'ashfox.part-compiler',
    role: 'geometry',
    partId: 'body',
    parentPartId: null,
    materialId: 'coat',
    primitive: 'mass',
    joint: { kind: 'fixed' }
  },
  bounds: {
    from: [index * (size + 1), 0, 0],
    to: [index * (size + 1) + size, size, size]
  }
} as unknown as SceneNode);

assert.deepEqual(
  measureFormComposition(
    Array.from({ length: 513 }, (_, index) => compiledCube(index, 2)),
    1
  ),
  {
    compiledCuboids: 513,
    semanticParts: 1,
    cellScaleCuboids: 0,
    parts: [{
      partId: 'body',
      compiledCuboids: 513,
      cellScaleCuboids: 0
    }]
  },
  'large compiler output is reported without an artistic budget verdict'
);

assert.deepEqual(
  measureFormComposition(
    Array.from({ length: 25 }, (_, index) => compiledCube(index, 1)),
    1
  ).cellScaleCuboids,
  25,
  'cell-scale cuboids remain visible as a diagnostic'
);
