import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  effectivelyVisibleSceneNodeIds,
  evaluateProductionReadiness,
  validateProjectDocument
} from '../src';
import {
  createGeckoLib5Project,
  createGltfProject
} from './helpers';

const emptyGlb = createProjectFromInput(
  {
    id: 'readiness-empty-glb',
    name: 'Empty GLB',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'empty_glb',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'readiness-1'
);
const emptyReport = validateProjectDocument(emptyGlb);
const emptyReadiness = evaluateProductionReadiness(
  emptyGlb,
  emptyReport
);
assert.equal(emptyReport.valid, true);
assert.equal(emptyReadiness.structurallyValid, true);
assert.equal(emptyReadiness.mechanicallyReady, false);
assert.deepEqual(
  emptyReadiness.findings.map((finding) => finding.code),
  [
    'production.geometry_missing',
    'production.idle_missing',
    'production.intent_missing'
  ]
);

const geckoPlaceholder = createProjectFromInput(
  {
    id: 'readiness-placeholder-gecko',
    name: 'Placeholder Gecko',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'placeholder_gecko',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'readiness-1'
);
const authoredGecko = createGeckoLib5Project();
geckoPlaceholder.scene = authoredGecko.scene;
geckoPlaceholder.textures = authoredGecko.textures;
const placeholderReadiness =
  evaluateProductionReadiness(geckoPlaceholder);
assert.equal(
  Object.values(geckoPlaceholder.animations)[0]?.name,
  'animation.placeholder_gecko.rest_pose'
);
assert.equal(placeholderReadiness.counts.idleClips, 0);
assert.ok(
  placeholderReadiness.findings.some(
    (finding) => finding.code === 'production.idle_missing'
  )
);

const badLoop = createGltfProject('glb', 'embedded');
const badLoopReadiness = evaluateProductionReadiness(badLoop);
assert.equal(badLoopReadiness.structurallyValid, true);
assert.equal(badLoopReadiness.mechanicallyReady, false);
assert.ok(
  badLoopReadiness.findings.some(
    (finding) =>
      finding.code === 'production.idle_loop_invalid'
  )
);

const ready = structuredClone(badLoop);
ready.intent = {
  subject: 'Crate',
  forward: 'north',
  grounding: 'free',
  requiredFeatures: ['Human confirms the crate reads correctly.'],
  requiredPartIds: [],
  requiredMaterialIds: [],
  requiredClipIds: []
};
const readyClip = ready.animations['clip-idle'];
const readyChannel = readyClip.channels['channel-root-rotation'];
const readyKeys = [...readyChannel.keys];
readyKeys[readyKeys.length - 1] = {
  ...readyKeys[readyKeys.length - 1],
  value: readyKeys[0].value
};
ready.animations = {
  ...ready.animations,
  'clip-idle': {
    ...readyClip,
    channels: {
      ...readyClip.channels,
      'channel-root-rotation': {
        ...readyChannel,
        keys: readyKeys
      }
    }
  }
};
const readyReadiness = evaluateProductionReadiness(ready);
assert.equal(readyReadiness.mechanicallyReady, true);
assert.deepEqual(readyReadiness.findings, []);

const hiddenAncestor = structuredClone(ready);
hiddenAncestor.scene.nodes['bone-root'].visible = false;
assert.deepEqual(
  [...effectivelyVisibleSceneNodeIds(hiddenAncestor)],
  []
);
const hiddenAncestorReadiness =
  evaluateProductionReadiness(hiddenAncestor);
assert.equal(
  hiddenAncestorReadiness.counts.visibleGeometry,
  0
);
assert.equal(hiddenAncestorReadiness.counts.idleChannels, 0);
assert.ok(
  hiddenAncestorReadiness.findings.some(
    (finding) =>
      finding.code === 'production.geometry_missing'
  )
);
assert.ok(
  hiddenAncestorReadiness.findings.some(
    (finding) =>
      finding.code === 'production.idle_channels_missing'
  )
);

const unfaithfulPreview = structuredClone(
  createGeckoLib5Project()
);
unfaithfulPreview.intent = {
  subject: 'Crate',
  forward: 'north',
  grounding: 'free',
  requiredFeatures: ['Human confirms the crate reads correctly.'],
  requiredPartIds: [],
  requiredMaterialIds: [],
  requiredClipIds: []
};
const unfaithfulClip =
  unfaithfulPreview.animations['clip-idle'];
const unfaithfulChannel =
  unfaithfulClip.channels['channel-root-rotation'];
const unfaithfulKeys = [...unfaithfulChannel.keys];
unfaithfulKeys[unfaithfulKeys.length - 1] = {
  ...unfaithfulKeys[unfaithfulKeys.length - 1],
  value: unfaithfulKeys[0].value
};
unfaithfulPreview.animations = {
  ...unfaithfulPreview.animations,
  'clip-idle': {
    ...unfaithfulClip,
    channels: {
      ...unfaithfulClip.channels,
      'channel-root-rotation': {
        ...unfaithfulChannel,
        keys: unfaithfulKeys
      }
    }
  }
};
const unfaithfulReadiness =
  evaluateProductionReadiness(unfaithfulPreview);
assert.equal(unfaithfulReadiness.mechanicallyReady, false);
assert.ok(
  unfaithfulReadiness.findings.some(
    (finding) =>
      finding.code ===
      'production.animation_preview_unfaithful'
  ),
  'an otherwise closed Idle must fail readiness when live preview omits its trigger semantics'
);

const untextured = structuredClone(ready);
const cube = untextured.scene.nodes['cube-body'];
assert.equal(cube.kind, 'cube');
if (cube.kind !== 'cube') throw new Error('Fixture cube missing.');
for (const face of Object.values(cube.faces)) face.textureId = null;
untextured.textures = {};
const untexturedReadiness =
  evaluateProductionReadiness(untextured);
assert.equal(untexturedReadiness.mechanicallyReady, false);
assert.equal(
  untexturedReadiness.counts.untexturedVisibleFaces,
  6
);
assert.ok(
  untexturedReadiness.findings.some(
    (finding) =>
      finding.code ===
      'production.texture_coverage_incomplete'
  )
);
