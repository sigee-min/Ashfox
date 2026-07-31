import type {
  AnimationTriggerInput,
  BoneCreateInput,
  Vec3
} from '@ashfox/engine-core';

import {
  demoBone,
  demoChannel,
  demoCube,
  type DemoCubeSpec,
  type DemoDefinition
} from './demoFactory';

export const MOONVEIL_TEXTURE_IDS = {
  coat: 'texture-moonveil-coat',
  moonlight: 'texture-moonveil-moonlight',
  gold: 'texture-moonveil-gold',
  hoof: 'texture-moonveil-hoof',
  eye: 'texture-moonveil-eye',
  aura: 'texture-moonveil-aura'
} as const;

const T = MOONVEIL_TEXTURE_IDS;
const bones: BoneCreateInput[] = [];
const cubes: DemoCubeSpec[] = [];
const pivots = new Map<string, Vec3>();

const addBone = (
  id: string,
  parentId: string | null,
  pivot: Vec3,
  name = id.replace(/^bone-/, '').replaceAll('-', '_')
): void => {
  bones.push(demoBone(id, parentId, pivot, name));
  pivots.set(id, pivot);
};

const pivotOf = (id: string): Vec3 => {
  const pivot = pivots.get(id);
  if (!pivot) {
    throw new Error(`Missing Moonveil Kirin pivot: ${id}`);
  }
  return pivot;
};

addBone('bone-root', null, [0, 0, 0], 'root');
addBone('bone-pelvis', 'bone-root', [0, 14, 3], 'pelvis');
addBone('bone-body', 'bone-pelvis', [0, 15, 0], 'body');
addBone('bone-chest', 'bone-body', [0, 17, -3], 'chest');
addBone('bone-neck-lower', 'bone-chest', [0, 19, -4.5], 'neck_lower');
addBone('bone-neck-upper', 'bone-neck-lower', [0, 22, -6.4], 'neck_upper');
addBone('bone-head', 'bone-neck-upper', [0, 24.5, -8.4], 'head');
addBone('bone-muzzle', 'bone-head', [0, 23.4, -10.5], 'muzzle');
addBone('bone-jaw', 'bone-muzzle', [0, 22.65, -10.2], 'jaw');
addBone('bone-ear-left', 'bone-head', [-2.1, 26, -7.9], 'ear_left');
addBone('bone-ear-right', 'bone-head', [2.1, 26, -7.9], 'ear_right');

for (const side of ['left', 'right'] as const) {
  const sign = side === 'left' ? -1 : 1;
  addBone(
    `bone-eye-${side}`,
    'bone-head',
    [sign * 1.45, 25.5, -10],
    `eye_${side}`
  );
  addBone(
    `bone-eyelid-${side}-upper`,
    `bone-eye-${side}`,
    [sign * 1.45, 25.9, -10.36],
    `eyelid_${side}_upper`
  );
  addBone(
    `bone-eyelid-${side}-lower`,
    `bone-eye-${side}`,
    [sign * 1.45, 25.12, -10.36],
    `eyelid_${side}_lower`
  );
}

const legData = [
  ['front-left', -3, -3.2],
  ['front-right', 3, -3.2],
  ['rear-left', -3.2, 3.5],
  ['rear-right', 3.2, 3.5]
] as const;

for (const [id, x, z] of legData) {
  addBone(`bone-leg-${id}-upper`, 'bone-body', [x, 14, z], `leg_${id}_upper`);
  addBone(`bone-leg-${id}-lower`, `bone-leg-${id}-upper`, [x, 8.5, z], `leg_${id}_lower`);
  addBone(`bone-leg-${id}-hoof`, `bone-leg-${id}-lower`, [x, 3.5, z - 0.35], `leg_${id}_hoof`);
}

let tailParent = 'bone-pelvis';
for (let index = 0; index < 16; index += 1) {
  const id = `bone-tail-${index + 1}`;
  const wave = Math.sin(index * 0.6) * 1.25;
  const pivot: Vec3 = [
    wave,
    15.2 + Math.sin(index * 0.38) * 1.8,
    5.3 + index * 1.15
  ];
  addBone(id, tailParent, pivot, `tail_${index + 1}`);
  tailParent = id;
}

for (let index = 0; index < 24; index += 1) {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const id = `bone-mane-${index + 1}`;
  const parentId = row < 3
    ? 'bone-head'
    : row < 6
      ? 'bone-neck-upper'
      : 'bone-neck-lower';
  addBone(
    id,
    parentId,
    [
      (column - 1) * 1.35,
      26 - row * 1.15,
      -6.5 + row * 0.56
    ],
    `mane_${index + 1}`
  );
}

for (const side of ['left', 'right'] as const) {
  const sign = side === 'left' ? -1 : 1;
  let antlerParent = 'bone-head';
  for (let segment = 0; segment < 10; segment += 1) {
    const id = `bone-antler-${side}-main-${segment + 1}`;
    const pivot: Vec3 = [
      sign * (1.35 + segment * 0.42),
      26.1 + segment * 1.12,
      -8 + Math.sin(segment * 0.65) * 0.8
    ];
    addBone(id, antlerParent, pivot, `antler_${side}_main_${segment + 1}`);
    antlerParent = id;
  }

  for (let branch = 0; branch < 3; branch += 1) {
    let branchParent = `bone-antler-${side}-main-${3 + branch * 2}`;
    for (let segment = 0; segment < 4; segment += 1) {
      const id = `bone-antler-${side}-branch-${branch + 1}-${segment + 1}`;
      const pivot: Vec3 = [
        sign * (3.1 + branch * 0.78 + segment * 0.52),
        29.5 + branch * 2.1 + segment * 0.82,
        -8.1 - branch * 0.55 - segment * 0.38
      ];
      addBone(
        id,
        branchParent,
        pivot,
        `antler_${side}_branch_${branch + 1}_${segment + 1}`
      );
      branchParent = id;
    }
  }
}

cubes.push(
  demoCube('cube-body-core', 'bone-body', pivotOf('bone-body'), [0, 15.2, 0], [7.8, 7.2, 10.8], T.coat),
  demoCube('cube-body-shoulders', 'bone-chest', pivotOf('bone-chest'), [0, 17.2, -3.2], [8.6, 7.6, 6], T.coat),
  demoCube('cube-body-saddle-mark', 'bone-body', pivotOf('bone-body'), [0, 18.9, 0.8], [5.8, 0.5, 6.6], T.gold),
  demoCube('cube-chest-moon', 'bone-chest', pivotOf('bone-chest'), [0, 17, -6.35], [4.2, 4.8, 0.45], T.aura),
  demoCube('cube-neck-lower', 'bone-neck-lower', pivotOf('bone-neck-lower'), [0, 20.2, -4.9], [4.8, 7.2, 4.8], T.coat, { rotation: [-18, 0, 0] }),
  demoCube('cube-neck-upper', 'bone-neck-upper', pivotOf('bone-neck-upper'), [0, 22.4, -6.7], [4.3, 5.5, 4.5], T.coat, { rotation: [-12, 0, 0] }),
  demoCube('cube-head', 'bone-head', pivotOf('bone-head'), [0, 24.3, -8.6], [5.8, 5.3, 5.5], T.coat),
  demoCube('cube-forehead-crown', 'bone-head', pivotOf('bone-head'), [0, 25.8, -10.65], [2.8, 2.3, 0.5], T.gold, { rotation: [0, 0, 45] }),
  demoCube('cube-muzzle-main', 'bone-muzzle', pivotOf('bone-muzzle'), [0, 23.2, -11.15], [4.4, 2.9, 4.2], T.moonlight),
  demoCube('cube-nose', 'bone-muzzle', pivotOf('bone-muzzle'), [0, 23.15, -13.45], [2.7, 1.8, 0.8], T.hoof),
  demoCube('cube-jaw', 'bone-jaw', pivotOf('bone-jaw'), [0, 22.3, -11.1], [3.7, 1.4, 3.1], T.moonlight),
  demoCube('cube-ear-left', 'bone-ear-left', pivotOf('bone-ear-left'), [-2.2, 27.3, -8], [1.7, 4.6, 1.2], T.coat, { rotation: [0, 0, -22] }),
  demoCube('cube-ear-right', 'bone-ear-right', pivotOf('bone-ear-right'), [2.2, 27.3, -8], [1.7, 4.6, 1.2], T.coat, { rotation: [0, 0, 22] }),
  demoCube('cube-ear-left-inner', 'bone-ear-left', pivotOf('bone-ear-left'), [-2.25, 27.3, -8.65], [0.75, 3.1, 0.5], T.gold, { rotation: [0, 0, -22] }),
  demoCube('cube-ear-right-inner', 'bone-ear-right', pivotOf('bone-ear-right'), [2.25, 27.3, -8.65], [0.75, 3.1, 0.5], T.gold, { rotation: [0, 0, 22] })
);

for (const side of ['left', 'right'] as const) {
  const sign = side === 'left' ? -1 : 1;
  const eyePivot = pivotOf(`bone-eye-${side}`);
  cubes.push(
    demoCube(
      `cube-eye-${side}-socket`,
      `bone-eye-${side}`,
      eyePivot,
      [sign * 1.45, 25.5, -11.42],
      [1.8, 1.65, 0.5],
      T.hoof
    ),
    demoCube(
      `cube-eye-${side}-iris`,
      `bone-eye-${side}`,
      eyePivot,
      [sign * 1.45, 25.5, -11.69],
      [1.15, 1.2, 0.22],
      T.eye
    ),
    demoCube(
      `cube-eye-${side}-pupil`,
      `bone-eye-${side}`,
      eyePivot,
      [sign * 1.45, 25.45, -11.84],
      [0.5, 0.78, 0.5],
      T.hoof
    ),
    demoCube(
      `cube-eye-${side}-glint`,
      `bone-eye-${side}`,
      eyePivot,
      [sign * 1.18, 25.8, -11.96],
      [0.5, 0.5, 0.5],
      T.moonlight
    ),
    demoCube(
      `cube-eyelid-${side}-upper`,
      `bone-eyelid-${side}-upper`,
      pivotOf(`bone-eyelid-${side}-upper`),
      [sign * 1.45, 26.05, -11.97],
      [2, 0.5, 0.5],
      T.coat
    ),
    demoCube(
      `cube-eyelid-${side}-lower`,
      `bone-eyelid-${side}-lower`,
      pivotOf(`bone-eyelid-${side}-lower`),
      [sign * 1.45, 24.96, -11.97],
      [2, 0.5, 0.5],
      T.coat
    )
  );
}

for (const [id, x, z] of legData) {
  const upper = `bone-leg-${id}-upper`;
  const lower = `bone-leg-${id}-lower`;
  const hoof = `bone-leg-${id}-hoof`;
  cubes.push(
    demoCube(`cube-leg-${id}-upper`, upper, pivotOf(upper), [x, 11.2, z], [3.5, 7, 3.8], T.coat),
    demoCube(`cube-leg-${id}-moon-band`, upper, pivotOf(upper), [x, 8.4, z], [4.5, 1, 4.8], T.gold),
    demoCube(`cube-leg-${id}-lower`, lower, pivotOf(lower), [x, 6.2, z - 0.2], [2.6, 5.5, 2.8], T.moonlight),
    demoCube(`cube-leg-${id}-hoof`, hoof, pivotOf(hoof), [x, 2.5, z - 1], [3.2, 2.5, 4.4], T.hoof),
    demoCube(`cube-leg-${id}-hoof-rune`, hoof, pivotOf(hoof), [x, 2.8, z - 3.28], [1.2, 0.85, 0.25], T.aura)
  );
}

for (let index = 0; index < 16; index += 1) {
  const id = `bone-tail-${index + 1}`;
  const pivot = pivotOf(id);
  const size = Math.max(1.25, 3.8 - index * 0.14);
  cubes.push(
    demoCube(
      `cube-tail-${index + 1}`,
      id,
      pivot,
      [pivot[0], pivot[1], pivot[2] + 0.75],
      [size, size, 2.2],
      index > 11 ? T.moonlight : T.coat
    )
  );
}

for (let index = 0; index < 24; index += 1) {
  const id = `bone-mane-${index + 1}`;
  const pivot = pivotOf(id);
  const column = index % 3;
  cubes.push(
    demoCube(
      `cube-mane-${index + 1}`,
      id,
      pivot,
      [pivot[0], pivot[1] + 0.2, pivot[2] + 1],
      [1.15 + column * 0.12, 2.6, 3.6],
      index % 4 === 0 ? T.gold : T.moonlight,
      {
        rotation: [18 + (index % 3) * 7, 0, (column - 1) * 12]
      }
    )
  );
}

for (const side of ['left', 'right'] as const) {
  const sign = side === 'left' ? -1 : 1;
  for (let segment = 0; segment < 10; segment += 1) {
    const id = `bone-antler-${side}-main-${segment + 1}`;
    const pivot = pivotOf(id);
    cubes.push(
      demoCube(
        `cube-antler-${side}-main-${segment + 1}`,
        id,
        pivot,
        [pivot[0] + sign * 0.2, pivot[1] + 0.65, pivot[2]],
        [Math.max(0.65, 1.4 - segment * 0.07), 1.8, Math.max(0.65, 1.4 - segment * 0.07)],
        segment % 3 === 0 ? T.gold : T.moonlight,
        { rotation: [0, 0, sign * -18] }
      )
    );
  }
  for (let branch = 0; branch < 3; branch += 1) {
    for (let segment = 0; segment < 4; segment += 1) {
      const id = `bone-antler-${side}-branch-${branch + 1}-${segment + 1}`;
      const pivot = pivotOf(id);
      cubes.push(
        demoCube(
          `cube-antler-${side}-branch-${branch + 1}-${segment + 1}`,
          id,
          pivot,
          [pivot[0] + sign * 0.25, pivot[1] + 0.45, pivot[2] - 0.2],
          [0.72, 1.35, 0.72],
          segment === 3 ? T.aura : T.gold,
          {
            rotation: [-22, 0, sign * -28]
          }
        )
      );
    }
  }
}

const idleChannels = [
  demoChannel('kirin-idle-body', 'bone-body', 'rotation', [
    [0, [0, 0, 0]],
    [1.8, [1.4, 0, 0]],
    [3.6, [0, 0, 0]]
  ]),
  demoChannel('kirin-idle-chest', 'bone-chest', 'scale', [
    [0, [1, 1, 1]],
    [1.8, [1.025, 1.04, 1.025]],
    [3.6, [1, 1, 1]]
  ]),
  demoChannel('kirin-idle-head', 'bone-head', 'rotation', [
    [0, [0, -3, 0]],
    [1.8, [2, 4, 0]],
    [3.6, [0, -3, 0]]
  ]),
  demoChannel('kirin-idle-ear-left', 'bone-ear-left', 'rotation', [
    [0, [0, 0, -4]],
    [1.4, [0, 0, 10]],
    [3.6, [0, 0, -4]]
  ]),
  demoChannel('kirin-idle-ear-right', 'bone-ear-right', 'rotation', [
    [0, [0, 0, 4]],
    [1.7, [0, 0, -12]],
    [3.6, [0, 0, 4]]
  ])
];

for (let index = 0; index < 16; index += 2) {
  idleChannels.push(
    demoChannel(
      `kirin-idle-tail-${index + 1}`,
      `bone-tail-${index + 1}`,
      'rotation',
      [
        [0, [0, -8 + index, 0]],
        [1.8, [0, 10 - index * 0.4, 4]],
        [3.6, [0, -8 + index, 0]]
      ]
    )
  );
}

for (let index = 0; index < 24; index += 3) {
  idleChannels.push(
    demoChannel(
      `kirin-idle-mane-${index + 1}`,
      `bone-mane-${index + 1}`,
      'rotation',
      [
        [0, [0, 0, -5]],
        [1.8, [7, 0, 6]],
        [3.6, [0, 0, -5]]
      ]
    )
  );
}

for (const side of ['left', 'right'] as const) {
  const direction = side === 'left' ? -1 : 1;
  idleChannels.push(
    demoChannel(`kirin-blink-${side}-upper`, `bone-eyelid-${side}-upper`, 'position', [
      [0, [0, 0, 0]],
      [1.5, [0, 0, 0]],
      [1.62, [0, -0.62, 0]],
      [1.76, [0, 0, 0]],
      [3.6, [0, 0, 0]]
    ]),
    demoChannel(`kirin-blink-${side}-lower`, `bone-eyelid-${side}-lower`, 'position', [
      [0, [0, 0, 0]],
      [1.5, [0, 0, 0]],
      [1.62, [0, 0.52, 0]],
      [1.76, [0, 0, 0]],
      [3.6, [0, 0, 0]]
    ]),
    demoChannel(`kirin-antler-glide-${side}`, `bone-antler-${side}-main-1`, 'rotation', [
      [0, [0, 0, direction * 2]],
      [1.8, [0, direction * 2, direction * -2]],
      [3.6, [0, 0, direction * 2]]
    ])
  );
}

const awakenChannels = [
  demoChannel('kirin-awaken-root', 'bone-root', 'position', [
    [0, [0, 0, 0]],
    [1.2, [0, 1.4, 0]],
    [2.4, [0, 0, 0]]
  ]),
  demoChannel('kirin-awaken-head', 'bone-head', 'rotation', [
    [0, [18, 0, 0]],
    [0.8, [-12, 0, 0]],
    [2.4, [0, 0, 0]]
  ]),
  demoChannel('kirin-awaken-jaw', 'bone-jaw', 'rotation', [
    [0, [0, 0, 0]],
    [0.8, [24, 0, 0]],
    [1.45, [24, 0, 0]],
    [2.4, [0, 0, 0]]
  ])
];

const triggers: AnimationTriggerInput[] = [
  {
    id: 'kirin-awaken-sound',
    type: 'sound',
    keys: [{
      id: 'kirin-awaken-sound-key',
      timeSeconds: 0.72,
      value: {
        effect: 'ashfox:moonveil_chime',
        bindToActor: true
      }
    }]
  },
  {
    id: 'kirin-awaken-timeline',
    type: 'timeline',
    keys: [{
      id: 'kirin-awaken-timeline-key',
      timeSeconds: 0.8,
      value: 'MOONVEIL AWAKENS'
    }]
  }
];

export const MOONVEIL_KIRIN_DEMO: DemoDefinition = {
  id: 'project-showcase-celestial-kirin',
  slug: 'moonveil-kirin',
  name: 'Moonveil · Celestial Kirin',
  modelPath: 'moonveil_celestial_kirin',
  initialSelectionId: null,
  intent: {
    subject: 'celestial fantasy kirin',
    grounding: 'free',
    features: [
      'recognizable quadruped body plan',
      'branching celestial antlers',
      'precise surface-bound eyes'
    ]
  },
  textures: [
    {
      id: T.coat,
      name: 'Moonlit indigo coat',
      background: '#284886'
    },
    {
      id: T.moonlight,
      name: 'Moonlight pearl',
      background: '#e9f2ff'
    },
    {
      id: T.gold,
      name: 'Celestial gold',
      background: '#e2a642'
    },
    {
      id: T.hoof,
      name: 'Obsidian',
      background: '#222a43'
    },
    {
      id: T.eye,
      name: 'Living eyes',
      background: '#123c59'
    },
    {
      id: T.aura,
      name: 'Astral accent',
      background: '#3a1769'
    }
  ],
  bones,
  cubes,
  animations: [
    {
      id: 'idle',
      name: 'Moonveil Idle',
      durationSeconds: 3.6,
      fps: 20,
      loop: 'loop',
      channels: idleChannels
    },
    {
      id: 'animation-moonveil-awaken',
      name: 'Astral Awakening',
      durationSeconds: 2.4,
      fps: 20,
      loop: 'hold_on_last_frame',
      channels: awakenChannels,
      triggers
    }
  ]
};
