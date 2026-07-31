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

const withCanonicalIdle = (
  project: ReturnType<typeof createGltfProject>
) => {
  const document = structuredClone(project);
  const legacyIdle = document.animations['clip-idle'];
  document.animations = {
    idle: {
      ...legacyIdle,
      id: 'idle'
    }
  };
  return document;
};

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

const emptyGecko = createProjectFromInput(
  {
    id: 'readiness-empty-gecko',
    name: 'Empty Gecko',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'empty_gecko',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'readiness-1'
);
const authoredGecko = createGeckoLib5Project();
emptyGecko.scene = authoredGecko.scene;
emptyGecko.textures = authoredGecko.textures;
const emptyGeckoReadiness =
  evaluateProductionReadiness(emptyGecko);
assert.deepEqual(emptyGecko.animations, {});
assert.equal(validateProjectDocument(emptyGecko).valid, true);
assert.equal(emptyGeckoReadiness.counts.idleClips, 0);
assert.ok(
  emptyGeckoReadiness.findings.some(
    (finding) => finding.code === 'production.idle_missing'
  ),
  'canonical idle readiness is the only animation-presence completion authority'
);

const nonCanonicalNamedIdle = createGltfProject('glb', 'embedded');
const nonCanonicalNamedReadiness = evaluateProductionReadiness(
  nonCanonicalNamedIdle
);
assert.ok(
  nonCanonicalNamedReadiness.findings.some(
    (finding) =>
      finding.code === 'production.idle_missing' &&
      finding.clipIds?.includes('clip-idle') &&
      finding.fix.includes('same atomic batch')
  ),
  'an Idle-like name must not replace the canonical clip ID'
);

const badLoop = withCanonicalIdle(nonCanonicalNamedIdle);
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
  features: ['Human confirms the crate reads correctly.']
};
const readyClip = ready.animations.idle;
const readyChannel = readyClip.channels['channel-root-rotation'];
const readyKeys = [...readyChannel.keys];
readyKeys[readyKeys.length - 1] = {
  ...readyKeys[readyKeys.length - 1],
  value: readyKeys[0].value
};
ready.animations = {
  ...ready.animations,
  idle: {
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

const withImportedWalk = structuredClone(ready);
const importedWalkChannel = structuredClone(
  withImportedWalk.animations.idle.channels[
    'channel-root-rotation'
  ]
);
importedWalkChannel.id = 'channel-walk-root-rotation';
importedWalkChannel.keys = importedWalkChannel.keys.map(
  (key, index) => ({
    ...key,
    id: `key-walk-root-rotation-${index}`
  })
);
withImportedWalk.animations.walk = {
  ...withImportedWalk.animations.idle,
  id: 'walk',
  name: 'animation.crate.walk',
  channels: {
    [importedWalkChannel.id]: importedWalkChannel
  }
};

const openImportedLoop = structuredClone(withImportedWalk);
const openWalkChannel =
  openImportedLoop.animations.walk.channels[
    'channel-walk-root-rotation'
  ];
openImportedLoop.animations.walk.channels = {
  [openWalkChannel.id]: {
    ...openWalkChannel,
    keys: openWalkChannel.keys.map((key, index) =>
      index === openWalkChannel.keys.length - 1
        ? { ...key, value: [0, 15, 0] }
        : key
    )
  }
};
assert.ok(
  evaluateProductionReadiness(openImportedLoop).findings.some(
    (finding) =>
      finding.code === 'production.animation_loop_invalid' &&
      finding.clipIds?.includes('walk')
  ),
  'an imported open non-idle loop must block delivery'
);

const windingImportedLoop = structuredClone(withImportedWalk);
const windingWalkChannel =
  windingImportedLoop.animations.walk.channels[
    'channel-walk-root-rotation'
  ];
windingImportedLoop.animations.walk.channels = {
  [windingWalkChannel.id]: {
    ...windingWalkChannel,
    keys: windingWalkChannel.keys.map((key, index) =>
      index === windingWalkChannel.keys.length - 1
        ? { ...key, value: [0, 360, 0] }
        : key
    )
  }
};
assert.ok(
  !evaluateProductionReadiness(windingImportedLoop).findings.some(
    (finding) =>
      finding.code === 'production.animation_loop_invalid'
  ),
  'a full-turn rotation is a valid non-idle loop closure'
);

const earlyImportedLoop = structuredClone(withImportedWalk);
const earlyWalkChannel = earlyImportedLoop.animations.walk.channels[
  'channel-walk-root-rotation'
];
earlyImportedLoop.animations.walk.channels = {
  [earlyWalkChannel.id]: {
    ...earlyWalkChannel,
    keys: earlyWalkChannel.keys.map((key, index) =>
      index === earlyWalkChannel.keys.length - 1
        ? {
            ...key,
            timeSeconds:
              earlyImportedLoop.animations.walk.durationSeconds - 0.05
          }
        : key
    )
  }
};
assert.ok(
  evaluateProductionReadiness(earlyImportedLoop).findings.some(
    (finding) =>
      finding.code === 'production.animation_loop_invalid'
  ),
  'a loop track must close at the declared clip duration'
);

const windingIdle = structuredClone(ready);
const windingChannel = windingIdle.animations.idle.channels[
  'channel-root-rotation'
];
windingIdle.animations.idle.channels = {
  ...windingIdle.animations.idle.channels,
  [windingChannel.id]: {
    ...windingChannel,
    keys: windingChannel.keys.map((key, index) =>
      index === windingChannel.keys.length - 1
        ? { ...key, value: [0, 360, 0] }
        : key
    )
  }
};
assert.ok(
  evaluateProductionReadiness(windingIdle).findings.some(
    (finding) => finding.code === 'production.idle_loop_invalid'
  ),
  'canonical Idle must close numerically rather than modulo full turns'
);

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

const adaptedPreview = structuredClone(
  withCanonicalIdle(createGeckoLib5Project())
);
adaptedPreview.intent = {
  subject: 'Crate',
  forward: 'north',
  grounding: 'free',
  features: ['Human confirms the crate reads correctly.']
};
const adaptedClip =
  adaptedPreview.animations.idle;
const adaptedChannel =
  adaptedClip.channels['channel-root-rotation'];
const adaptedKeys = [...adaptedChannel.keys];
adaptedKeys[adaptedKeys.length - 1] = {
  ...adaptedKeys[adaptedKeys.length - 1],
  value: adaptedKeys[0].value
};
adaptedPreview.animations = {
  ...adaptedPreview.animations,
  idle: {
    ...adaptedClip,
    channels: {
      ...adaptedClip.channels,
      'channel-root-rotation': {
        ...adaptedChannel,
        keys: adaptedKeys
      }
    }
  }
};
const adaptedReadiness =
  evaluateProductionReadiness(adaptedPreview);
assert.equal(adaptedReadiness.mechanicallyReady, true);
assert.equal(
  adaptedReadiness.findings.some(
    (finding) =>
      finding.code ===
      'production.animation_preview_unfaithful'
  ),
  false,
  'event tracks omitted by the numeric preview must not block delivery'
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
