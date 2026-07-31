import assert from 'node:assert/strict';

import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  assertProjectDocument,
  parseProjectDocument,
  ProjectFileError,
  ProjectInvariantError,
  type ProjectDocument
} from '../src';
import { createJavaProject } from './helpers';

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
  ProjectFileError
);

const wrongSchema = {
  ...project,
  schemaVersion: 99
} as unknown as ProjectDocument;

assert.throws(
  () => assertProjectDocument(wrongSchema),
  /violates 1 invariant/
);
