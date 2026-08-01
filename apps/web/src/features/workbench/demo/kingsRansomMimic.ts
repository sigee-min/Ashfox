import type {
  AnimationTriggerInput,
  Vec3
} from '@ashfox/engine-core';

import {
  demoChannel,
  demoSurfaceEyes,
  type DemoDefinition
} from './demoFactory';
import {
  createShowcaseDemoBuilder
} from './showcaseDemoBuilder';

const T = {
  oak: 'texture-mimic-royal-oak',
  dark: 'texture-mimic-darkwood',
  gold: 'texture-mimic-crown-gold',
  ruby: 'texture-mimic-ruby',
  void: 'texture-mimic-void',
  tooth: 'texture-mimic-ivory',
  coin: 'texture-mimic-coin'
} as const;

const b = createShowcaseDemoBuilder();
const root = b.bone('bone-root', null, [0, 0, 0], 'root');
const chest = b.bone('bone-chest', root, [0, 6, 0], 'royal_chest');
const lidPivot: Vec3 = [0, 10, 4.5];
const lid = b.bone('bone-lid', chest, lidPivot, 'crowned_lid');
const jaw = b.bone('bone-jaw', chest, [0, 8.5, -4.5], 'coin_jaw');
const limbs = b.bone('bone-limbs', chest, [0, 4, 0], 'unfolding_limbs');
const eye = b.bone('bone-eye-core', chest, [0, 7.4, -5], 'royal_lock_eye');
const crown = b.bone('bone-crown', lid, [0, 14, 0.8], 'crooked_crown');
const coins = b.bone('bone-coin-swarm', jaw, [0, 6.5, -6], 'coin_spew');

b.part('body-main', chest, [0, 6, 0], [0, 6.2, 0], [14, 7, 9], T.oak);
b.part('body-inner-shadow', chest, [0, 7.5, -4.6], [0, 7.6, -4.7], [11, 4, 1], T.dark);
b.part('body-plinth', chest, [0, 2.8, 0], [0, 2.8, 0], [15, 2, 10], T.dark);
b.part('body-plinth-gold', chest, [0, 3.7, 0], [0, 3.7, 0], [15, 1, 10], T.gold);
b.part('body-top-rail', chest, [0, 9.2, 0], [0, 9.2, 0], [15, 1, 10], T.gold);

for (const side of [-1, 1] as const) {
  b.part(
    `body-corner-${side < 0 ? 'left' : 'right'}-front`,
    chest,
    [side * 6.5, 6, -4.6],
    [side * 6.5, 6, -4.6],
    [1, 7, 1],
    T.gold
  );
  b.part(
    `body-corner-${side < 0 ? 'left' : 'right'}-rear`,
    chest,
    [side * 6.5, 6, 4.6],
    [side * 6.5, 6, 4.6],
    [1, 7, 1],
    T.gold
  );
  b.part(
    `side-handle-${side < 0 ? 'left' : 'right'}-bar`,
    chest,
    [side * 7.3, 6.6, 0],
    [side * 7.3, 6.6, 0],
    [1, 1, 5],
    T.gold
  );
  for (const z of [-2.2, 2.2]) {
    b.part(
      `side-handle-${side < 0 ? 'left' : 'right'}-${z < 0 ? 'front' : 'rear'}`,
      chest,
      [side * 7.3, 6, z],
      [side * 7.3, 6, z],
      [1, 2, 1],
      T.gold
    );
  }
}

const lidRotation: Vec3 = [-28, 0, 0];
b.part('lid-shell', lid, lidPivot, [0, 11.6, 1.8], [14, 4, 9], T.oak, {
  rotation: lidRotation
});
b.part('lid-dark-cap', lid, lidPivot, [0, 13.2, 2.5], [13, 1, 8], T.dark, {
  rotation: lidRotation
});
b.part('lid-front-band', lid, lidPivot, [0, 11.9, -2.2], [15, 1, 1], T.gold, {
  rotation: lidRotation
});
b.part('lid-rear-band', lid, lidPivot, [0, 11.9, 5.1], [15, 1, 1], T.gold, {
  rotation: lidRotation
});
for (const side of [-1, 1] as const) {
  b.part(
    `lid-side-band-${side < 0 ? 'left' : 'right'}`,
    lid,
    lidPivot,
    [side * 6.6, 12, 1.6],
    [1, 4, 8],
    T.gold,
    { rotation: lidRotation }
  );
}

b.part('lock-crest-plate', eye, [0, 7.5, -5], [0, 7.5, -5.2], [5, 5, 1], T.gold);
b.part('lock-keyhole', eye, [0, 5.5, -5.4], [0, 5.5, -5.5], [1, 2, 1], T.void);

for (let index = 0; index < 10; index += 1) {
  const x = -5.4 + index * 1.2;
  b.part(
    `upper-tooth-${index + 1}`,
    lid,
    lidPivot,
    [x, 9.4 + (index % 2) * 0.25, -4.9],
    [1, 2 + (index % 3 === 0 ? 1 : 0), 1],
    T.tooth,
    { rotation: lidRotation }
  );
}
for (let index = 0; index < 9; index += 1) {
  const x = -4.8 + index * 1.2;
  b.part(
    `lower-tooth-${index + 1}`,
    jaw,
    [0, 8.5, -4.5],
    [x, 9.2, -5.2],
    [1, 2 + (index % 2), 1],
    T.tooth,
    { rotation: [0, 0, 180] }
  );
}

for (const [name, x, z] of [
  ['front-left', -5, -3],
  ['front-right', 5, -3],
  ['rear-left', -5, 3],
  ['rear-right', 5, 3]
] as const) {
  const hipPivot: Vec3 = [x, 4, z];
  const hip = b.bone(`bone-leg-${name}`, limbs, hipPivot, `leg_${name}`);
  b.part(`leg-${name}-armor`, hip, hipPivot, [x, 3.6, z], [3, 4, 3], T.dark);
  b.part(`leg-${name}-gold`, hip, hipPivot, [x, 2.6, z], [3, 1, 3], T.gold);
  b.part(`leg-${name}-shin`, hip, hipPivot, [x, 1.5, z], [2, 3, 2], T.oak);
  b.part(
    `leg-${name}-foot`,
    hip,
    hipPivot,
    [x, 0.4, z - (z < 0 ? 0.8 : -0.8)],
    [4, 1, 4],
    T.dark
  );
  for (let claw = 0; claw < 3; claw += 1) {
    b.part(
      `leg-${name}-claw-${claw + 1}`,
      hip,
      hipPivot,
      [x - 1 + claw, 0.3, z - (z < 0 ? 2.5 : -2.5)],
      [1, 1, 2],
      T.tooth
    );
  }
}

b.part('crown-base', crown, [0, 14, 1], [0, 14.2, 1], [8, 2, 4], T.gold, {
  rotation: [0, 0, -4]
});
for (let index = 0; index < 5; index += 1) {
  const x = -3.2 + index * 1.6;
  const height = index === 2 ? 5 : index % 2 === 0 ? 4 : 3;
  b.part(
    `crown-point-${index + 1}`,
    crown,
    [0, 14, 1],
    [x, 15.5 + height / 2, 1],
    [1, height, 2],
    index === 2 ? T.ruby : T.gold,
    { rotation: [0, 0, -4 + (index - 2) * 3] }
  );
}
for (const side of [-1, 1] as const) {
  b.part(
    `crown-ruby-${side < 0 ? 'left' : 'right'}`,
    crown,
    [side * 2.4, 14.7, -0.8],
    [side * 2.4, 14.7, -0.8],
    [1, 1, 1],
    T.ruby
  );
}

for (let index = 0; index < 16; index += 1) {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2) % 4;
  const rear = index >= 8;
  const pivot: Vec3 = [side * 6.7, 4.7 + row * 1.35, rear ? 4.7 : -4.7];
  b.part(`royal-rivet-${index + 1}`, chest, pivot, pivot, [1, 1, 1], T.gold);
}
for (let index = 0; index < 18; index += 1) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const pivot: Vec3 = [-5 + column * 2, 4.6 + row * 2, -5.25];
  b.part(
    `front-filigree-${index + 1}`,
    chest,
    pivot,
    pivot,
    [1, 1, 1],
    (column + row) % 3 === 0 ? T.ruby : T.gold
  );
}

for (let index = 0; index < 12; index += 1) {
  const column = index % 4;
  const row = Math.floor(index / 4);
  const pivot: Vec3 = [
    -3 + column * 2,
    3.9 + row * 0.5,
    -6.3 - row * 0.7
  ];
  b.part(
    `flying-coin-${index + 1}`,
    coins,
    [0, 6.5, -6],
    pivot,
    [2, 1, 2],
    T.coin,
    { rotation: [0, index * 23, index % 2 === 0 ? 20 : -20] }
  );
}

const idleChannels = [
  demoChannel('mimic-idle-lid', lid, 'rotation', [
    [0, [0, 0, 0]],
    [1.2, [-3, 0, 0]],
    [2.4, [0, 0, 0]]
  ]),
  demoChannel('mimic-idle-lock-surface', 'bone:mimic.lock.surface', 'position', [
    [0, [0, 0, 0]],
    [1.2, [0, 0.25, 0]],
    [2.4, [0, 0, 0]]
  ]),
  demoChannel('mimic-idle-coins', coins, 'rotation', [
    [0, [0, -4, 0]],
    [1.2, [0, 5, 0]],
    [2.4, [0, -4, 0]]
  ]),
  demoChannel('mimic-idle-root', root, 'position', [
    [0, [0, 0, 0]],
    [1.2, [0, 0.25, 0]],
    [2.4, [0, 0, 0]]
  ])
];

const awakenChannels = [
  demoChannel('mimic-awaken-root', root, 'position', [
    [0, [0, -3.2, 0]],
    [0.6, [0, -3.2, 0]],
    [1.05, [0, 1.6, 0]],
    [1.35, [0, 0, 0]],
    [2.6, [0, 0, 0]]
  ]),
  demoChannel('mimic-awaken-lid', lid, 'rotation', [
    [0, [58, 0, 0]],
    [0.55, [58, 0, 0]],
    [0.95, [-8, 0, 0]],
    [1.25, [4, 0, 0]],
    [1.5, [0, 0, 0]],
    [2.6, [0, 0, 0]]
  ]),
  demoChannel('mimic-awaken-limbs', limbs, 'scale', [
    [0, [0.08, 0.08, 0.08]],
    [0.55, [0.08, 0.08, 0.08]],
    [1.15, [1.15, 0.85, 1.15]],
    [1.45, [1, 1, 1]],
    [2.6, [1, 1, 1]]
  ]),
  demoChannel('mimic-awaken-lock-surface', 'bone:mimic.lock.surface', 'position', [
    [0, [0, -3.2, 0]],
    [0.6, [0, -3.2, 0]],
    [1.05, [0, 1.6, 0]],
    [1.35, [0, 0, 0]],
    [2.6, [0, 0, 0]]
  ]),
  demoChannel('mimic-awaken-coins', coins, 'scale', [
    [0, [0.05, 0.05, 0.05]],
    [1, [0.05, 0.05, 0.05]],
    [1.45, [1.2, 1.2, 1.2]],
    [1.8, [1, 1, 1]],
    [2.6, [1, 1, 1]]
  ]),
  demoChannel('mimic-awaken-crown', crown, 'rotation', [
    [0, [0, 0, -18]],
    [0.7, [0, 0, -18]],
    [1.2, [0, 0, 8]],
    [1.55, [0, 0, 0]],
    [2.6, [0, 0, 0]]
  ])
];

const triggers: AnimationTriggerInput[] = [
  {
    id: 'mimic-awaken-sound',
    type: 'sound',
    keys: [{
      id: 'mimic-awaken-sound-key',
      timeSeconds: 0.72,
      value: {
        effect: 'ashfox:mimic_crown_snap',
        bindToActor: true
      }
    }]
  },
  {
    id: 'mimic-awaken-timeline',
    type: 'timeline',
    keys: [{
      id: 'mimic-awaken-timeline-key',
      timeSeconds: 1.05,
      value: 'THE KING DEMANDS TRIBUTE'
    }]
  }
];

export const KINGS_RANSOM_MIMIC_DEMO: DemoDefinition = {
  id: 'project-showcase-kings-ransom-mimic',
  slug: 'kings-ransom-mimic',
  name: "King's Ransom · Royal Vault Mimic",
  modelPath: 'kings_ransom_mimic',
  initialSelectionId: 'bone:mimic.lock.surface',
  visibleEyeCount: 1,
  intent: {
    subject: 'royal treasure chest mimic boss',
    grounding: 'free',
    features: [
      'instantly readable crowned treasure chest silhouette',
      'four articulated clawed legs and a coin-filled maw',
      'expressive ruby lock eye and transformation animation'
    ]
  },
  surfacePixelDensity: 2,
  textures: [
    { id: T.oak, name: 'Royal oak', background: '#7b3f24' },
    { id: T.dark, name: 'Cursed darkwood', background: '#281b24' },
    { id: T.gold, name: 'Crown gold', background: '#d29b32' },
    { id: T.ruby, name: 'Royal ruby', background: '#9f2448' },
    { id: T.void, name: 'Mimic void', background: '#17101f' },
    { id: T.tooth, name: 'Old ivory', background: '#e8d9ad' },
    { id: T.coin, name: 'Living coin', background: '#efbd4e' }
  ],
  parts: demoSurfaceEyes(
    'mimic.lock.surface',
    [-4, 12, -13],
    [8, 6],
    T.void,
    [{
      id: 'mimic.eye',
      anchor: [0, 15, -13],
      size: [8, 6],
      irisMaterialId: T.ruby
    }]
  ),
  bones: b.bones,
  cubes: b.cubes,
  animations: [
    {
      id: 'idle',
      name: "King's Ransom Idle",
      durationSeconds: 2.4,
      fps: 20,
      loop: 'loop',
      channels: idleChannels
    },
    {
      id: 'animation-kings-ransom-awaken',
      name: 'Royal Vault Awakening',
      durationSeconds: 2.6,
      fps: 24,
      loop: 'hold_on_last_frame',
      channels: awakenChannels,
      triggers
    }
  ]
};
