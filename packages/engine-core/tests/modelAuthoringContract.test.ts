import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeCommandBatch,
  readPartRecipe,
  type CommandBatch,
  type CommandBatchResult,
  type ProjectDocument
} from '../src';

const emptyProject = (id: string): ProjectDocument =>
  createProjectFromInput(
    {
      id,
      name: id,
      target: 'glb',
      namespace: 'ashfox',
      modelPath: id,
      createdAt: '2026-07-31T00:00:00.000Z'
    },
    `revision-${id}`
  );

const run = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): CommandBatchResult =>
  executeCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    },
    { source: 'agent' }
  );

const succeed = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = run(document, batchId, operations);
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ` +
      `${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const rootOnly = succeed(
  emptyProject('authoring-patch'),
  'authoring-root',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'body',
        materialId: 'gold',
        center: [0, 0, 0],
        radii: [3, 2, 2],
        profile: 'hard'
      }],
      materials: [{ id: 'gold', baseColor: '#C58A32' }]
    }
  }]
);

const patched = succeed(rootOnly, 'authoring-patch-center', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'body',
      center: [1, 0, 0]
    }]
  }
}]);
const patchedRecipe = readPartRecipe(patched);
assert.equal(patchedRecipe.ok, true);
if (!patchedRecipe.ok || patchedRecipe.recipe === null) {
  throw new Error('Patched recipe is unavailable.');
}
assert.deepEqual(patchedRecipe.recipe.parts[0], {
  kind: 'mass',
  partId: 'body',
  parentPartId: null,
  materialId: 'gold',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [1, 0, 0],
  radii: [3, 2, 2],
  profile: 'hard'
});

const incomplete = run(
  emptyProject('authoring-incomplete'),
  'authoring-incomplete-part',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'body',
        center: [0, 0, 0],
        radii: [2, 2, 2]
      }]
    }
  }]
);
assert.equal(incomplete.ok, false);
if (!incomplete.ok) {
  assert.equal(
    incomplete.error.path,
    'operations[0].payload.parts[0].materialId'
  );
}

const missingFeatureParent = run(
  emptyProject('authoring-feature'),
  'authoring-feature-parent',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'eye',
        materialId: 'eye',
        motif: 'eye',
        face: 'south',
        anchor: [0, 0, 0],
        size: [4, 3]
      }],
      materials: [{ id: 'eye', baseColor: '#FFFFFF' }]
    }
  }]
);
assert.equal(missingFeatureParent.ok, false);
if (!missingFeatureParent.ok) {
  assert.equal(
    missingFeatureParent.error.path,
    'operations[0].payload.parts[0].parentPartId'
  );
}

const segmentDocument = succeed(
  emptyProject('authoring-segment'),
  'authoring-segment-broadcast',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'segment',
        partId: 'body',
        materialId: 'gold',
        points: [[0, 0, 0], [3, 0, 0], [5, 1, 0]],
        radii: [1, 2, 1]
      }],
      materials: [{ id: 'gold', baseColor: '#C58A32' }]
    }
  }]
);
const segmentRecipe = readPartRecipe(segmentDocument);
assert.equal(segmentRecipe.ok, true);
if (!segmentRecipe.ok || segmentRecipe.recipe === null) {
  throw new Error('Segment recipe is unavailable.');
}
const segment = segmentRecipe.recipe.parts[0];
assert.equal(segment.kind, 'segment');
if (segment.kind === 'segment') {
  assert.deepEqual(segment.radii, [
    [1, 2, 1],
    [1, 2, 1],
    [1, 2, 1]
  ]);
}

const plateDocument = succeed(
  emptyProject('authoring-plate'),
  'authoring-plate-size',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'plate',
        partId: 'body',
        materialId: 'gold',
        plane: 'xy',
        origin: [0, 0, 0],
        size: [6, 3],
        thickness: 2
      }],
      materials: [{ id: 'gold', baseColor: '#C58A32' }]
    }
  }]
);
const plateRecipe = readPartRecipe(plateDocument);
assert.equal(plateRecipe.ok, true);
if (!plateRecipe.ok || plateRecipe.recipe === null) {
  throw new Error('Plate recipe is unavailable.');
}
const plate = plateRecipe.recipe.parts[0];
assert.equal(plate.kind, 'plate');
if (plate.kind === 'plate') {
  assert.deepEqual(plate.outline, [
    [0, 0],
    [6, 0],
    [6, 3],
    [0, 3]
  ]);
  assert.equal(Object.hasOwn(plate, 'size'), false);
}

const eyeOnPlate = run(plateDocument, 'authoring-eye-on-plate', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'feature',
      partId: 'face.marking',
      parentPartId: 'body',
      materialId: 'eye',
      motif: 'eye',
      face: 'north',
      anchor: [3, 1, 0],
      size: [4, 3]
    }],
    materials: [{ id: 'eye', baseColor: '#FFFFFF' }]
  }
}]);
assert.equal(eyeOnPlate.ok, false);
if (!eyeOnPlate.ok) {
  assert.equal(
    eyeOnPlate.error.path,
    'operations[0].payload.parts[0].parentPartId'
  );
  assert.match(eyeOnPlate.error.message, /volumetric mass or segment/);
  assert.match(eyeOnPlate.error.message, /billboard/);
}

const eyeOnStandaloneMass = run(
  rootOnly,
  'authoring-eye-on-standalone-mass',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'face.marking',
        parentPartId: 'body',
        materialId: 'eye',
        motif: 'eye',
        face: 'north',
        anchor: [0, 0, -2],
        size: [4, 3]
      }],
      materials: [{ id: 'eye', baseColor: '#FFFFFF' }]
    }
  }]
);
assert.equal(eyeOnStandaloneMass.ok, false);
if (!eyeOnStandaloneMass.ok) {
  assert.match(eyeOnStandaloneMass.error.message, /standalone face volume/i);
  assert.match(eyeOnStandaloneMass.error.message, /detached mask/i);
}

const eyeOnTokenSupport = run(
  emptyProject('authoring-eye-token-support'),
  'authoring-eye-token-support-create',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'token.support',
        parentPartId: null,
        materialId: 'gold',
        center: [0, 0, 4],
        radii: [1, 1, 1],
        profile: 'hard'
      }, {
        kind: 'mass',
        partId: 'fake.head',
        parentPartId: 'token.support',
        materialId: 'gold',
        center: [0, 0, 0],
        radii: [5, 5, 3],
        profile: 'hard'
      }, {
        kind: 'feature',
        partId: 'face.marking',
        parentPartId: 'fake.head',
        materialId: 'eye',
        motif: 'eye',
        face: 'north',
        anchor: [0, 0, -3],
        size: [4, 3]
      }],
      materials: [
        { id: 'gold', baseColor: '#C58A32' },
        { id: 'eye', baseColor: '#FFFFFF' }
      ]
    }
  }]
);
assert.equal(eyeOnTokenSupport.ok, false);
if (!eyeOnTokenSupport.ok) {
  assert.match(eyeOnTokenSupport.error.message, /token support volume/i);
  assert.match(eyeOnTokenSupport.error.message, /tiny anti-audit tab/i);
}

const attachmentShiftedEye = run(
  emptyProject('authoring-eye-shifted-border'),
  'authoring-eye-shifted-border-create',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'housing.support',
        parentPartId: null,
        materialId: 'gold',
        center: [0, 10, -14],
        radii: [4, 1, 2],
        profile: 'hard'
      }, {
        kind: 'mass',
        partId: 'housing.face',
        parentPartId: 'housing.support',
        materialId: 'gold',
        center: [0, 15, -11],
        radii: [6, 3, 2],
        profile: 'hard'
      }, {
        kind: 'feature',
        partId: 'housing.eye',
        parentPartId: 'housing.face',
        materialId: 'eye',
        motif: 'eye',
        face: 'north',
        anchor: [0, 15, -13],
        size: [8, 4]
      }],
      materials: [
        { id: 'gold', baseColor: '#C58A32' },
        { id: 'eye', baseColor: '#22D3EE' }
      ]
    }
  }]
);
assert.equal(attachmentShiftedEye.ok, false);
if (!attachmentShiftedEye.ok) {
  assert.match(
    attachmentShiftedEye.error.message,
    /visible host anatomy on every side/i
  );
}

const anatomicalEyeDocument = succeed(
  emptyProject('authoring-anatomical-eye'),
  'authoring-anatomical-eye-create',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'cranium',
        parentPartId: null,
        materialId: 'gold',
        center: [0, 0, 5],
        radii: [4, 4, 2],
        profile: 'hard'
      }, {
        kind: 'mass',
        partId: 'head',
        parentPartId: 'cranium',
        materialId: 'gold',
        center: [0, 0, 0],
        radii: [5, 5, 3],
        profile: 'hard'
      }, {
        kind: 'feature',
        partId: 'face.marking',
        parentPartId: 'head',
        materialId: 'eye',
        motif: 'eye',
        face: 'north',
        anchor: [0, 0, -3],
        size: [4, 3]
      }],
      materials: [
        { id: 'gold', baseColor: '#C58A32' },
        { id: 'eye', baseColor: '#FFFFFF' }
      ]
    }
  }]
);

const flattenedEyeHost = run(
  anatomicalEyeDocument,
  'authoring-anatomical-eye-flatten-host',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'head',
        radii: [5, 5, 1]
      }]
    }
  }]
);
assert.equal(flattenedEyeHost.ok, false);
if (!flattenedEyeHost.ok) {
  assert.match(flattenedEyeHost.error.message, /too shallow/i);
}

const fullFaceEye = run(
  anatomicalEyeDocument,
  'authoring-anatomical-eye-full-face',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'face.marking',
        size: [10, 6]
      }]
    }
  }]
);
assert.equal(fullFaceEye.ok, false);
if (!fullFaceEye.ok) {
  assert.match(fullFaceEye.error.message, /painting the whole face is a mask/i);
}

const inferred = succeed(rootOnly, 'authoring-infer-parent', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'head',
      materialId: 'gold',
      center: [4, 0, 0],
      radii: [1, 1, 1]
    }]
  }
}]);
const inferredRecipe = readPartRecipe(inferred);
assert.equal(inferredRecipe.ok, true);
if (!inferredRecipe.ok || inferredRecipe.recipe === null) {
  throw new Error('Inferred recipe is unavailable.');
}
assert.equal(
  inferredRecipe.recipe.parts.find(
    (part) => part.partId === 'head'
  )?.parentPartId,
  'body'
);

const inferredFromLaterParent = succeed(
  emptyProject('authoring-later-parent'),
  'authoring-later-parent-batch',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'head',
        materialId: 'gold',
        center: [4, 0, 0],
        radii: [1, 1, 1]
      }, {
        kind: 'mass',
        partId: 'body',
        parentPartId: null,
        materialId: 'gold',
        center: [0, 0, 0],
        radii: [3, 2, 2]
      }],
      materials: [{ id: 'gold', baseColor: '#C58A32' }]
    }
  }]
);
assert.equal(
  inferredFromLaterParent.modeling?.parts.find(
    (part) => part.partId === 'head'
  )?.parentPartId,
  'body'
);

const noParentCandidate = run(rootOnly, 'authoring-no-parent', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'mass',
      partId: 'far',
      materialId: 'gold',
      center: [100, 0, 0],
      radii: [1, 1, 1]
    }]
  }
}]);
assert.equal(noParentCandidate.ok, false);
if (!noParentCandidate.ok) {
  assert.equal(
    noParentCandidate.error.path,
    'operations[0].payload.parts[0].parentPartId'
  );
}

const articulatedWithoutParent = run(
  rootOnly,
  'authoring-hinge-parent',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'radial',
        partId: 'wheel',
        materialId: 'gold',
        joint: { kind: 'hinge', axis: 'x' },
        axis: 'x',
        center: [4, 0, 0],
        outerRadius: 1,
        depth: 1
      }]
    }
  }]
);
assert.equal(articulatedWithoutParent.ok, false);
if (!articulatedWithoutParent.ok) {
  assert.equal(
    articulatedWithoutParent.error.path,
    'operations[0].payload.parts[0].parentPartId'
  );
}

const sharedMaterial = succeed(
  emptyProject('authoring-material'),
  'authoring-shared-material',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'body',
        parentPartId: null,
        materialId: 'gold',
        center: [0, 0, 0],
        radii: [3, 2, 2]
      }, {
        kind: 'mass',
        partId: 'head',
        parentPartId: 'body',
        materialId: 'gold',
        center: [4, 0, 0],
        radii: [1, 1, 1]
      }],
      materials: [{ id: 'gold', baseColor: '#C58A32' }]
    }
  }]
);

const ambiguousParent = run(
  sharedMaterial,
  'authoring-ambiguous-parent',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'mass',
        partId: 'bridge',
        materialId: 'gold',
        center: [3, 0, 0],
        radii: [1, 1, 1]
      }]
    }
  }]
);
assert.equal(ambiguousParent.ok, false);
if (!ambiguousParent.ok) {
  assert.equal(
    ambiguousParent.error.path,
    'operations[0].payload.parts[0].parentPartId'
  );
  assert.match(ambiguousParent.error.message, /multiple possible parents/);
}

const forkedMaterial = succeed(
  sharedMaterial,
  'authoring-fork-material',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body'],
      materialId: 'gold',
      baseColor: '#112233'
    }
  }]
);
const forkedRecipe = readPartRecipe(forkedMaterial);
assert.equal(forkedRecipe.ok, true);
if (!forkedRecipe.ok || forkedRecipe.recipe === null) {
  throw new Error('Forked material recipe is unavailable.');
}
assert.equal(
  forkedRecipe.recipe.parts.find(
    (part) => part.partId === 'head'
  )?.materialId,
  'gold'
);
assert.equal(
  forkedRecipe.recipe.parts.find(
    (part) => part.partId === 'body'
  )?.materialId,
  'material.112233'
);
assert.ok(
  forkedRecipe.recipe.materials.some(
    (material) =>
      material.id === 'material.112233' &&
      material.baseColor === '#112233'
  )
);

const reusedMaterial = succeed(
  forkedMaterial,
  'authoring-reuse-material',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body'],
      materialId: 'gold'
    }
  }]
);
assert.equal(
  reusedMaterial.modeling?.parts.every(
    (part) => part.materialId === 'gold'
  ),
  true
);
assert.deepEqual(reusedMaterial.modeling?.materials, [{
  id: 'gold',
  baseColor: '#C58A32'
}]);

const derivedMaterial = succeed(
  sharedMaterial,
  'authoring-derived-material',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body'],
      baseColor: '#445566'
    }
  }]
);
assert.equal(
  derivedMaterial.modeling?.parts.find(
    (part) => part.partId === 'body'
  )?.materialId,
  'material.445566'
);
const repeatedDerivedMaterial = run(
  derivedMaterial,
  'authoring-derived-material-repeat',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body'],
      baseColor: '#445566'
    }
  }]
);
assert.equal(repeatedDerivedMaterial.ok, false);
if (!repeatedDerivedMaterial.ok) {
  assert.equal(repeatedDerivedMaterial.error.code, 'no_change');
}

const recoloredInPlace = succeed(
  sharedMaterial,
  'authoring-recolor-all',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body', 'head'],
      materialId: 'gold',
      baseColor: '#778899'
    }
  }]
);
assert.deepEqual(recoloredInPlace.modeling?.materials, [{
  id: 'gold',
  baseColor: '#778899'
}]);

const missingMaterialAuthority = run(
  sharedMaterial,
  'authoring-missing-material-authority',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body']
    }
  }]
);
assert.equal(missingMaterialAuthority.ok, false);
if (!missingMaterialAuthority.ok) {
  assert.equal(
    missingMaterialAuthority.error.path,
    'operations[0].payload'
  );
  assert.equal(
    missingMaterialAuthority.error.expected,
    'at least one of materialId, baseColor'
  );
}

const unknownMaterialReuse = run(
  sharedMaterial,
  'authoring-unknown-material',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['body'],
      materialId: 'missing'
    }
  }]
);
assert.equal(unknownMaterialReuse.ok, false);
if (!unknownMaterialReuse.ok) {
  assert.equal(
    unknownMaterialReuse.error.path,
    'operations[0].payload.materialId'
  );
}
