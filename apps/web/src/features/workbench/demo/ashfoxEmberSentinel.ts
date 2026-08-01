import type { AnimationTriggerInput, Vec3 } from '@ashfox/engine-core';

import {
  demoChannel,
  demoSurfaceEyes,
  type DemoDefinition
} from './demoFactory';
import { createShowcaseDemoBuilder } from './showcaseDemoBuilder';

const T = {
  ember: 'texture-sentinel-ember-fur',
  coal: 'texture-sentinel-coal-armor',
  cream: 'texture-sentinel-cream-fur',
  cyan: 'texture-sentinel-cyan-spirit',
  gold: 'texture-sentinel-brass-trim',
  white: 'texture-sentinel-spirit-glint'
} as const;

const b = createShowcaseDemoBuilder();
const root = b.bone('bone-root', null, [0, 0, 0], 'root');
const body = b.bone('bone-body', root, [0, 8, 0], 'ember_body');
const head = b.bone('bone-head', body, [0, 12, -5], 'sentinel_head');
const tailFan = b.bone('bone-tail-fan', body, [0, 8.5, 4.5], 'nine_tail_halo');
const spiritHalo = b.bone('bone-spirit-halo', body, [0, 13, 2], 'spirit_halo');
const core = b.bone('bone-heart-core', body, [0, 9.5, -3.2], 'ember_heart');

b.part('torso', body, [0, 8, 0], [0, 8.2, 0], [9, 8, 11], T.ember);
b.part('chest-ruff', body, [0, 9.3, -4.8], [0, 9.3, -4.8], [8, 7, 3], T.cream);
b.part('back-armor', body, [0, 12.3, 0.8], [0, 12.3, 0.8], [8, 2, 9], T.coal);
b.part('spine-trim', body, [0, 13.3, 0.8], [0, 13.3, 0.8], [2, 1, 9], T.gold);
b.part('belly-shadow', body, [0, 5.2, -0.2], [0, 5.2, -0.2], [6, 2, 8], T.coal);

for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`flank-armor-${sideName}`, body, [side * 4.7, 9, 0], [side * 4.7, 9, 0], [2, 6, 8], T.coal);
  b.part(`flank-rune-${sideName}`, body, [side * 5.7, 9.4, -1], [side * 5.7, 9.4, -1], [1, 3, 3], T.cyan);
  b.part(`shoulder-guard-${sideName}`, body, [side * 4.8, 11.3, -3.2], [side * 4.8, 11.3, -3.2], [3, 3, 4], T.gold, { rotation: [0, 0, side * 12] });
}

b.part('head-skull', head, [0, 12, -5], [0, 13.2, -6.7], [8, 7, 7], T.ember);
b.part('brow-mask', head, [0, 14, -10], [0, 14, -10], [7, 3, 2], T.coal);
b.part('muzzle', head, [0, 11.7, -10.4], [0, 11.7, -10.4], [6, 4, 4], T.cream);
b.part('nose', head, [0, 12, -12.5], [0, 12, -12.5], [3, 2, 1], T.coal);
b.part('chin', head, [0, 10.3, -10.5], [0, 10.3, -10.5], [5, 1, 3], T.coal);

for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  const earPivot: Vec3 = [side * 2.7, 16, -6.2];
  b.part(`ear-${sideName}-base`, head, earPivot, [side * 3.1, 17.8, -6.1], [3, 7, 3], T.ember, { rotation: [0, 0, side * -12] });
  b.part(`ear-${sideName}-tip`, head, earPivot, [side * 3.7, 21, -6], [2, 4, 2], T.coal, { rotation: [0, 0, side * -18] });
  b.part(`ear-${sideName}-inner`, head, earPivot, [side * 3.3, 18.1, -7.8], [1, 4, 1], T.cyan, { rotation: [0, 0, side * -12] });
  b.part(`cheek-${sideName}`, head, [side * 4.1, 12, -9], [side * 4.1, 12, -9], [2, 3, 3], T.cream, { rotation: [0, 0, side * 12] });
}

b.part('heart-frame', core, [0, 9.5, -5.7], [0, 9.5, -5.7], [5, 5, 1], T.gold, { rotation: [0, 0, 45] });
b.part('heart-ember', core, [0, 9.5, -6.3], [0, 9.5, -6.3], [3, 3, 1], T.cyan, { rotation: [0, 0, 45] });
b.part('heart-spark', core, [0, 10.1, -6.9], [0, 10.1, -6.9], [1, 1, 1], T.white);

for (const [name, x, z] of [
  ['front-left', -3.8, -3.4], ['front-right', 3.8, -3.4],
  ['rear-left', -3.8, 3.4], ['rear-right', 3.8, 3.4]
] as const) {
  const pivot: Vec3 = [x, 6.7, z];
  const leg = b.bone(`bone-leg-${name}`, body, pivot, `leg_${name}`);
  b.part(`leg-${name}-upper`, leg, pivot, [x, 5.6, z], [3, 5, 3], T.ember);
  b.part(`leg-${name}-guard`, leg, pivot, [x, 4.2, z], [4, 2, 4], T.gold);
  b.part(`leg-${name}-lower`, leg, pivot, [x, 2.4, z], [2, 4, 2], T.coal);
  b.part(`leg-${name}-sock`, leg, pivot, [x, 1.3, z], [3, 2, 3], T.cream);
  b.part(`leg-${name}-paw`, leg, pivot, [x, 0.5, z - 0.8], [4, 1, 5], T.coal);
  for (let claw = 0; claw < 3; claw += 1) {
    b.part(`leg-${name}-claw-${claw}`, leg, pivot, [x - 1 + claw, 0.4, z - 3.2], [1, 1, 2], T.cyan);
  }
}

const tailRoots: string[] = [];
for (let tailIndex = 0; tailIndex < 9; tailIndex += 1) {
  const angle = -68 + tailIndex * 17;
  const angleRadians = angle * Math.PI / 180;
  let parent = tailFan;
  let start: Vec3 = [0, 8.5, 4.2];
  const tailRootId = `bone-tail-${tailIndex + 1}`;
  tailRoots.push(tailRootId);
  for (let segment = 0; segment < 5; segment += 1) {
    const length = 4.3 - segment * 0.28;
    const rise = 1.25 + segment * 0.4;
    const next: Vec3 = [
      start[0] + Math.sin(angleRadians) * length,
      start[1] + rise,
      start[2] + Math.cos(angleRadians) * length
    ];
    const id = `tail-${tailIndex + 1}-segment-${segment + 1}`;
    const boneId = segment === 0
      ? b.bone(tailRootId, parent, start, `tail_${tailIndex + 1}`)
      : b.bone(`bone-${id}`, parent, start, id.replaceAll('-', '_'));
    b.cube(`cube-${id}`, boneId, start, [
      (start[0] + next[0]) / 2,
      (start[1] + next[1]) / 2,
      (start[2] + next[2]) / 2
    ], [2.8 - segment * 0.32, 2.8 - segment * 0.32, length + 0.8], segment === 4 ? T.cyan : segment === 3 ? T.cream : T.ember, {
      rotation: [-18 - segment * 5, angle, (tailIndex - 4) * 2]
    });
    parent = boneId;
    start = next;
  }
}

for (let index = 0; index < 18; index += 1) {
  const angle = index * 20;
  const radians = angle * Math.PI / 180;
  const center: Vec3 = [Math.sin(radians) * 8.5, 13 + Math.cos(radians) * 8.5, 3.2];
  b.part(`halo-shard-${index + 1}`, spiritHalo, [0, 13, 2], center, [1, index % 2 === 0 ? 3 : 2, 1], index % 3 === 0 ? T.gold : T.cyan, { rotation: [0, 0, -angle] });
}

const idleChannels = [
  demoChannel('sentinel-idle-root', root, 'position', [[0, [0, 0, 0]], [1.5, [0, 0.3, 0]], [3, [0, 0, 0]]]),
  demoChannel('sentinel-idle-face-surface', 'bone:sentinel.face.surface', 'position', [[0, [0, 0, 0]], [1.5, [0, 0.3, 0]], [3, [0, 0, 0]]]),
  demoChannel('sentinel-idle-core', core, 'scale', [[0, [1, 1, 1]], [0.75, [1.25, 1.25, 1.25]], [1.5, [1, 1, 1]], [2.25, [1.18, 1.18, 1.18]], [3, [1, 1, 1]]]),
  demoChannel('sentinel-idle-halo', spiritHalo, 'rotation', [[0, [0, 0, 0]], [1.5, [0, 0, 10]], [3, [0, 0, 0]]]),
  ...tailRoots.map((tailId, index) => demoChannel(`sentinel-idle-tail-${index + 1}`, tailId, 'rotation', [[0, [0, -3 + index * 0.8, 0]], [1.5, [0, 3 - index * 0.6, 2]], [3, [0, -3 + index * 0.8, 0]]]))
];

const awakenChannels = [
  demoChannel('sentinel-awaken-root', root, 'position', [[0, [0, -2.5, 0]], [0.6, [0, -2.5, 0]], [1.15, [0, 1.4, 0]], [1.45, [0, 0, 0]], [3.2, [0, 0, 0]]]),
  demoChannel('sentinel-awaken-tails', tailFan, 'scale', [[0, [0.08, 0.08, 0.08]], [0.55, [0.08, 0.08, 0.08]], [1.35, [1.2, 1.2, 1.2]], [1.7, [1, 1, 1]], [3.2, [1, 1, 1]]]),
  demoChannel('sentinel-awaken-halo-scale', spiritHalo, 'scale', [[0, [0.05, 0.05, 0.05]], [1.05, [0.05, 0.05, 0.05]], [1.65, [1.3, 1.3, 1.3]], [1.95, [1, 1, 1]], [3.2, [1, 1, 1]]]),
  demoChannel('sentinel-awaken-halo-spin', spiritHalo, 'rotation', [[0, [0, 0, -90]], [1.05, [0, 0, -90]], [2.2, [0, 0, 18]], [3.2, [0, 0, 0]]]),
  demoChannel('sentinel-awaken-core', core, 'scale', [[0, [0.1, 0.1, 0.1]], [0.7, [0.1, 0.1, 0.1]], [1.2, [1.55, 1.55, 1.55]], [1.6, [1, 1, 1]], [3.2, [1, 1, 1]]]),
  demoChannel('sentinel-awaken-face-surface', 'bone:sentinel.face.surface', 'position', [[0, [0, -2.5, 0]], [0.6, [0, -2.5, 0]], [1.15, [0, 1.4, 0]], [1.45, [0, 0, 0]], [3.2, [0, 0, 0]]])
];

const triggers: AnimationTriggerInput[] = [{
  id: 'sentinel-ignite-sound',
  type: 'sound',
  keys: [{ id: 'sentinel-ignite-sound-key', timeSeconds: 1.15, value: { effect: 'ashfox:ember_sentinel_ignite', bindToActor: true } }]
}, {
  id: 'sentinel-ignite-particle',
  type: 'particle',
  keys: [{ id: 'sentinel-ignite-particle-key', timeSeconds: 1.55, value: { effect: 'ashfox:spirit_fox_halo' } }]
}];

export const ASHFOX_EMBER_SENTINEL_DEMO: DemoDefinition = {
  id: 'project-showcase-ashfox-ember-sentinel',
  slug: 'ashfox-ember-sentinel',
  name: 'Ashfox · Ember Sentinel',
  modelPath: 'ashfox_ember_sentinel',
  initialSelectionId: core,
  visibleEyeCount: 2,
  intent: {
    subject: 'nine-tailed mechanical spirit fox guardian',
    grounding: 'free',
    features: ['iconic orange fox silhouette', 'nine articulated ember tails', 'cyan spirit halo and animated heart core']
  },
  surfacePixelDensity: 2,
  textures: [
    { id: T.ember, name: 'Ashfox ember fur', background: '#d8662f' },
    { id: T.coal, name: 'Forged coal armor', background: '#242735' },
    { id: T.cream, name: 'Warm cream fur', background: '#e8cf9a' },
    { id: T.cyan, name: 'Cyan spirit flame', background: '#39d9df' },
    { id: T.gold, name: 'Sentinel brass', background: '#c69443' },
    { id: T.white, name: 'Spirit glint', background: '#f5fff7' }
  ],
  parts: demoSurfaceEyes(
    'sentinel.face.surface',
    [-7, 26, -26],
    [14, 4],
    T.coal,
    [{ id: 'sentinel.eye.left', anchor: [-4, 28, -26], size: [6, 4], irisMaterialId: T.cyan },
      { id: 'sentinel.eye.right', anchor: [4, 28, -26], size: [6, 4], irisMaterialId: T.cyan }]
  ),
  bones: b.bones,
  cubes: b.cubes,
  animations: [{
    id: 'idle', name: 'Ember Sentinel Idle', durationSeconds: 3, fps: 20, loop: 'loop', channels: idleChannels
  }, {
    id: 'animation-ember-halo-awakening', name: 'Nine-Tail Halo Ignition', durationSeconds: 3.2, fps: 24, loop: 'hold_on_last_frame', channels: awakenChannels, triggers
  }]
};
