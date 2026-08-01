import type { AnimationTriggerInput, Vec3 } from '@ashfox/engine-core';

import { demoChannel, type DemoDefinition } from './demoFactory';
import { createShowcaseDemoBuilder } from './showcaseDemoBuilder';

const T = {
  stone: 'texture-bellwalker-weathered-stone',
  dark: 'texture-bellwalker-dark-stone',
  moss: 'texture-bellwalker-living-moss',
  wood: 'texture-bellwalker-temple-wood',
  brass: 'texture-bellwalker-bell-brass',
  spirit: 'texture-bellwalker-spirit-lantern'
} as const;

const b = createShowcaseDemoBuilder();
const root = b.bone('bone-root', null, [0, 0, 0], 'root');
const walker = b.bone('bone-walker', root, [0, 7, 0], 'mossback_walker');
const shrine = b.bone('bone-shrine', walker, [0, 11, 0], 'bell_shrine');
const bell = b.bone('bone-great-bell', shrine, [0, 15, -3], 'great_bell');
const roofCrown = b.bone('bone-roof-crown', shrine, [0, 20, 0], 'opening_roof');
const orrery = b.bone('bone-orrery', roofCrown, [0, 22, 0], 'star_orrery');

b.part('walker-core', walker, [0, 7, 0], [0, 7.5, 0], [14, 6, 12], T.dark);
b.part('walker-deck', walker, [0, 10.5, 0], [0, 10.5, 0], [17, 2, 15], T.stone);
b.part('walker-keel', walker, [0, 4.4, 0], [0, 4.4, 0], [12, 2, 10], T.stone);
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  b.part(`deck-brace-${sideName}`, walker, [side * 7.5, 8, 0], [side * 7.5, 8, 0], [2, 5, 12], T.wood);
  b.part(`moss-skirt-${sideName}`, walker, [side * 8.4, 9.5, 0], [side * 8.4, 9.5, 0], [1, 2, 11], T.moss);
}

const legRoots: string[] = [];
for (const side of [-1, 1] as const) {
  const sideName = side < 0 ? 'left' : 'right';
  for (let row = 0; row < 3; row += 1) {
    const z = -4.5 + row * 4.5;
    const hipPivot: Vec3 = [side * 6.5, 7.3, z];
    const leg = b.bone(`bone-leg-${sideName}-${row + 1}`, walker, hipPivot, `leg_${sideName}_${row + 1}`);
    legRoots.push(leg);
    b.part(`leg-${sideName}-${row + 1}-hip`, leg, hipPivot, [side * 7.5, 6.8, z], [4, 3, 3], T.brass, { rotation: [0, 0, side * -16] });
    b.part(`leg-${sideName}-${row + 1}-upper`, leg, hipPivot, [side * 9.2, 5.2, z], [3, 6, 3], T.stone, { rotation: [0, 0, side * -28] });
    b.part(`leg-${sideName}-${row + 1}-moss`, leg, hipPivot, [side * 10.4, 3.6, z], [3, 2, 4], T.moss);
    b.part(`leg-${sideName}-${row + 1}-lower`, leg, hipPivot, [side * 10.7, 2.1, z], [2, 4, 2], T.dark, { rotation: [0, 0, side * 10] });
    b.part(`leg-${sideName}-${row + 1}-foot`, leg, hipPivot, [side * 11.1, 0.5, z - 0.5], [5, 1, 5], T.stone);
    for (let toe = 0; toe < 3; toe += 1) {
      b.part(`leg-${sideName}-${row + 1}-toe-${toe + 1}`, leg, hipPivot, [side * (11.7 + toe * 0.45), 0.3, z - 2.4 + toe * 1.5], [2, 1, 2], T.dark);
    }
  }
}

for (const x of [-5, 5]) {
  for (const z of [-4, 4]) {
    b.part(`shrine-post-${x}-${z}`, shrine, [x, 14.5, z], [x, 14.5, z], [2, 9, 2], T.wood);
    b.part(`shrine-post-foot-${x}-${z}`, shrine, [x, 10.8, z], [x, 10.8, z], [3, 2, 3], T.brass);
    b.part(`roof-chain-${x}-${z}`, shrine, [x, 17.7, z], [x, 17.7, z], [1, 5, 1], T.brass);
  }
}
b.part('shrine-back-wall', shrine, [0, 14.5, 4.5], [0, 14.5, 4.5], [11, 8, 2], T.stone);
b.part('shrine-crossbeam-front', shrine, [0, 18, -4.5], [0, 18, -4.5], [13, 2, 2], T.wood);
b.part('shrine-crossbeam-rear', shrine, [0, 18, 4.5], [0, 18, 4.5], [13, 2, 2], T.wood);
b.part('bell-yoke', bell, [0, 15, -3], [0, 17.2, -3], [7, 2, 2], T.wood);
b.part('bell-neck', bell, [0, 15, -3], [0, 15.8, -3], [2, 3, 2], T.brass);
b.part('bell-body', bell, [0, 15, -3], [0, 13.8, -3], [6, 5, 6], T.brass);
b.part('bell-rim', bell, [0, 15, -3], [0, 11.5, -3], [8, 2, 8], T.dark);
b.part('bell-clapper', bell, [0, 15, -3], [0, 10.2, -3], [2, 4, 2], T.brass);

for (let tier = 0; tier < 3; tier += 1) {
  const y = 18.8 + tier * 2.1;
  const width = 17 - tier * 4;
  const depth = 15 - tier * 3;
  const parent = tier === 2 ? roofCrown : shrine;
  b.part(`roof-tier-${tier + 1}`, parent, [0, y, 0], [0, y, 0], [width, 1, depth], tier === 1 ? T.moss : T.dark);
  b.part(`roof-tier-${tier + 1}-ridge`, parent, [0, y + 0.8, 0], [0, y + 0.8, 0], [3, 1, depth + 1], T.brass);
  for (const x of [-1, 1] as const) {
    for (const z of [-1, 1] as const) {
      b.part(`roof-tier-${tier + 1}-tip-${x}-${z}`, parent, [x * width / 2, y, z * depth / 2], [x * (width / 2 + 0.8), y + 0.7, z * (depth / 2 + 0.5)], [3, 2, 3], T.brass, { rotation: [z * 12, 0, x * -12] });
    }
  }
}

for (let index = 0; index < 16; index += 1) {
  const angle = index * 22.5;
  const radians = angle * Math.PI / 180;
  const radius = index % 2 === 0 ? 6.5 : 5.2;
  const center: Vec3 = [Math.sin(radians) * radius, 22 + Math.cos(radians) * radius, 0];
  b.part(`orrery-star-${index + 1}`, orrery, [0, 22, 0], center, [1, index % 2 === 0 ? 3 : 2, 1], index % 4 === 0 ? T.brass : T.spirit, { rotation: [0, 0, -angle] });
}
b.part('orrery-axis', orrery, [0, 22, 0], [0, 22, 0], [2, 12, 2], T.brass);
b.part('orrery-heart', orrery, [0, 22, 0], [0, 22, 0], [4, 4, 4], T.spirit, { rotation: [0, 45, 45] });

for (const [name, x, z] of [['front-left', -6.5, -6], ['front-right', 6.5, -6], ['rear-left', -6.5, 6], ['rear-right', 6.5, 6]] as const) {
  b.part(`lantern-${name}-cap`, shrine, [x, 14, z], [x, 16, z], [3, 2, 3], T.brass);
  b.part(`lantern-${name}-spirit`, shrine, [x, 14, z], [x, 14, z], [2, 3, 2], T.spirit);
  b.part(`lantern-${name}-base`, shrine, [x, 14, z], [x, 12, z], [3, 1, 3], T.dark);
}

for (let index = 0; index < 20; index += 1) {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 4);
  const z = -5 + (index % 4) * 3.3;
  b.part(`moss-clump-${index + 1}`, walker, [side * (5.5 + row % 2), 10.8 + row * 0.15, z], [side * (5.5 + row % 2), 10.8 + row * 0.15, z], [2, 1 + index % 3, 2], T.moss, { rotation: [0, index * 19, side * 8] });
}

const idleChannels = [
  demoChannel('bellwalker-idle-root', root, 'position', [[0, [0, 0, 0]], [1.8, [0, 0.35, 0]], [3.6, [0, 0, 0]]]),
  demoChannel('bellwalker-idle-bell', bell, 'rotation', [[0, [0, 0, -7]], [0.9, [0, 0, 7]], [1.8, [0, 0, -5]], [2.7, [0, 0, 6]], [3.6, [0, 0, -7]]]),
  demoChannel('bellwalker-idle-orrery', orrery, 'rotation', [[0, [0, 0, 0]], [1.8, [0, 0, 12]], [3.6, [0, 0, 0]]]),
  ...legRoots.map((id, index) => demoChannel(`bellwalker-idle-leg-${index + 1}`, id, 'rotation', [[0, [0, 0, index % 2 === 0 ? -3 : 3]], [1.8, [0, 0, index % 2 === 0 ? 3 : -3]], [3.6, [0, 0, index % 2 === 0 ? -3 : 3]]]))
];

const awakenChannels = [
  demoChannel('bellwalker-awaken-root', root, 'position', [[0, [0, -2, 0]], [0.7, [0, -2, 0]], [1.2, [0, 1.2, 0]], [1.55, [0, 0, 0]], [3.4, [0, 0, 0]]]),
  demoChannel('bellwalker-awaken-roof', roofCrown, 'scale', [[0, [1, 0.08, 1]], [0.65, [1, 0.08, 1]], [1.35, [1.15, 1.2, 1.15]], [1.7, [1, 1, 1]], [3.4, [1, 1, 1]]]),
  demoChannel('bellwalker-awaken-orrery-scale', orrery, 'scale', [[0, [0.05, 0.05, 0.05]], [0.9, [0.05, 0.05, 0.05]], [1.65, [1.3, 1.3, 1.3]], [2, [1, 1, 1]], [3.4, [1, 1, 1]]]),
  demoChannel('bellwalker-awaken-orrery-spin', orrery, 'rotation', [[0, [0, 0, -90]], [0.9, [0, 0, -90]], [2.5, [0, 0, 25]], [3.4, [0, 0, 0]]]),
  demoChannel('bellwalker-awaken-bell', bell, 'rotation', [[0, [0, 0, 0]], [1.1, [0, 0, 0]], [1.45, [0, 0, -24]], [1.8, [0, 0, 18]], [2.25, [0, 0, -8]], [3.4, [0, 0, 0]]])
];

const triggers: AnimationTriggerInput[] = [{
  id: 'bellwalker-awaken-sound', type: 'sound', keys: [{ id: 'bellwalker-awaken-sound-key', timeSeconds: 1.42, value: { effect: 'ashfox:temple_bell_awaken', bindToActor: true } }]
}, {
  id: 'bellwalker-awaken-timeline', type: 'timeline', keys: [{ id: 'bellwalker-awaken-timeline-key', timeSeconds: 1.65, value: 'THE OLD ROAD REMEMBERS' }]
}];

export const MOSSBACK_BELLWALKER_DEMO: DemoDefinition = {
  id: 'project-showcase-mossback-bellwalker', slug: 'mossback-bellwalker', name: 'Mossback · Bellwalker Shrine', modelPath: 'mossback_bellwalker', initialSelectionId: bell, visibleEyeCount: 0,
  intent: { subject: 'six-legged walking moss temple with a great bell', grounding: 'free', features: ['ancient pagoda silhouette', 'six articulated stone legs', 'opening roof and celestial orrery'] },
  textures: [
    { id: T.stone, name: 'Weathered shrine stone', background: '#7c8174' }, { id: T.dark, name: 'Rain-dark basalt', background: '#343b3a' },
    { id: T.moss, name: 'Living temple moss', background: '#5d7a45' }, { id: T.wood, name: 'Old cedar beam', background: '#704934' },
    { id: T.brass, name: 'Ceremonial brass', background: '#b18a45' }, { id: T.spirit, name: 'Wayfinder flame', background: '#52ced0' }
  ],
  bones: b.bones, cubes: b.cubes,
  animations: [
    { id: 'idle', name: 'Bellwalker Pilgrimage Idle', durationSeconds: 3.6, fps: 20, loop: 'loop', channels: idleChannels },
    { id: 'animation-bellwalker-observatory', name: 'Ancient Observatory Awakening', durationSeconds: 3.4, fps: 24, loop: 'hold_on_last_frame', channels: awakenChannels, triggers }
  ]
};
