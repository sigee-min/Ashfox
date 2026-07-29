import assert from 'node:assert/strict';

import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  assertProjectDocument,
  parseProjectDocument,
  ProjectFileError,
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
