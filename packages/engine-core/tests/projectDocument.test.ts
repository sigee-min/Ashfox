import assert from 'node:assert/strict';

import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  assertProjectDocument,
  parseProjectDocument,
  ProjectFileError,
  ProjectInvariantError
} from '../src';
import { createGeckoLib5Project, createJavaProject } from './helpers';

const project = createJavaProject();

assert.equal(project.schemaVersion, PROJECT_DOCUMENT_SCHEMA_VERSION);
assert.equal(project.scene.nodes['cube-body'].kind, 'cube');
assert.equal(project.textures['texture-base'].minecraft?.resource.namespace, 'ashfox');
assert.doesNotThrow(() => assertProjectDocument(project));
assert.equal(
  parseProjectDocument(JSON.parse(JSON.stringify(project))).id,
  project.id
);
const missingDensity = JSON.parse(JSON.stringify(project));
delete missingDensity.settings.surfacePixelDensity;
assert.throws(
  () => parseProjectDocument(missingDensity),
  ProjectInvariantError
);
const staleGenerated = JSON.parse(JSON.stringify(project));
staleGenerated.textures['texture-base'].atlasMode = 'generate';
staleGenerated.textures['texture-base'].raster = {
  background: '#8e98a3',
  canvasDetails: []
};
for (const face of Object.values(
  staleGenerated.scene.nodes['cube-body'].faces
)) {
  (face as { uv: [number, number, number, number] }).uv = [0, 0, 1, 1];
}
const derived = parseProjectDocument(staleGenerated);
const derivedCube = derived.scene.nodes['cube-body'];
if (derivedCube.kind !== 'cube') {
  throw new Error('Derived project cube is unavailable.');
}
assert.deepEqual(
  [
    derivedCube.faces.north.uv?.[2] -
      (derivedCube.faces.north.uv?.[0] ?? 0),
    derivedCube.faces.north.uv?.[3] -
      (derivedCube.faces.north.uv?.[1] ?? 0)
  ],
  [8, 8],
  'project loading must restore canonical generated texture derivations'
);

assert.throws(
  () => parseProjectDocument({ name: 'incomplete' }),
  ProjectInvariantError
);

const documentWithUnknownProperty = {
  ...project,
  obsoleteMarker: true
};
assert.throws(
  () => parseProjectDocument(documentWithUnknownProperty),
  ProjectInvariantError,
  'the current document contract must reject undeclared internal fields'
);

const unsupportedSchema = {
  ...project,
  schemaVersion: 2
};
assert.throws(
  () => parseProjectDocument(unsupportedSchema),
  ProjectInvariantError,
  'pre-release documents must use the single v1 schema'
);

const closedContractMutations: readonly [string, (value: any) => void][] = [
  ['nested settings property', (value) => { value.settings.obsolete = true; }],
  ['nested format property', (value) => { value.formatProfile.obsolete = true; }],
  ['non-boolean format option', (value) => {
    value.formatProfile.ambientOcclusion = 'false';
  }],
  ['missing node visibility', (value) => {
    delete value.scene.nodes['cube-body'].visible;
  }],
  ['missing cube mirror', (value) => {
    delete value.scene.nodes['cube-body'].mirror;
  }],
  ['unknown cube face', (value) => {
    value.scene.nodes['cube-body'].faces.obsolete = {
      enabled: false,
      textureId: null
    };
  }],
  ['missing texture sampling', (value) => {
    delete value.textures['texture-base'].sampling;
  }],
  ['unknown texture sampling', (value) => {
    value.textures['texture-base'].sampling = 'bogus';
  }],
  ['non-boolean texture visibility', (value) => {
    value.textures['texture-base'].visible = Number.NaN;
  }],
  ['unknown blob property', (value) => {
    value.textures['texture-base'].source.obsolete = true;
  }],
  ['non-canonical date', (value) => {
    value.createdAt = '2026-08-06';
  }],
  ['offset ISO date', (value) => {
    value.createdAt = '2026-08-06T09:00:00+09:00';
  }]
];

for (const [label, mutate] of closedContractMutations) {
  const candidate = JSON.parse(JSON.stringify(project));
  mutate(candidate);
  assert.throws(
    () => parseProjectDocument(candidate),
    ProjectInvariantError,
    `closed v1 document must reject ${label}`
  );
}

const animatedContractMutations: readonly [
  string,
  (value: any) => void
][] = [
  ['unknown clip property', (value) => {
    value.animations['clip-idle'].obsolete = true;
  }],
  ['unknown keyframe property', (value) => {
    value.animations['clip-idle']
      .channels['channel-root-rotation'].keys[0].obsolete = true;
  }],
  ['unknown effect property', (value) => {
    value.animations['clip-idle']
      .triggers['trigger-particle'].keys[0].value.obsolete = true;
  }],
  ['non-boolean effect binding', (value) => {
    value.animations['clip-idle']
      .triggers['trigger-particle'].keys[0].value.bindToActor = 'yes';
  }]
];

for (const [label, mutate] of animatedContractMutations) {
  const candidate = JSON.parse(JSON.stringify(createGeckoLib5Project()));
  mutate(candidate);
  assert.throws(
    () => parseProjectDocument(candidate),
    ProjectInvariantError,
    `closed v1 document must reject ${label}`
  );
}
