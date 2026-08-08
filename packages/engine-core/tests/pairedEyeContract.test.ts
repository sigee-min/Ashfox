import assert from 'node:assert/strict';

import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  createProjectFromInput,
  evaluateAuthoringPlan,
  executeAgentCommandBatch,
  paintEyeMotifPixel,
  readPartRecipe,
  type AuthoringSelectionInput,
  type CommandBatch,
  type ProjectDocument
} from '../src';
import {
  centeredEyePupilBias,
  eyePupilCells
} from '../src/modeling/eyeGaze';
import { cellKey } from '../src/modeling/lattice';
import type { EyeFeaturePartSpec } from '../src/modeling/partContract';
import {
  areLatticeCellSetsExactReflections
} from '../src/modeling/partRecipeTransforms/geometry';
import { surfaceFeaturePixels } from '../src/modeling/surfaceFeature';
import { projectSpatialFrame } from '../src/project/projectSpatialFrame';

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
) => executeAgentCommandBatch(document, {
  batchId,
  baseProjectId: document.id,
  baseRevision: document.revision,
  operations
});

const applied = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = execute(document, batchId, operations);
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : result.error.message
  );
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const selection: AuthoringSelectionInput = {
  archetype: {
    id: 'archetype.composable-form',
    version: AUTHORING_PROFILE_SCHEMA_VERSION
  },
  track: 'essential',
  faceMode: 'full',
  face: {
    hostSlotId: 'focal.host',
    mouthState: 'absent',
    components: [{
      component: 'eye',
      form: 'eye',
      configuration: {
        kind: 'paired',
        leftSlotId: 'face.eye.left',
        rightSlotId: 'face.eye.right'
      },
      gaze: 'centered',
      palette: 'high-contrast',
      materialIds: ['eye.black']
    }],
    exceptions: [{
      component: 'nasal',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale:
        'The requested test subject intentionally has no nasal component.'
    }, {
      component: 'oral',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale:
        'The requested test subject intentionally has no oral component.'
    }]
  },
  specialists: [],
  claims: [{
    authority: {
      id: 'archetype.composable-form',
      version: AUTHORING_PROFILE_SCHEMA_VERSION
    },
    criterionId: 'criterion.structure-graph',
    basis: 'requested',
    referenceIds: ['intent.subject'],
    rationale:
      'The requested bilateral test subject has one centered core and one paired eye set.'
  }],
  slots: [{
    slotId: 'core.primary',
    structuralRole: 'core',
    qualityStage: 'silhouette',
    partIds: ['core'],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    symmetry: { kind: 'centered' },
    support: { kind: 'none' }
  }, {
    slotId: 'focal.host',
    structuralRole: 'focal-frame',
    qualityStage: 'structure',
    partIds: ['head'],
    parentSlotIds: ['core.primary'],
    spatialRelations: ['above'],
    facing: null,
    symmetry: { kind: 'centered' },
    support: { kind: 'none' }
  }, {
    slotId: 'face.eye.left',
    structuralRole: 'focal-frame',
    qualityStage: 'focal',
    partIds: ['eye.left'],
    parentSlotIds: ['focal.host'],
    spatialRelations: ['left'],
    facing: 'forward',
    symmetry: { kind: 'paired', pairId: 'pair.face.eyes' },
    support: { kind: 'none' }
  }, {
    slotId: 'face.eye.right',
    structuralRole: 'focal-frame',
    qualityStage: 'focal',
    partIds: ['eye.right'],
    parentSlotIds: ['focal.host'],
    spatialRelations: ['right'],
    facing: 'forward',
    symmetry: { kind: 'paired', pairId: 'pair.face.eyes' },
    support: { kind: 'none' }
  }],
  coverage: [],
  bindings: []
};

const project = createProjectFromInput(
  {
    id: 'paired-eye-contract',
    name: 'Paired eye contract',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'paired_eye_contract',
    createdAt: '2026-08-08T00:00:00.000Z'
  },
  'paired-eye-contract-0001'
);

const intended = applied(project, 'paired-eye-intent', [{
  name: 'project.intent.set',
  payload: {
    subject: 'Bilateral two-eyed test subject without nose or mouth',
    forward: 'south',
    grounding: 'free',
    symmetry: { kind: 'bilateral', planeTwice: 0 },
    features: [],
    references: []
  }
}]);

const planned = applied(intended, 'paired-eye-plan', [{
  name: 'project.authoring.configure',
  payload: selection
}]);

const modelParts = (
  width: 3 | 4
): Extract<CommandBatch['operations'][number], {
  name: 'model.parts.upsert';
}>['payload'] => ({
  parts: [{
    kind: 'mass',
    partId: 'core',
    parentPartId: null,
    materialId: 'body',
    center: [0, 2, 0],
    radii: [4, 2, 3],
    profile: 'block'
  }, {
    kind: 'mass',
    partId: 'head',
    parentPartId: 'core',
    materialId: 'face',
    center: [0, 6, 0],
    radii: [4, 2, 3],
    profile: 'block'
  }, {
    kind: 'feature',
    partId: 'eye.left',
    parentPartId: 'head',
    materialId: 'eye.black',
    motif: 'eye',
    glyph: 'square',
    face: 'south',
    anchor: [2, 6, 3],
    size: [width, 3]
  }, {
    kind: 'feature',
    partId: 'eye.right',
    parentPartId: 'head',
    materialId: 'eye.black',
    motif: 'eye',
    glyph: 'square',
    face: 'south',
    anchor: [width === 3 ? -3 : -2, 6, 3],
    size: [width, 3]
  }],
  materials: [{ id: 'body', baseColor: '#7A4A32' }, {
    id: 'face',
    baseColor: '#D7B18A'
  }, {
    id: 'eye.black',
    baseColor: '#000000'
  }]
});

const odd = applied(planned, 'paired-eye-odd', [{
  name: 'model.parts.upsert',
  payload: modelParts(3)
}]);

const eyes = (
  document: ProjectDocument
): readonly [EyeFeaturePartSpec, EyeFeaturePartSpec] => {
  const recipe = readPartRecipe(document);
  assert.equal(recipe.ok, true);
  if (!recipe.ok || !recipe.recipe) {
    throw new Error('Paired eye recipe is unavailable.');
  }
  const left = recipe.recipe.parts.find(
    (part): part is EyeFeaturePartSpec =>
      part.kind === 'feature' &&
      part.motif === 'eye' &&
      part.partId === 'eye.left'
  );
  const right = recipe.recipe.parts.find(
    (part): part is EyeFeaturePartSpec =>
      part.kind === 'feature' &&
      part.motif === 'eye' &&
      part.partId === 'eye.right'
  );
  assert.ok(left && right);
  return [left, right];
};

const footprint = (
  eye: EyeFeaturePartSpec
): ReadonlySet<`${number},${number},${number}`> => new Set(
  surfaceFeaturePixels(eye).map((pixel) => cellKey(pixel.boundaryCell))
);

const assertExactPair = (document: ProjectDocument): void => {
  assert.ok(document.intent);
  const [left, right] = eyes(document);
  const frame = projectSpatialFrame(document.intent);
  assert.ok(frame.plane !== null);
  assert.equal(
    areLatticeCellSetsExactReflections(
      footprint(left),
      footprint(right),
      frame.lateralAxis,
      frame.plane
    ),
    true,
    'paired eye footprints must be exact lattice reflections'
  );
  assert.equal(
    areLatticeCellSetsExactReflections(
      eyePupilCells(document.intent, left),
      eyePupilCells(document.intent, right),
      frame.lateralAxis,
      frame.plane
    ),
    true,
    'compiler-derived pupil texels must be exact lattice reflections'
  );
  const quality = evaluateAuthoringPlan(document).assetQuality;
  assert.equal(quality?.symmetryQuality.ready, true);
  assert.equal(quality?.faceQuality.ready, true);
  assert.deepEqual(quality?.faceQuality.violations, []);
};

assertExactPair(odd);
if (!odd.intent) throw new Error('Odd eye intent is unavailable.');
const [oddLeft, oddRight] = eyes(odd);
assert.equal(centeredEyePupilBias(odd.intent, oddLeft), 0);
assert.equal(centeredEyePupilBias(odd.intent, oddRight), 0);

const oddRecipe = readPartRecipe(odd);
assert.equal(oddRecipe.ok, true);
if (!oddRecipe.ok || !oddRecipe.recipe) {
  throw new Error('Odd eye materials are unavailable.');
}
assert.equal(
  oddRecipe.recipe.materials.find(
    (material) => material.id === 'eye.black'
  )?.baseColor,
  '#000000'
);
const black = { r: 0, g: 0, b: 0 };
const blackSclera = paintEyeMotifPixel(
  black,
  0,
  0,
  oddLeft.size[0],
  oddLeft.size[1],
  oddLeft.glyph,
  centeredEyePupilBias(odd.intent, oddLeft)
);
const blackPupil = paintEyeMotifPixel(
  black,
  1,
  1,
  oddLeft.size[0],
  oddLeft.size[1],
  oddLeft.glyph,
  centeredEyePupilBias(odd.intent, oddLeft)
);
assert.ok(blackSclera && blackPupil);
assert.ok(
  blackSclera.r > 220 &&
  blackSclera.g > 220 &&
  blackSclera.b > 220,
  'the high-contrast eye policy must keep a white-ish sclera for a black iris'
);
assert.ok(
  blackPupil.r < 32 && blackPupil.g < 32 && blackPupil.b < 32,
  'the high-contrast eye policy must retain a dark pupil'
);

const even = applied(odd, 'paired-eye-even', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'feature',
      partId: 'eye.left',
      anchor: [2, 6, 3],
      size: [4, 3]
    }, {
      kind: 'feature',
      partId: 'eye.right',
      anchor: [-2, 6, 3],
      size: [4, 3]
    }]
  }
}]);
assertExactPair(even);
if (!even.intent) throw new Error('Even eye intent is unavailable.');
const [evenLeft, evenRight] = eyes(even);
assert.equal(centeredEyePupilBias(even.intent, evenLeft), -1);
assert.equal(centeredEyePupilBias(even.intent, evenRight), 1);
assert.deepEqual(
  [...eyePupilCells(even.intent, evenLeft)].map((key) =>
    Number(key.split(',')[0])
  ).sort((left, right) => left - right),
  [1],
  'the semantic left eye must choose its inner even-width center column'
);
assert.deepEqual(
  [...eyePupilCells(even.intent, evenRight)].map((key) =>
    Number(key.split(',')[0])
  ).sort((left, right) => left - right),
  [-2],
  'the semantic right eye must choose its inner even-width center column'
);

const assertAtomicRejection = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations'],
  expected: RegExp
): void => {
  const snapshot = JSON.stringify(document);
  const result = execute(document, batchId, operations);
  assert.equal(result.ok, false);
  if (result.ok) throw new Error(`${batchId} unexpectedly succeeded.`);
  assert.match([
    result.error.message,
    ...(result.findings ?? []).flatMap((finding) => [
      finding.code,
      finding.message
    ])
  ].join('\n'), expected);
  assert.equal(result.currentRevision, document.revision);
  assert.equal(
    JSON.stringify(document),
    snapshot,
    `${batchId} must leave the source document byte-for-byte unchanged`
  );
};

assertAtomicRejection(even, 'paired-eye-transform-one-side', [{
  name: 'model.parts.transform',
  payload: { rootPartId: 'eye.left', by: [0, -1, 0] }
}], /reflection|symmetr|gaze/iu);

assertAtomicRejection(even, 'paired-eye-delete-one-side', [{
  name: 'model.parts.delete',
  payload: { partIds: ['eye.left'] }
}], /absent|reflection|symmetr|eye/iu);

assertAtomicRejection(even, 'paired-eye-upsert-one-side', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'feature',
      partId: 'eye.left',
      size: [3, 3]
    }]
  }
}], /reflection|symmetr|gaze/iu);

assertAtomicRejection(even, 'paired-eye-dot-schema-rejected', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'feature',
      partId: 'eye.left',
      glyph: 'dot'
    }, {
      kind: 'feature',
      partId: 'eye.right',
      glyph: 'dot'
    }]
  }
}], /not valid for the eye|invalid/iu);

assertAtomicRejection(even, 'paired-eye-disable-materialized-face', [{
  name: 'project.authoring.configure',
  payload: {
    ...selection,
    faceMode: 'none',
    face: null
  }
}], /no face|face.*invalid|facial focal features/iu);

const noFace = applied(planned, 'paired-eye-disable-empty-face', [{
  name: 'project.authoring.configure',
  payload: {
    ...selection,
    faceMode: 'none',
    face: null
  }
}]);
assertAtomicRejection(noFace, 'paired-eye-author-under-face-none', [{
  name: 'model.parts.upsert',
  payload: modelParts(3)
}], /no face|face.*invalid|facial focal features/iu);
