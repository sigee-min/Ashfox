import assert from 'node:assert/strict';

import { createWorkbenchProject } from './fixtures/workbenchProject';
import {
  resolveActiveClipId,
  resolveSelectedNodeId
} from '../src/features/workbench/state/workbenchSelection';

const document = createWorkbenchProject();
const firstRoot = document.scene.roots[0];
const firstClip = Object.keys(document.animations)[0];

assert.equal(resolveSelectedNodeId(document, firstRoot), firstRoot);
assert.equal(resolveSelectedNodeId(document, 'missing-node'), firstRoot);
assert.equal(resolveSelectedNodeId(document, null), null);
assert.equal(resolveActiveClipId(document, firstClip), firstClip);
assert.equal(resolveActiveClipId(document, 'missing-clip'), firstClip);
assert.equal(
  resolveActiveClipId(document, null),
  null,
  'an explicit no-clip presentation must not silently select an animation'
);

const emptyDocument = {
  ...document,
  scene: {
    roots: [],
    nodes: {}
  },
  animations: {}
};
assert.equal(resolveSelectedNodeId(emptyDocument, null), null);
assert.equal(resolveActiveClipId(emptyDocument, null), null);
