import type { AnimationTriggerInput, Vec3 } from '@ashfox/engine-core';

import {
  demoChannel,
  demoSurfaceEyes,
  type DemoDefinition
} from './demoFactory';
import { createShowcaseDemoBuilder } from './showcaseDemoBuilder';

const T = {
  obsidian: 'texture-wyrm-eclipse-obsidian',
  stone: 'texture-wyrm-cathedral-stone',
  brass: 'texture-wyrm-sacred-brass',
  cyan: 'texture-wyrm-stained-cyan',
  magenta: 'texture-wyrm-stained-magenta',
  ivory: 'texture-wyrm-dragon-ivory',
  void: 'texture-wyrm-living-void'
} as const;

const b = createShowcaseDemoBuilder();
const root = b.bone('bone-root', null, [0, 0, 0], 'root');
const body = b.bone('bone-body', root, [0, 11, 0], 'cathedral_body');
const chest = b.bone('bone-eclipse-core', body, [0, 12, -6], 'eclipse_core');
const neck = b.bone('bone-neck', body, [0, 14, -6], 'wyrm_neck');
const head = b.bone('bone-head', neck, [0, 20, -17], 'cathedral_head');
const jaw = b.bone('bone-jaw', head, [0, 18, -20], 'reliquary_jaw');
const tail = b.bone('bone-tail', body, [0, 10, 8], 'eclipse_tail');
const wings = b.bone('bone-wings', body, [0, 15, 1], 'cathedral_wings');
const leftWing = b.bone('bone-wing-left', wings, [-5, 15, 1], 'left_cathedral_wing');
const rightWing = b.bone('bone-wing-right', wings, [5, 15, 1], 'right_cathedral_wing');
const halo = b.bone('bone-eclipse-halo', chest, [0, 13, -8], 'eclipse_halo');

b.part('body-main', body, [0, 11, 0], [0, 11.5, 0], [12, 10, 17], T.obsidian);
b.part('body-breastplate', body, [0, 12, -7.5], [0, 12, -7.5], [10, 8, 2], T.stone);
b.part('body-keel', body, [0, 7, 0], [0, 7, 0], [8, 3, 13], T.void);
b.part('body-spine', body, [0, 16, 1], [0, 16, 1], [4, 2, 15], T.brass);
for (let index = 0; index < 7; index += 1) {
  const z = -5 + index * 2.2;
  b.part(`spine-spire-${index + 1}`, body, [0, 17, z], [0, 18.5 + index % 2, z], [2, 5 + index % 2, 2], index % 3 === 0 ? T.magenta : T.stone, { rotation: [0, 0, index % 2 === 0 ? -5 : 5] });
}
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`flank-${sideName}`, body, [side * 6.3, 11, 0], [side * 6.3, 11, 0], [3, 8, 14], T.stone);
  b.part(`flank-window-${sideName}`, body, [side * 8, 12, -2], [side * 8, 12, -2], [1, 4, 5], side < 0 ? T.cyan : T.magenta);
  b.part(`shoulder-tower-${sideName}`, body, [side * 6, 16, -4], [side * 6, 17, -4], [4, 8, 5], T.obsidian);
  b.part(`shoulder-spire-${sideName}`, body, [side * 6, 21, -4], [side * 6, 21, -4], [2, 5, 2], T.brass, { rotation: [0, 0, side * -8] });
}

b.part('core-frame-outer', chest, [0, 13, -8.8], [0, 13, -8.8], [9, 9, 1], T.brass, { rotation: [0, 0, 45] });
b.part('core-frame-inner', chest, [0, 13, -9.4], [0, 13, -9.4], [6, 6, 1], T.void, { rotation: [0, 0, 45] });
b.part('core-eclipse', chest, [0, 13, -10], [0, 13, -10], [4, 4, 1], T.magenta, { rotation: [0, 0, 45] });
b.part('core-corona', chest, [0, 13.8, -10.6], [0, 13.8, -10.6], [2, 2, 1], T.cyan);
for (let index = 0; index < 20; index += 1) {
  const angle = index * 18;
  const radians = angle * Math.PI / 180;
  const center: Vec3 = [Math.sin(radians) * 7.5, 13 + Math.cos(radians) * 7.5, -10.8];
  b.part(`halo-ray-${index + 1}`, halo, [0, 13, -9], center, [1, index % 2 === 0 ? 4 : 2, 1], index % 4 === 0 ? T.brass : index % 2 === 0 ? T.cyan : T.magenta, { rotation: [0, 0, -angle] });
}

let neckParent = neck;
for (let index = 0; index < 6; index += 1) {
  const pivot: Vec3 = [0, 14 + index * 1.1, -6 - index * 2];
  const segment = b.bone(`bone-neck-segment-${index + 1}`, neckParent, pivot, `neck_segment_${index + 1}`);
  b.cube(`cube-neck-segment-${index + 1}`, segment, pivot, [0, 14.8 + index * 1.1, -7 - index * 2], [8 - index * 0.55, 5, 5], index % 2 === 0 ? T.obsidian : T.stone, { rotation: [-8, 0, index % 2 === 0 ? -2 : 2] });
  b.part(`neck-rune-${index + 1}`, segment, pivot, [0, 16.5 + index * 1.1, -7 - index * 2], [2, 2, 2], index % 2 === 0 ? T.cyan : T.magenta);
  b.part(`neck-spine-${index + 1}`, segment, pivot, [0, 18 + index * 1.1, -6.5 - index * 2], [2, 4, 2], T.brass, { rotation: [-8, 0, 0] });
  neckParent = segment;
}

b.part('head-skull', head, [0, 20, -17], [0, 20, -18], [11, 8, 10], T.obsidian);
b.part('head-crown', head, [0, 24, -17], [0, 24, -17], [10, 3, 8], T.stone);
b.part('head-snout', head, [0, 18.8, -23], [0, 18.8, -23], [9, 5, 7], T.stone);
b.part('head-nose', head, [0, 19, -27], [0, 19, -27], [6, 3, 2], T.void);
b.part('head-brow', head, [0, 21.7, -23], [0, 21.7, -23], [10, 2, 3], T.brass);
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`cheek-armor-${sideName}`, head, [side * 5.5, 18.5, -21], [side * 5.5, 18.5, -21], [3, 5, 6], T.brass, { rotation: [0, 0, side * 10] });
  b.part(`horn-main-${sideName}`, head, [side * 4, 24, -16], [side * 7, 27, -14], [3, 10, 3], T.ivory, { rotation: [-20, 0, side * -35] });
  b.part(`horn-tip-${sideName}`, head, [side * 7, 28, -13], [side * 9.5, 31, -11], [2, 8, 2], T.brass, { rotation: [-25, 0, side * -42] });
}
b.part('jaw-main', jaw, [0, 18, -20], [0, 16.5, -23], [9, 3, 8], T.obsidian);
b.part('jaw-altar', jaw, [0, 18, -20], [0, 15, -23], [7, 2, 7], T.brass);
for (let index = 0; index < 8; index += 1) {
  const x = -4.2 + index * 1.2;
  b.part(`upper-fang-${index + 1}`, head, [x, 17.5, -26], [x, 17.5, -26], [1, 3 + index % 2, 1], T.ivory);
  b.part(`lower-fang-${index + 1}`, jaw, [0, 18, -20], [x, 17.2, -26], [1, 3 + (index + 1) % 2, 1], T.ivory, { rotation: [0, 0, 180] });
}

let tailParent = tail;
for (let index = 0; index < 10; index += 1) {
  const wave = Math.sin(index * 0.72) * (1 + index * 0.28);
  const pivot: Vec3 = [wave, 10 + index * 0.28, 8 + index * 3];
  const segment = b.bone(`bone-tail-segment-${index + 1}`, tailParent, pivot, `tail_segment_${index + 1}`);
  b.cube(`cube-tail-segment-${index + 1}`, segment, pivot, [wave, 10.2 + index * 0.28, 9.7 + index * 3], [7 - index * 0.48, 5 - index * 0.32, 5], index % 2 === 0 ? T.obsidian : T.stone, { rotation: [0, Math.cos(index * 0.7) * 12, 0] });
  b.part(`tail-spire-${index + 1}`, segment, pivot, [wave, 13 + index * 0.25, 9 + index * 3], [2, 4, 2], index === 9 ? T.magenta : T.brass, { rotation: [8, 0, 0] });
  tailParent = segment;
}

for (const [name, x, z] of [['front-left', -5, -4], ['front-right', 5, -4], ['rear-left', -5, 5], ['rear-right', 5, 5]] as const) {
  const pivot: Vec3 = [x, 9, z];
  const leg = b.bone(`bone-leg-${name}`, body, pivot, `leg_${name}`);
  b.part(`leg-${name}-hip`, leg, pivot, [x, 8.5, z], [5, 5, 5], T.brass);
  b.part(`leg-${name}-thigh`, leg, pivot, [x, 6, z], [4, 7, 4], T.obsidian);
  b.part(`leg-${name}-knee`, leg, pivot, [x, 3.5, z - 0.5], [5, 4, 5], T.stone);
  b.part(`leg-${name}-shin`, leg, pivot, [x, 1.3, z - 1], [3, 6, 3], T.brass, { rotation: [-8, 0, 0] });
  b.part(`leg-${name}-foot`, leg, pivot, [x, -1, z - 3], [6, 2, 8], T.void);
  for (let claw = 0; claw < 4; claw += 1) {
    b.part(`leg-${name}-claw-${claw + 1}`, leg, pivot, [x - 2.2 + claw * 1.5, -1.2, z - 7], [1, 1, 4], T.ivory);
  }
}

const buildWing = (side: -1 | 1, parent: string): void => {
  const sideName = side < 0 ? 'left' : 'right';
  for (let column = 0; column < 5; column += 1) {
    const x = side * (7 + column * 4.5);
    const y = 16 + column * 2.3;
    const z = 1 + column * 0.7;
    b.part(`wing-${sideName}-rib-${column + 1}`, parent, [side * 5, 15, 1], [x, y, z], [2, 10 - column * 0.5, 2], column === 4 ? T.brass : T.stone, { rotation: [0, 0, side * -(16 + column * 3)] });
    b.part(`wing-${sideName}-spire-${column + 1}`, parent, [side * 5, 15, 1], [x + side * 0.8, y + 6, z], [2, 7 - column * 0.5, 2], column % 2 === 0 ? T.ivory : T.brass, { rotation: [0, 0, side * -(20 + column * 3)] });
    if (column < 4) {
      for (let row = 0; row < 3; row += 1) {
        const panelX = side * (9.25 + column * 4.5);
        const panelY = 13.7 + column * 2.3 + row * 3;
        b.part(`wing-${sideName}-panel-${column + 1}-${row + 1}`, parent, [side * 5, 15, 1], [panelX, panelY, z + 0.2], [4, 3, 1], (column + row) % 2 === 0 ? T.cyan : T.magenta, { rotation: [0, 0, side * -(8 + column * 2)] });
      }
      b.part(`wing-${sideName}-tracery-${column + 1}`, parent, [side * 5, 15, 1], [side * (9.25 + column * 4.5), 19 + column * 2.3, z - 0.5], [4, 1, 2], T.brass, { rotation: [0, 0, side * -(8 + column * 2)] });
    }
  }
  for (let feather = 0; feather < 8; feather += 1) {
    b.part(`wing-${sideName}-reliquary-${feather + 1}`, parent, [side * 5, 15, 1], [side * (8 + feather * 2.5), 10 + feather * 0.7, 3 + feather * 0.5], [3, 7, 2], feather % 3 === 0 ? T.magenta : T.obsidian, { rotation: [12, 0, side * -(12 + feather * 2)] });
  }
};
buildWing(-1, leftWing);
buildWing(1, rightWing);

const idleChannels = [
  demoChannel('wyrm-idle-root', root, 'position', [[0, [0, 0, 0]], [1.8, [0, 0.4, 0]], [3.6, [0, 0, 0]]]),
  demoChannel('wyrm-idle-face-surface', 'bone:wyrm.face.surface', 'position', [[0, [0, 0, 0]], [1.8, [0, 0.4, 0]], [3.6, [0, 0, 0]]]),
  demoChannel('wyrm-idle-left-wing', leftWing, 'rotation', [[0, [0, 0, -2]], [1.8, [0, 0, 3]], [3.6, [0, 0, -2]]]),
  demoChannel('wyrm-idle-right-wing', rightWing, 'rotation', [[0, [0, 0, 2]], [1.8, [0, 0, -3]], [3.6, [0, 0, 2]]]),
  demoChannel('wyrm-idle-tail', tail, 'rotation', [[0, [0, -4, 0]], [1.8, [0, 5, 0]], [3.6, [0, -4, 0]]]),
  demoChannel('wyrm-idle-core', chest, 'scale', [[0, [1, 1, 1]], [0.9, [1.18, 1.18, 1.18]], [1.8, [1, 1, 1]], [2.7, [1.18, 1.18, 1.18]], [3.6, [1, 1, 1]]])
];

const awakenChannels = [
  demoChannel('wyrm-awaken-root', root, 'position', [[0, [0, -5, 0]], [0.7, [0, -5, 0]], [1.35, [0, 2.5, 0]], [1.75, [0, 0, 0]], [3.8, [0, 0, 0]]]),
  demoChannel('wyrm-awaken-face-surface', 'bone:wyrm.face.surface', 'position', [[0, [0, -5, 0]], [0.7, [0, -5, 0]], [1.35, [0, 2.5, 0]], [1.75, [0, 0, 0]], [3.8, [0, 0, 0]]]),
  demoChannel('wyrm-awaken-wings-scale', wings, 'scale', [[0, [0.08, 0.08, 0.08]], [0.65, [0.08, 0.08, 0.08]], [1.65, [1.18, 1.18, 1.18]], [2, [1, 1, 1]], [3.8, [1, 1, 1]]]),
  demoChannel('wyrm-awaken-left-wing', leftWing, 'rotation', [[0, [0, 0, 88]], [0.7, [0, 0, 88]], [1.7, [0, 0, -8]], [2.05, [0, 0, 0]], [3.8, [0, 0, 0]]]),
  demoChannel('wyrm-awaken-right-wing', rightWing, 'rotation', [[0, [0, 0, -88]], [0.7, [0, 0, -88]], [1.7, [0, 0, 8]], [2.05, [0, 0, 0]], [3.8, [0, 0, 0]]]),
  demoChannel('wyrm-awaken-halo-scale', halo, 'scale', [[0, [0.05, 0.05, 0.05]], [1.15, [0.05, 0.05, 0.05]], [1.85, [1.45, 1.45, 1.45]], [2.2, [1, 1, 1]], [3.8, [1, 1, 1]]]),
  demoChannel('wyrm-awaken-halo-spin', halo, 'rotation', [[0, [0, 0, -120]], [1.15, [0, 0, -120]], [2.6, [0, 0, 24]], [3.8, [0, 0, 0]]]),
  demoChannel('wyrm-awaken-jaw', jaw, 'rotation', [[0, [38, 0, 0]], [1.2, [38, 0, 0]], [1.65, [-12, 0, 0]], [2.1, [8, 0, 0]], [2.55, [0, 0, 0]], [3.8, [0, 0, 0]]])
];

const triggers: AnimationTriggerInput[] = [{ id: 'wyrm-awaken-sound', type: 'sound', keys: [{ id: 'wyrm-awaken-sound-key', timeSeconds: 1.34, value: { effect: 'ashfox:eclipse_cathedral_roar', bindToActor: true } }] }, { id: 'wyrm-awaken-particle', type: 'particle', keys: [{ id: 'wyrm-awaken-particle-key', timeSeconds: 1.82, value: { effect: 'ashfox:stained_eclipse_corona' } }] }, { id: 'wyrm-awaken-timeline', type: 'timeline', keys: [{ id: 'wyrm-awaken-timeline-key', timeSeconds: 2.05, value: 'LET THE FALSE SUN KNEEL' }] }];

export const ECLIPSE_CATHEDRAL_WYRM_DEMO: DemoDefinition = {
  id: 'project-showcase-eclipse-cathedral-wyrm', slug: 'eclipse-cathedral-wyrm', name: 'Eclipse Cathedral · Reliquary Wyrm', modelPath: 'eclipse_cathedral_wyrm', initialSelectionId: chest, visibleEyeCount: 2,
  intent: { subject: 'mechanical cathedral dragon with stained-glass wings', grounding: 'free', features: ['enormous stained-glass cathedral wing silhouette', 'fully articulated dragon head legs neck and tail', 'eclipse reliquary core with cinematic awakening'] },
  surfacePixelDensity: 2,
  textures: [
    { id: T.obsidian, name: 'Eclipse obsidian', background: '#222338' }, { id: T.stone, name: 'Cathedral stone', background: '#747784' },
    { id: T.brass, name: 'Sacred brass', background: '#bd9145' }, { id: T.cyan, name: 'Cyan stained glass', background: '#36cbd2' },
    { id: T.magenta, name: 'Magenta stained glass', background: '#b5418a' }, { id: T.ivory, name: 'Dragon ivory', background: '#e4d9b9' },
    { id: T.void, name: 'Living void', background: '#11131f' }
  ],
  parts: demoSurfaceEyes(
    'wyrm.face.surface',
    [-10, 42, -54],
    [20, 6],
    T.void,
    [{ id: 'wyrm.eye.left', anchor: [-6, 45, -54], size: [8, 6], irisMaterialId: T.cyan },
      { id: 'wyrm.eye.right', anchor: [6, 45, -54], size: [8, 6], irisMaterialId: T.magenta }]
  ),
  bones: b.bones, cubes: b.cubes,
  animations: [
    { id: 'idle', name: 'Cathedral Wyrm Idle', durationSeconds: 3.6, fps: 20, loop: 'loop', channels: idleChannels },
    { id: 'animation-eclipse-cathedral-awaken', name: 'Eclipse Cathedral Awakening', durationSeconds: 3.8, fps: 24, loop: 'hold_on_last_frame', channels: awakenChannels, triggers }
  ]
};
