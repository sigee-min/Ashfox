import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  type CubeNode,
  type ProjectDocument
} from '../src';
import {
  compiledPartCubeId
} from '../src/modeling/provenance';
import {
  composeTextureRaster,
  deriveGeneratedTextures
} from '../src/textures/textureRecipe';
import {
  buildSurfacePatternComponents
} from '../src/textures/surfacePatternComponents';

const stripComponents = buildSurfacePatternComponents(
  Array.from({ length: 1_000 }, (_, index) => ({
    id: `strip-${index}`,
    groupKey: 'copper:north:0',
    x: index,
    y: 0,
    width: 1,
    height: 1
  }))
);
assert.equal(
  new Set(
    [...stripComponents.values()].map(
      (component) => component.seedKey
    )
  ).size,
  1,
  'a long coplanar strip must remain one connected pattern component'
);

const project = createProjectFromInput(
  {
    id: 'project-surface-authority',
    name: 'Surface authority',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'surface_authority',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'revision-surface-authority'
);

const authored = executeCommandBatch(
  project,
  {
    batchId: 'surface-authority-part',
    baseProjectId: project.id,
    baseRevision: project.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'plate',
          partId: 'body',
          parentPartId: null,
          materialId: 'copper',
          joint: { kind: 'fixed' },
          attachment: null,
          plane: 'xy',
          origin: [0, 0, 0],
          outline: [
            [0, 0],
            [2, 0],
            [2, 1],
            [0, 1]
          ],
          thickness: 1
        }],
        materials: [{
          id: 'copper',
          baseColor: '#BE6E37'
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(authored.ok, true);
if (!authored.ok) {
  throw new Error(authored.error.message);
}

const wholeDocument = authored.document;
const wholeCube = Object.values(wholeDocument.scene.nodes).find(
  (node): node is CubeNode =>
    node.kind === 'cube' &&
    node.generation?.partId === 'body'
);
assert.ok(wholeCube);
if (!wholeCube) throw new Error('Compiled body cube is missing.');

const splitCube = (
  fromX: number,
  toX: number
): CubeNode => ({
  ...wholeCube,
  id: compiledPartCubeId('body', 1, {
    min: { x: fromX, y: 0, z: 0 },
    max: { x: toX, y: 1, z: 1 }
  }),
  bounds: {
    from: [fromX, 0, 0],
    to: [toX, 1, 1]
  },
  faces: structuredClone(wholeCube.faces)
});

const left = splitCube(0, 1);
const right = splitCube(1, 2);
const splitInput: ProjectDocument = {
  ...wholeDocument,
  scene: {
    ...wholeDocument.scene,
    nodes: {
      ...Object.fromEntries(
        Object.entries(wholeDocument.scene.nodes).filter(
          ([nodeId]) => nodeId !== wholeCube.id
        )
      ),
      [left.id]: left,
      [right.id]: right
    }
  }
};
const splitDerived = deriveGeneratedTextures(splitInput);
assert.equal(splitDerived.ok, true);
if (!splitDerived.ok) {
  throw new Error(splitDerived.message);
}

const splitLeft = splitDerived.document.scene.nodes[left.id];
const splitRight = splitDerived.document.scene.nodes[right.id];
assert.equal(splitLeft.kind, 'cube');
assert.equal(splitRight.kind, 'cube');
if (splitLeft.kind !== 'cube' || splitRight.kind !== 'cube') {
  throw new Error('Split cubes are missing.');
}
assert.equal(
  splitLeft.faces.east.enabled,
  false,
  'a completely internal compiled face must not enter the atlas'
);
assert.equal(splitRight.faces.west.enabled, false);

const textureId = wholeCube.faces.north.textureId;
assert.ok(textureId);
if (!textureId) throw new Error('Generated texture is missing.');
const wholeTexture = wholeDocument.textures[textureId];
const splitTexture = splitDerived.document.textures[textureId];
const wholeNorth = composeTextureRaster(
  wholeDocument,
  wholeTexture
).regions.filter((region) => region.face === 'north');
const splitNorth = composeTextureRaster(
  splitDerived.document,
  splitTexture
).regions.filter((region) => region.face === 'north');

assert.equal(wholeNorth.length, 1);
assert.equal(splitNorth.length, 2);
assert.ok(wholeNorth[0].pattern);
assert.ok(splitNorth.every((region) => region.pattern !== undefined));
assert.deepEqual(
  [...new Set(splitNorth.map((region) => region.pattern?.seedKey))],
  [wholeNorth[0].pattern?.seedKey]
);
assert.ok(
  splitNorth.every(
    (region) =>
      JSON.stringify(region.pattern?.bounds) ===
      JSON.stringify(wholeNorth[0].pattern?.bounds)
  ),
  'cuboid fragments must share one logical surface rectangle'
);

const crossPartInput: ProjectDocument = {
  ...splitDerived.document,
  scene: {
    ...splitDerived.document.scene,
    nodes: {
      ...splitDerived.document.scene.nodes,
      [right.id]: {
        ...splitRight,
        generation: splitRight.generation
          ? {
              ...splitRight.generation,
              partId: 'body-detail'
            }
          : undefined
      }
    }
  }
};
const crossPartTexture =
  crossPartInput.textures[textureId];
const crossPartNorth = composeTextureRaster(
  crossPartInput,
  crossPartTexture
).regions.filter((region) => region.face === 'north');
assert.deepEqual(
  [...new Set(crossPartNorth.map(
    (region) => region.pattern?.seedKey
  ))],
  [wholeNorth[0].pattern?.seedKey],
  'connected coplanar material must not seam at a semantic part boundary'
);

const tallLeft: CubeNode = {
  ...left,
  id: compiledPartCubeId('body', 1, {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 1, y: 2, z: 1 }
  }),
  bounds: {
    from: [0, 0, 0],
    to: [1, 2, 1]
  },
  faces: structuredClone(wholeCube.faces)
};
const partialInput: ProjectDocument = {
  ...wholeDocument,
  scene: {
    ...wholeDocument.scene,
    nodes: {
      ...Object.fromEntries(
        Object.entries(wholeDocument.scene.nodes).filter(
          ([nodeId]) => nodeId !== wholeCube.id
        )
      ),
      [tallLeft.id]: tallLeft,
      [right.id]: {
        ...right,
        faces: structuredClone(wholeCube.faces)
      }
    }
  }
};
const partialDerived = deriveGeneratedTextures(partialInput);
assert.equal(partialDerived.ok, true);
if (!partialDerived.ok) {
  throw new Error(partialDerived.message);
}
const partialLeft = partialDerived.document.scene.nodes[tallLeft.id];
const partialRight = partialDerived.document.scene.nodes[right.id];
assert.equal(partialLeft.kind, 'cube');
assert.equal(partialRight.kind, 'cube');
if (partialLeft.kind !== 'cube' || partialRight.kind !== 'cube') {
  throw new Error('Partial-neighbor cubes are missing.');
}
assert.equal(
  partialLeft.faces.east.enabled,
  true,
  'a partially covered rectangular face must remain enabled'
);
assert.equal(
  partialRight.faces.west.enabled,
  false,
  'the fully covered opposite face can still be excluded'
);
