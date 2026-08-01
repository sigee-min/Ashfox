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

const T = {
  hull: 'texture-aether-hull',
  carbon: 'texture-aether-carbon',
  gold: 'texture-aether-gold',
  window: 'texture-aether-window',
  engine: 'texture-aether-engine',
  rune: 'texture-aether-rune'
} as const;

const pivots: Record<string, Vec3> = {
  root: [0, 0, 0],
  hull: [0, 18, 0],
  'lower-stage': [0, 7, 0],
  'upper-stage': [0, 25, 0],
  nose: [0, 34, 0],
  core: [0, 18, 0],
  gimbal: [0, 3.5, 0],
  'fin-north': [0, 7, -5],
  'fin-south': [0, 7, 5],
  'fin-west': [-5, 7, 0],
  'fin-east': [5, 7, 0],
  'engine-north': [0, 2, -2.2],
  'engine-south': [0, 2, 2.2],
  'engine-west': [-2.2, 2, 0],
  'engine-east': [2.2, 2, 0]
};

const bones: BoneCreateInput[] = [
  demoBone('bone-root', null, pivots.root, 'root'),
  demoBone('bone-hull', 'bone-root', pivots.hull, 'hull'),
  demoBone('bone-lower-stage', 'bone-hull', pivots['lower-stage'], 'lower_stage'),
  demoBone('bone-upper-stage', 'bone-hull', pivots['upper-stage'], 'upper_stage'),
  demoBone('bone-nose', 'bone-upper-stage', pivots.nose, 'nose'),
  demoBone('bone-core', 'bone-hull', pivots.core, 'aether_core'),
  demoBone('bone-gimbal', 'bone-lower-stage', pivots.gimbal, 'engine_gimbal'),
  ...['north', 'south', 'west', 'east'].map((side) =>
    demoBone(
      `bone-fin-${side}`,
      'bone-lower-stage',
      pivots[`fin-${side}`],
      `fin_${side}`
    )
  ),
  ...['north', 'south', 'west', 'east'].map((side) =>
    demoBone(
      `bone-engine-${side}`,
      'bone-gimbal',
      pivots[`engine-${side}`],
      `engine_${side}`
    )
  )
];

for (let index = 0; index < 12; index += 1) {
  const angle = index * 30;
  const radians = angle * Math.PI / 180;
  const pivot: Vec3 = [
    Math.sin(radians) * 5,
    20,
    -Math.cos(radians) * 5
  ];
  bones.push(
    demoBone(
      `bone-panel-${index + 1}`,
      'bone-hull',
      pivot,
      `service_panel_${index + 1}`
    )
  );
}

for (let index = 0; index < 8; index += 1) {
  const angle = index * 45;
  const radians = angle * Math.PI / 180;
  bones.push(
    demoBone(
      `bone-radiator-${index + 1}`,
      'bone-upper-stage',
      [
        Math.sin(radians) * 4.8,
        27,
        -Math.cos(radians) * 4.8
      ],
      `radiator_${index + 1}`
    )
  );
}

const cubes: DemoCubeSpec[] = [];

const hullRing = (
  ring: number,
  y: number,
  radius: number,
  height: number,
  textureId: string,
  parentId = 'bone-hull',
  pivot: Vec3 = pivots.hull
): void => {
  for (let segment = 0; segment < 8; segment += 1) {
    const angle = segment * 45;
    const boneId = `bone-hull-ring-${ring}-segment-${segment + 1}`;
    bones.push(
      demoBone(
        boneId,
        parentId,
        pivot,
        `hull_ring_${ring}_segment_${segment + 1}`
      )
    );
    cubes.push(
      demoCube(
        `cube-hull-ring-${ring}-segment-${segment + 1}`,
        boneId,
        pivot,
        [0, y, -radius],
        [3.5, height, 1.5],
        textureId,
        { rotation: [0, angle, 0] }
      )
    );
  }
};

[
  [1, 5, 5.3, 3.2, T.carbon],
  [2, 8, 5.4, 3.2, T.hull],
  [3, 11, 5.4, 3.2, T.hull],
  [4, 14, 5.5, 3.2, T.gold],
  [5, 17, 5.5, 3.2, T.hull],
  [6, 20, 5.5, 3.2, T.hull],
  [7, 23, 5.3, 3.2, T.gold],
  [8, 26, 5.1, 3.2, T.hull],
  [9, 29, 4.5, 3.2, T.hull],
  [10, 32, 3.5, 3.2, T.gold],
  [11, 34.5, 2.3, 2.6, T.hull],
  [12, 36.4, 1.2, 2, T.gold]
].forEach(([ring, y, radius, height, texture]) =>
  hullRing(
    ring as number,
    y as number,
    radius as number,
    height as number,
    texture as string
  )
);

cubes.push(
  demoCube('cube-core-window-north', 'bone-core', pivots.core, [0, 18, -5.9], [4, 5.2, 0.6], T.window),
  demoCube('cube-core-window-south', 'bone-core', pivots.core, [0, 18, 5.9], [4, 5.2, 0.6], T.window),
  demoCube('cube-core-window-west', 'bone-core', pivots.core, [-5.9, 18, 0], [0.6, 5.2, 4], T.window),
  demoCube('cube-core-window-east', 'bone-core', pivots.core, [5.9, 18, 0], [0.6, 5.2, 4], T.window),
  demoCube('cube-core-crystal', 'bone-core', pivots.core, [0, 18, 0], [3.2, 7.5, 3.2], T.rune, { rotation: [0, 45, 0] }),
  demoCube('cube-nose-spire', 'bone-nose', pivots.nose, [0, 39, 0], [1.2, 5.2, 1.2], T.rune, { rotation: [0, 45, 0] })
);

const finData = [
  ['north', [0, 7, -7.2] as Vec3, [5.4, 6.5, 1.2] as Vec3],
  ['south', [0, 7, 7.2] as Vec3, [5.4, 6.5, 1.2] as Vec3],
  ['west', [-7.2, 7, 0] as Vec3, [1.2, 6.5, 5.4] as Vec3],
  ['east', [7.2, 7, 0] as Vec3, [1.2, 6.5, 5.4] as Vec3]
] as const;

for (const [side, center, size] of finData) {
  cubes.push(
    demoCube(
      `cube-fin-${side}-main`,
      `bone-fin-${side}`,
      pivots[`fin-${side}`],
      center,
      size,
      T.carbon
    ),
    demoCube(
      `cube-fin-${side}-edge`,
      `bone-fin-${side}`,
      pivots[`fin-${side}`],
      [center[0], center[1] - 2.4, center[2]],
      [size[0] * 1.2, 1, size[2] * 1.2],
      T.gold
    )
  );
}

for (const side of ['north', 'south', 'west', 'east'] as const) {
  const pivot = pivots[`engine-${side}`];
  cubes.push(
    demoCube(
      `cube-engine-${side}-bell`,
      `bone-engine-${side}`,
      pivot,
      [pivot[0], 1.2, pivot[2]],
      [2.8, 3.2, 2.8],
      T.carbon
    ),
    demoCube(
      `cube-engine-${side}-throat`,
      `bone-engine-${side}`,
      pivot,
      [pivot[0], 3, pivot[2]],
      [1.8, 1.5, 1.8],
      T.gold
    ),
    demoCube(
      `cube-engine-${side}-plume`,
      `bone-engine-${side}`,
      pivot,
      [pivot[0], -1, pivot[2]],
      [1.8, 2.8, 1.8],
      T.engine
    )
  );
}

for (let index = 0; index < 12; index += 1) {
  const angle = index * 30;
  cubes.push(
    demoCube(
      `cube-service-panel-${index + 1}`,
      `bone-panel-${index + 1}`,
      [
        Math.sin(angle * Math.PI / 180) * 5,
        20,
        -Math.cos(angle * Math.PI / 180) * 5
      ],
      [0, 20, -5.85],
      [2.2, 4.8, 0.5],
      index % 3 === 0 ? T.rune : T.carbon,
      {
        rotation: [0, angle, 0]
      }
    )
  );
}

for (let index = 0; index < 8; index += 1) {
  const angle = index * 45;
  cubes.push(
    demoCube(
      `cube-radiator-${index + 1}`,
      `bone-radiator-${index + 1}`,
      [
        Math.sin(angle * Math.PI / 180) * 4.8,
        27,
        -Math.cos(angle * Math.PI / 180) * 4.8
      ],
      [0, 27, -6.1],
      [2.6, 5.5, 0.5],
      T.carbon,
      { rotation: [0, angle, 0] }
    )
  );
}

for (let index = 0; index < 24; index += 1) {
  const angle = (index % 8) * 45;
  const y = 8 + Math.floor(index / 8) * 7;
  cubes.push(
    demoCube(
      `cube-hull-rivet-${index + 1}`,
      'bone-hull',
      pivots.hull,
      [0, y, -6.1],
      [0.5, 0.5, 0.5],
      T.gold,
      { rotation: [0, angle, 0] }
    )
  );
}

const finChannels = ['north', 'south', 'west', 'east'].map((side, index) =>
  demoChannel(
    `rocket-launch-fin-${side}`,
    `bone-fin-${side}`,
    'rotation',
    [
      [0, [0, 0, 0]],
      [1.2, [
        side === 'north' ? -18 : side === 'south' ? 18 : 0,
        0,
        side === 'west' ? 18 : side === 'east' ? -18 : 0
      ]],
      [4, [0, 0, 0]]
    ]
  )
);

const panelChannels = Array.from({ length: 12 }, (_, index) =>
  demoChannel(
    `rocket-launch-panel-${index + 1}`,
    `bone-panel-${index + 1}`,
    'rotation',
    [
      [0, [0, 0, 0]],
      [1.5, [index % 2 === 0 ? -20 : 20, 0, 0]],
      [3, [0, 0, 0]],
      [4, [0, 0, 0]]
    ]
  )
);

const launchTriggers: AnimationTriggerInput[] = [
  {
    id: 'rocket-launch-sound',
    type: 'sound',
    keys: [
      {
        id: 'rocket-core-charge',
        timeSeconds: 0.5,
        value: { effect: 'ashfox:aether_charge', bindToActor: true }
      },
      {
        id: 'rocket-engine-ignite',
        timeSeconds: 1.5,
        value: { effect: 'ashfox:aether_ignite', bindToActor: true }
      }
    ]
  },
  {
    id: 'rocket-launch-particles',
    type: 'particle',
    keys: [{
      id: 'rocket-plume',
      timeSeconds: 1.5,
      value: { effect: 'ashfox:aether_plume', bindToActor: true }
    }]
  },
  {
    id: 'rocket-launch-timeline',
    type: 'timeline',
    keys: [
      { id: 'rocket-check', timeSeconds: 0, value: 'FLIGHT CHECK' },
      { id: 'rocket-core', timeSeconds: 0.5, value: 'AETHER CORE' },
      { id: 'rocket-liftoff', timeSeconds: 1.5, value: 'LIFTOFF' }
    ]
  }
];

export const AETHER_SPEAR_ROCKET_DEMO: DemoDefinition = {
  id: 'project-demo-aether-spear',
  slug: 'aether-spear-rocket',
  name: 'Aether Spear · Runic Exploration Rocket',
  modelPath: 'aether_spear_rocket',
  initialSelectionId: null,
  visibleEyeCount: 0,
  intent: {
    subject: 'runic exploration rocket',
    grounding: 'free',
    features: [
      'tall launch-ready silhouette',
      'readable engine cluster',
      'articulated fins and solar panels'
    ]
  },
  textures: [
    {
      id: T.hull,
      name: 'Ceramic hull',
      background: '#e6e1d5'
    },
    {
      id: T.carbon,
      name: 'Carbon structure',
      background: '#25313e'
    },
    {
      id: T.gold,
      name: 'Runic gold',
      background: '#edbd5c'
    },
    {
      id: T.window,
      name: 'Aether window',
      background: '#123b52'
    },
    {
      id: T.engine,
      name: 'Engine plasma',
      background: '#0a3251'
    },
    {
      id: T.rune,
      name: 'Aether rune',
      background: '#38134f'
    }
  ],
  bones,
  cubes,
  animations: [
    {
      id: 'animation-aether-spear-launch',
      name: 'animation.ashfox.aether_spear.launch',
      durationSeconds: 4,
      fps: 24,
      loop: 'hold_on_last_frame',
      channels: [
        demoChannel('rocket-launch-root', 'bone-root', 'position', [
          [0, [0, 0, 0]],
          [1.5, [0, 0, 0]],
          [2.4, [0, 4, 0]],
          [4, [0, 12, 0]]
        ]),
        demoChannel('rocket-launch-core', 'bone-core', 'scale', [
          [0, [0.85, 0.85, 0.85]],
          [1, [1.15, 1.15, 1.15]],
          [1.5, [1.4, 1.4, 1.4]],
          [4, [1.1, 1.1, 1.1]]
        ]),
        demoChannel('rocket-launch-gimbal', 'bone-gimbal', 'rotation', [
          [0, [0, 0, 0]],
          [2, [3, 0, -3]],
          [3, [-3, 0, 3]],
          [4, [0, 0, 0]]
        ]),
        ...finChannels,
        ...panelChannels
      ],
      triggers: launchTriggers
    },
    {
      id: 'idle',
      name: 'Aether Spear Idle',
      durationSeconds: 2,
      fps: 20,
      loop: 'loop',
      channels: [
        demoChannel(
          'rocket-idle-core',
          'bone-core',
          'scale',
          [
            [0, [1, 1, 1]],
            [1, [1.04, 1.04, 1.04]],
            [2, [1, 1, 1]]
          ]
        )
      ]
    }
  ]
};
