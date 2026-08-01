import type { AnimationTriggerInput, Vec3 } from '@ashfox/engine-core';

import {
  demoChannel,
  demoSurfaceEyes,
  type DemoDefinition
} from './demoFactory';
import { createShowcaseDemoBuilder } from './showcaseDemoBuilder';

const T = {
  iron: 'texture-nomad-forged-iron',
  soot: 'texture-nomad-soot-black',
  copper: 'texture-nomad-hammered-copper',
  steel: 'texture-nomad-tempered-steel',
  ember: 'texture-nomad-forge-ember',
  rune: 'texture-nomad-aether-rune'
} as const;

const b = createShowcaseDemoBuilder();
const root = b.bone('bone-root', null, [0, 0, 0], 'root');
const pelvis = b.bone('bone-pelvis', root, [0, 6, 0], 'wheel_pelvis');
const torso = b.bone('bone-torso', pelvis, [0, 12, 0], 'forge_torso');
const furnace = b.bone('bone-furnace', torso, [0, 13, -5], 'forgeheart_core');
const head = b.bone('bone-head', torso, [0, 20, -1], 'chimney_head');
const hammerArm = b.bone('bone-hammer-arm', torso, [-8, 15, 0], 'hammer_arm');
const tongArm = b.bone('bone-tong-arm', torso, [8, 15, 0], 'tong_arm');
const legs = b.bone('bone-leg-deployment', pelvis, [0, 6, 0], 'leg_deployment');
const backpack = b.bone('bone-forge-pack', torso, [0, 14, 4], 'traveling_forge');

b.part('pelvis-block', pelvis, [0, 6, 0], [0, 6.5, 0], [12, 5, 9], T.iron);
b.part('pelvis-apron', pelvis, [0, 6, -4.8], [0, 6, -4.8], [10, 4, 2], T.copper);
b.part('pelvis-keel', pelvis, [0, 3.8, 1], [0, 3.8, 1], [9, 2, 7], T.soot);
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`hip-wheel-${sideName}`, pelvis, [side * 6.5, 6.2, 0], [side * 6.5, 6.2, 0], [2, 8, 8], T.iron, { rotation: [0, 0, 45] });
  b.part(`hip-wheel-hub-${sideName}`, pelvis, [side * 7.7, 6.2, 0], [side * 7.7, 6.2, 0], [2, 3, 3], T.copper);
  for (let spoke = 0; spoke < 8; spoke += 1) {
    b.part(`hip-wheel-${sideName}-spoke-${spoke + 1}`, pelvis, [side * 8.5, 6.2, 0], [side * 8.5, 6.2 + Math.sin(spoke * Math.PI / 4) * 3, Math.cos(spoke * Math.PI / 4) * 3], [1, 4, 1], spoke % 2 === 0 ? T.copper : T.steel, { rotation: [spoke * 45, 0, 0] });
  }
}

b.part('torso-main', torso, [0, 12, 0], [0, 13.5, 0], [13, 12, 11], T.iron);
b.part('torso-shoulder-beam', torso, [0, 17, 0], [0, 17, 0], [21, 4, 9], T.steel);
b.part('torso-collar', torso, [0, 19.1, -0.5], [0, 19.1, -0.5], [10, 2, 8], T.copper);
b.part('torso-belly', torso, [0, 9.2, -1], [0, 9.2, -1], [10, 3, 8], T.soot);
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`shoulder-${sideName}`, torso, [side * 8, 16.5, 0], [side * 8, 16.5, 0], [6, 6, 8], T.copper, { rotation: [0, 0, side * 8] });
  b.part(`shoulder-rune-${sideName}`, torso, [side * 11.2, 16.5, -1], [side * 11.2, 16.5, -1], [1, 3, 3], T.rune);
}

b.part('furnace-frame', furnace, [0, 13, -5], [0, 13.5, -6], [10, 9, 2], T.copper);
b.part('furnace-door', furnace, [0, 13, -6.8], [0, 13, -6.8], [7, 6, 1], T.soot);
b.part('furnace-fire', furnace, [0, 13, -7.5], [0, 13, -7.5], [5, 4, 1], T.ember);
b.part('furnace-core', furnace, [0, 13.2, -8.1], [0, 13.2, -8.1], [3, 3, 1], T.rune, { rotation: [0, 0, 45] });
b.part('furnace-grate-top', furnace, [0, 16.4, -7.2], [0, 16.4, -7.2], [8, 1, 1], T.steel);
b.part('furnace-grate-bottom', furnace, [0, 9.7, -7.2], [0, 9.7, -7.2], [8, 1, 1], T.steel);
for (let index = 0; index < 8; index += 1) {
  const x = -3.5 + index;
  b.part(`furnace-tooth-${index + 1}`, furnace, [x, 10.5, -7.4], [x, 10.5, -7.4], [1, 2, 1], index % 2 === 0 ? T.ember : T.copper);
}

b.part('head-block', head, [0, 20, -1], [0, 21, -2], [9, 7, 8], T.iron);
b.part('head-brow', head, [0, 22.5, -6.2], [0, 22.5, -6.2], [8, 2, 2], T.copper);
b.part('head-visor', head, [0, 20.8, -6.5], [0, 20.8, -6.5], [7, 2, 1], T.soot);
b.part('head-jaw', head, [0, 18.5, -5], [0, 18.5, -5], [7, 2, 4], T.steel);
for (let pipe = 0; pipe < 5; pipe += 1) {
  const x = -4 + pipe * 2;
  const height = 5 + (pipe % 3) * 2;
  b.part(`chimney-${pipe + 1}`, head, [x, 24, -0.5], [x, 24 + height / 2, -0.5 + Math.abs(pipe - 2) * 0.7], [2, height, 2], pipe === 2 ? T.copper : T.soot, { rotation: [0, 0, (pipe - 2) * 4] });
  b.part(`chimney-cap-${pipe + 1}`, head, [x, 24 + height, -0.5], [x, 24 + height, -0.5 + Math.abs(pipe - 2) * 0.7], [3, 2, 3], T.steel);
}

const buildArm = (name: 'hammer' | 'tong', side: -1 | 1, parent: string): void => {
  const shoulder: Vec3 = [side * 9, 15, 0];
  b.part(`${name}-upper-arm`, parent, shoulder, [side * 11, 13.5, 0], [5, 8, 5], T.iron, { rotation: [0, 0, side * -18] });
  b.part(`${name}-elbow`, parent, shoulder, [side * 13, 10.5, 0], [6, 5, 6], T.copper);
  b.part(`${name}-forearm`, parent, shoulder, [side * 14, 7.5, -0.5], [5, 8, 5], T.steel, { rotation: [0, 0, side * 8] });
  b.part(`${name}-wrist`, parent, shoulder, [side * 14.5, 3.8, -0.5], [5, 3, 5], T.soot);
  if (name === 'hammer') {
    b.part('hammer-handle', parent, shoulder, [-14.5, 0.5, -0.5], [2, 10, 2], T.copper);
    b.part('hammer-head', parent, shoulder, [-14.5, -3.8, -0.5], [10, 5, 6], T.steel);
    b.part('hammer-ember-face', parent, shoulder, [-14.5, -3.8, -3.8], [6, 3, 1], T.ember);
  } else {
    b.part('tong-palm', parent, shoulder, [14.5, 1.8, -0.5], [5, 4, 5], T.copper);
    for (const finger of [-1, 1] as const) {
      b.part(`tong-finger-${finger < 0 ? 'left' : 'right'}`, parent, shoulder, [14.5 + finger * 2, -1.5, -1], [2, 7, 2], T.steel, { rotation: [finger * 8, 0, finger * -8] });
      b.part(`tong-tip-${finger < 0 ? 'left' : 'right'}`, parent, shoulder, [14.5 + finger * 2.8, -4.5, -1.5], [2, 3, 2], T.ember);
    }
  }
};
buildArm('hammer', -1, hammerArm);
buildArm('tong', 1, tongArm);

for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  const hip: Vec3 = [side * 4, 5.5, 0];
  const leg = b.bone(`bone-leg-${sideName}`, legs, hip, `leg_${sideName}`);
  b.part(`leg-${sideName}-thigh`, leg, hip, [side * 4, 3.5, 0], [6, 7, 6], T.iron);
  b.part(`leg-${sideName}-knee`, leg, hip, [side * 4, 1.2, -1], [7, 4, 7], T.copper);
  b.part(`leg-${sideName}-shin`, leg, hip, [side * 4, -2, 0], [5, 7, 5], T.steel);
  b.part(`leg-${sideName}-ankle`, leg, hip, [side * 4, -5, 0], [6, 3, 6], T.soot);
  b.part(`leg-${sideName}-foot`, leg, hip, [side * 4, -6.5, -2], [8, 2, 10], T.iron);
  for (let toe = 0; toe < 4; toe += 1) {
    b.part(`leg-${sideName}-toe-${toe + 1}`, leg, hip, [side * 4 - 3 + toe * 2, -6.8, -7], [2, 1, 3], T.ember);
  }
}

b.part('pack-main', backpack, [0, 14, 4], [0, 14, 6], [11, 11, 6], T.soot);
b.part('pack-anvil-deck', backpack, [0, 14, 4], [0, 19, 7], [13, 2, 8], T.steel);
b.part('pack-anvil-horn', backpack, [0, 14, 4], [6.5, 19, 7], [7, 2, 4], T.steel, { rotation: [0, 0, -12] });
for (let gear = 0; gear < 16; gear += 1) {
  const side = gear % 2 === 0 ? -1 : 1;
  const row = Math.floor(gear / 4);
  const z = 3.7 + (gear % 4) * 1.8;
  b.part(`pack-gear-${gear + 1}`, backpack, [side * 6, 11.5 + row * 1.8, z], [side * 6, 11.5 + row * 1.8, z], [1, 2 + gear % 3, 2 + gear % 3], gear % 3 === 0 ? T.ember : T.copper, { rotation: [gear * 23, 0, 0] });
}

const idleChannels = [
  demoChannel('nomad-idle-root', root, 'position', [[0, [0, 0, 0]], [1.5, [0, 0.35, 0]], [3, [0, 0, 0]]]),
  demoChannel('nomad-idle-face-position', 'bone:nomad.face.surface', 'position', [[0, [0, 0, 0]], [1.5, [0, 0.35, 0]], [3, [0, 0, 0]]]),
  demoChannel('nomad-idle-head', head, 'rotation', [[0, [0, -4, 0]], [1.5, [2, 5, 0]], [3, [0, -4, 0]]]),
  demoChannel('nomad-idle-face-rotation', 'bone:nomad.face.surface', 'rotation', [[0, [0, -4, 0]], [1.5, [2, 5, 0]], [3, [0, -4, 0]]]),
  demoChannel('nomad-idle-hammer', hammerArm, 'rotation', [[0, [0, 0, -4]], [1.5, [0, 0, 5]], [3, [0, 0, -4]]]),
  demoChannel('nomad-idle-furnace', furnace, 'scale', [[0, [1, 1, 1]], [0.75, [1.18, 1.18, 1.18]], [1.5, [1, 1, 1]], [2.25, [1.18, 1.18, 1.18]], [3, [1, 1, 1]]])
];

const deployChannels = [
  demoChannel('nomad-deploy-root', root, 'position', [[0, [0, -5, 0]], [0.65, [0, -5, 0]], [1.2, [0, 2, 0]], [1.55, [0, 0, 0]], [3.2, [0, 0, 0]]]),
  demoChannel('nomad-deploy-face-position', 'bone:nomad.face.surface', 'position', [[0, [0, -5, 0]], [0.65, [0, -5, 0]], [1.2, [0, 2, 0]], [1.55, [0, 0, 0]], [3.2, [0, 0, 0]]]),
  demoChannel('nomad-deploy-torso', torso, 'scale', [[0, [1, 0.3, 1]], [0.55, [1, 0.3, 1]], [1.3, [1.1, 1.15, 1.1]], [1.65, [1, 1, 1]], [3.2, [1, 1, 1]]]),
  demoChannel('nomad-deploy-legs', legs, 'scale', [[0, [1, 0.08, 1]], [0.55, [1, 0.08, 1]], [1.4, [1, 1.2, 1]], [1.7, [1, 1, 1]], [3.2, [1, 1, 1]]]),
  demoChannel('nomad-deploy-hammer', hammerArm, 'rotation', [[0, [0, 0, 78]], [0.8, [0, 0, 78]], [1.55, [0, 0, -14]], [1.9, [0, 0, 0]], [3.2, [0, 0, 0]]]),
  demoChannel('nomad-deploy-tong', tongArm, 'rotation', [[0, [0, 0, -78]], [0.8, [0, 0, -78]], [1.55, [0, 0, 14]], [1.9, [0, 0, 0]], [3.2, [0, 0, 0]]]),
  demoChannel('nomad-deploy-core', furnace, 'scale', [[0, [0.08, 0.08, 0.08]], [0.95, [0.08, 0.08, 0.08]], [1.55, [1.45, 1.45, 1.45]], [1.9, [1, 1, 1]], [3.2, [1, 1, 1]]])
];

const triggers: AnimationTriggerInput[] = [{ id: 'nomad-deploy-sound', type: 'sound', keys: [{ id: 'nomad-deploy-sound-key', timeSeconds: 1.18, value: { effect: 'ashfox:forgeheart_deploy', bindToActor: true } }] }, { id: 'nomad-deploy-timeline', type: 'timeline', keys: [{ id: 'nomad-deploy-timeline-key', timeSeconds: 1.55, value: 'FORGE ONLINE' }] }];

export const FORGEHEART_NOMAD_DEMO: DemoDefinition = {
  id: 'project-showcase-forgeheart-nomad', slug: 'forgeheart-nomad', name: 'Forgeheart · Nomad War-Forge', modelPath: 'forgeheart_nomad', initialSelectionId: furnace, visibleEyeCount: 2,
  intent: { subject: 'traveling forge caravan transformed into a hammer golem', grounding: 'free', features: ['upright mobile-forge silhouette', 'giant hammer and articulated tong arms', 'animated furnace core and war-form deployment'] },
  surfacePixelDensity: 2,
  textures: [
    { id: T.iron, name: 'Forged iron', background: '#454c52' }, { id: T.soot, name: 'Soot black', background: '#20242a' },
    { id: T.copper, name: 'Hammered copper', background: '#a55d37' }, { id: T.steel, name: 'Tempered steel', background: '#8c9aa0' },
    { id: T.ember, name: 'Forge ember', background: '#f07a32' }, { id: T.rune, name: 'Aether rune', background: '#42d8d5' }
  ],
  parts: demoSurfaceEyes(
    'nomad.face.surface',
    [-7, 40, -16],
    [14, 4],
    T.soot,
    [{ id: 'nomad.eye.left', anchor: [-4, 42, -16], size: [4, 3], irisMaterialId: T.ember },
      { id: 'nomad.eye.right', anchor: [4, 42, -16], size: [4, 3], irisMaterialId: T.ember }]
  ),
  bones: b.bones, cubes: b.cubes,
  animations: [
    { id: 'idle', name: 'Forgeheart Furnace Idle', durationSeconds: 3, fps: 20, loop: 'loop', channels: idleChannels },
    { id: 'animation-forgeheart-deploy', name: 'Caravan-to-Warform Deployment', durationSeconds: 3.2, fps: 24, loop: 'hold_on_last_frame', channels: deployChannels, triggers }
  ]
};
