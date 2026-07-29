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
  iron: 'texture-ironroot-iron',
  green: 'texture-ironroot-green',
  brass: 'texture-ironroot-brass',
  rubber: 'texture-ironroot-rubber',
  glass: 'texture-ironroot-glass',
  lamp: 'texture-ironroot-lamp'
} as const;

const pivots: Record<string, Vec3> = {
  root: [0, 0, 0],
  chassis: [0, 7, 0],
  engine: [0, 8, -4.5],
  cab: [0, 11, 3],
  hood: [0, 11, -5.5],
  steering: [0, 10.5, 1],
  exhaust: [-2.4, 10, -5],
  hitch: [0, 5.5, 8.5],
  'front-axle': [0, 4, -5.5],
  'rear-axle': [0, 4.5, 4.8],
  'wheel-front-left': [-5, 4, -5.5],
  'wheel-front-right': [5, 4, -5.5],
  'wheel-rear-left': [-5.2, 4.5, 4.8],
  'wheel-rear-right': [5.2, 4.5, 4.8],
  'piston-left': [-2.8, 8.3, -4.5],
  'piston-right': [2.8, 8.3, -4.5],
  'lamp-left': [-2.7, 9.5, -8.4],
  'lamp-right': [2.7, 9.5, -8.4]
};

const bone = (
  id: keyof typeof pivots,
  parentId: string | null
): BoneCreateInput =>
  demoBone(`bone-${id}`, parentId, pivots[id], String(id));

const bones: BoneCreateInput[] = [
  bone('root', null),
  bone('chassis', 'bone-root'),
  bone('engine', 'bone-chassis'),
  bone('cab', 'bone-chassis'),
  bone('hood', 'bone-engine'),
  bone('steering', 'bone-cab'),
  bone('exhaust', 'bone-engine'),
  bone('hitch', 'bone-chassis'),
  bone('front-axle', 'bone-chassis'),
  bone('rear-axle', 'bone-chassis'),
  bone('wheel-front-left', 'bone-front-axle'),
  bone('wheel-front-right', 'bone-front-axle'),
  bone('wheel-rear-left', 'bone-rear-axle'),
  bone('wheel-rear-right', 'bone-rear-axle'),
  bone('piston-left', 'bone-engine'),
  bone('piston-right', 'bone-engine'),
  bone('lamp-left', 'bone-hood'),
  bone('lamp-right', 'bone-hood')
];

const p = (id: keyof typeof pivots): Vec3 => pivots[id];

const cubes: DemoCubeSpec[] = [
  demoCube('cube-chassis-spine', 'bone-chassis', p('chassis'), [0, 6.8, 0], [9, 2, 15], T.iron),
  demoCube('cube-chassis-green', 'bone-chassis', p('chassis'), [0, 8, -0.4], [8.2, 2.2, 13], T.green),
  demoCube('cube-front-bumper', 'bone-chassis', p('chassis'), [0, 5.4, -9], [10, 1.2, 1.4], T.iron),
  demoCube('cube-rear-bumper', 'bone-chassis', p('chassis'), [0, 5.5, 8.7], [9.5, 1.1, 1.4], T.iron),
  demoCube('cube-engine-block', 'bone-engine', p('engine'), [0, 8.5, -4.8], [7.2, 4.8, 6.5], T.green),
  demoCube('cube-engine-cap', 'bone-hood', p('hood'), [0, 11.2, -5.2], [7.5, 1.1, 6.8], T.brass, { rotation: [0, 0, 0] }),
  demoCube('cube-engine-grille', 'bone-engine', p('engine'), [0, 8.8, -8.25], [6.2, 3.2, 0.7], T.iron),
  demoCube('cube-engine-radiator', 'bone-engine', p('engine'), [0, 8.7, -8.7], [4.6, 2.4, 0.5], T.brass),
  demoCube('cube-cab-floor', 'bone-cab', p('cab'), [0, 9.1, 3.4], [7.2, 1, 6.8], T.iron),
  demoCube('cube-cab-roof', 'bone-cab', p('cab'), [0, 15.2, 3.5], [8.2, 1, 7.2], T.green),
  demoCube('cube-cab-back', 'bone-cab', p('cab'), [0, 12, 6.5], [7.4, 5.6, 0.8], T.green),
  demoCube('cube-cab-left-post', 'bone-cab', p('cab'), [-3.4, 12.2, 1], [0.8, 5.7, 1], T.brass),
  demoCube('cube-cab-right-post', 'bone-cab', p('cab'), [3.4, 12.2, 1], [0.8, 5.7, 1], T.brass),
  demoCube('cube-cab-window-front', 'bone-cab', p('cab'), [0, 12.5, 0.55], [5.8, 3.7, 0.35], T.glass, { shade: false }),
  demoCube('cube-cab-window-back', 'bone-cab', p('cab'), [0, 12.5, 6.05], [5.8, 3.6, 0.35], T.glass, { shade: false }),
  demoCube('cube-seat-base', 'bone-cab', p('cab'), [0, 10.2, 4.4], [3.6, 1.1, 2.8], T.rubber),
  demoCube('cube-seat-back', 'bone-cab', p('cab'), [0, 12, 5.2], [3.6, 3.8, 0.8], T.rubber, { rotation: [-8, 0, 0] }),
  demoCube('cube-steering-column', 'bone-steering', p('steering'), [0, 11, 1.2], [0.7, 2.5, 0.7], T.iron, { rotation: [-24, 0, 0] }),
  demoCube('cube-steering-wheel', 'bone-steering', p('steering'), [0, 12, 0.55], [3.4, 0.5, 3.4], T.rubber, { rotation: [-24, 0, 0] }),
  demoCube('cube-hitch-bar', 'bone-hitch', p('hitch'), [0, 5.2, 10.1], [1.4, 1.3, 4], T.iron),
  demoCube('cube-hitch-pin', 'bone-hitch', p('hitch'), [0, 5.2, 12], [1, 2.8, 1], T.brass),
  demoCube('cube-exhaust-stack', 'bone-exhaust', p('exhaust'), [-2.4, 13.3, -5], [1.1, 7.2, 1.1], T.iron),
  demoCube('cube-exhaust-cap', 'bone-exhaust', p('exhaust'), [-2.4, 17, -5], [1.8, 0.5, 1.8], T.brass, { rotation: [0, 0, -8] }),
  demoCube('cube-piston-left', 'bone-piston-left', p('piston-left'), [-3.1, 8.3, -4.7], [1, 2.8, 3.8], T.brass),
  demoCube('cube-piston-right', 'bone-piston-right', p('piston-right'), [3.1, 8.3, -4.7], [1, 2.8, 3.8], T.brass),
  demoCube('cube-lamp-left', 'bone-lamp-left', p('lamp-left'), [-2.7, 9.5, -8.8], [2, 2, 0.7], T.lamp, { shade: false, lightEmission: 12 }),
  demoCube('cube-lamp-right', 'bone-lamp-right', p('lamp-right'), [2.7, 9.5, -8.8], [2, 2, 0.7], T.lamp, { shade: false, lightEmission: 12 })
];

const wheel = (
  id: 'front-left' | 'front-right' | 'rear-left' | 'rear-right',
  radius: number
): DemoCubeSpec[] => {
  const pivotId = `wheel-${id}` as keyof typeof pivots;
  const pivot = p(pivotId);
  const parentId = `bone-wheel-${id}`;
  return [
    ...Array.from({ length: 12 }, (_, index) => {
      const angle = index * 30;
      const boneId = `bone-wheel-${id}-tread-${index + 1}`;
      bones.push(
        demoBone(
          boneId,
          parentId,
          pivot,
          `wheel_${id}_tread_${index + 1}`
        )
      );
      return demoCube(
        `cube-wheel-${id}-tread-${index + 1}`,
        boneId,
        pivot,
        [pivot[0], pivot[1], pivot[2] + radius],
        [2.2, 1.3, 2.1],
        T.rubber,
        { rotation: [angle, 0, 0] }
      );
    }),
    demoCube(
      `cube-wheel-${id}-hub`,
      parentId,
      pivot,
      pivot,
      [2.7, 2.7, 2.7],
      T.brass
    ),
    demoCube(
      `cube-wheel-${id}-axle-cap`,
      parentId,
      pivot,
      [
        pivot[0] + (id.endsWith('left') ? -1.5 : 1.5),
        pivot[1],
        pivot[2]
      ],
      [1.1, 1.7, 1.7],
      T.iron
    )
  ];
};

cubes.push(
  ...wheel('front-left', 2.7),
  ...wheel('front-right', 2.7),
  ...wheel('rear-left', 3.5),
  ...wheel('rear-right', 3.5)
);

for (let index = 0; index < 24; index += 1) {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  const boneId = `bone-engine-bolt-${index + 1}`;
  const pivot: Vec3 = [
    side * 3.75,
    7.1 + (row % 4) * 1.15,
    -7 + Math.floor(row / 4) * 1.7
  ];
  bones.push(
    demoBone(
      boneId,
      'bone-engine',
      pivot,
      `engine_bolt_${index + 1}`
    )
  );
  cubes.push(
    demoCube(
      `cube-engine-bolt-${index + 1}`,
      boneId,
      pivot,
      pivot,
      [0.5, 0.5, 0.5],
      T.brass
    )
  );
}

for (let index = 0; index < 18; index += 1) {
  const column = index % 6;
  const row = Math.floor(index / 6);
  const boneId = `bone-grille-slat-${index + 1}`;
  const pivot: Vec3 = [
    -2.5 + column,
    7.8 + row,
    -8.65
  ];
  bones.push(
    demoBone(
      boneId,
      'bone-engine',
      pivot,
      `grille_slat_${index + 1}`
    )
  );
  cubes.push(
    demoCube(
      `cube-grille-slat-${index + 1}`,
      boneId,
      pivot,
      pivot,
      [0.5, 0.65, 0.5],
      row === 1 ? T.brass : T.iron
    )
  );
}

const wheelChannels = [
  'front-left',
  'front-right',
  'rear-left',
  'rear-right'
].map((id) =>
  demoChannel(
    `tractor-work-wheel-${id}`,
    `bone-wheel-${id}`,
    'rotation',
    [[0, [0, 0, 0]], [3, [360, 0, 0]]]
  )
);

const triggers: AnimationTriggerInput[] = [
  {
    id: 'tractor-work-sound',
    type: 'sound',
    keys: [{
      id: 'tractor-work-sound-key',
      timeSeconds: 0,
      value: {
        effect: 'ashfox:ironroot_engine',
        bindToActor: true
      }
    }]
  },
  {
    id: 'tractor-work-timeline',
    type: 'timeline',
    keys: [
      {
        id: 'tractor-work-start',
        timeSeconds: 0,
        value: 'ENGINE ONLINE'
      },
      {
        id: 'tractor-work-drive',
        timeSeconds: 0.6,
        value: 'FIELD DRIVE'
      }
    ]
  }
];

export const IRONROOT_TRACTOR_DEMO: DemoDefinition = {
  id: 'project-demo-ironroot-tractor',
  slug: 'ironroot-tractor',
  name: 'Ironroot · Arcane Field Tractor',
  modelPath: 'ironroot_arcane_tractor',
  initialSelectionId: null,
  atlasSeed: 0x1a0b7c,
  textures: [
    {
      id: T.iron,
      name: 'Forged iron',
      previewColor: '#3b4448',
      background: '#2c3336',
      atlasMode: 'generate',
      rectangles: [{ x: 24, y: 24, width: 80, height: 80, color: '#4b565a' }]
    },
    {
      id: T.green,
      name: 'Ironroot enamel',
      previewColor: '#3e6b43',
      background: '#27472d',
      atlasMode: 'generate',
      rectangles: [{ x: 18, y: 18, width: 92, height: 92, color: '#4f7d50' }]
    },
    {
      id: T.brass,
      name: 'Warm brass',
      previewColor: '#c38b3b',
      background: '#8f5d24',
      atlasMode: 'generate',
      rectangles: [{ x: 20, y: 20, width: 88, height: 88, color: '#d4a14a' }]
    },
    {
      id: T.rubber,
      name: 'Deep tread',
      previewColor: '#171a1c',
      background: '#111315',
      atlasMode: 'generate',
      rectangles: [{ x: 20, y: 20, width: 88, height: 88, color: '#242a2d' }]
    },
    {
      id: T.glass,
      name: 'Cab glass',
      previewColor: '#5d9ca6',
      background: '#315b65',
      atlasMode: 'preserve',
      renderMode: 'layered',
      rectangles: [
        { x: 8, y: 8, width: 112, height: 112, color: '#75b7c0' },
        { x: 18, y: 18, width: 35, height: 12, color: '#c0edf0' }
      ]
    },
    {
      id: T.lamp,
      name: 'Sunlamp',
      previewColor: '#fff0a2',
      background: '#8b4d16',
      atlasMode: 'preserve',
      renderMode: 'emissive',
      rectangles: [
        { x: 8, y: 8, width: 112, height: 112, color: '#ffd65a' },
        { x: 28, y: 28, width: 72, height: 72, color: '#fff4bb' },
        { x: 48, y: 38, width: 22, height: 22, color: '#ffffff' }
      ]
    }
  ],
  bones,
  cubes,
  animations: [
    {
      id: 'animation-ironroot-work-cycle',
      name: 'animation.ashfox.ironroot_tractor.work_cycle',
      durationSeconds: 3,
      fps: 24,
      loop: 'loop',
      channels: [
        ...wheelChannels,
        demoChannel('tractor-work-piston-left', 'bone-piston-left', 'position', [
          [0, [0, 0, 0]],
          [0.75, [0, 0.55, 0]],
          [1.5, [0, 0, 0]],
          [2.25, [0, -0.55, 0]],
          [3, [0, 0, 0]]
        ]),
        demoChannel('tractor-work-piston-right', 'bone-piston-right', 'position', [
          [0, [0, 0, 0]],
          [0.75, [0, -0.55, 0]],
          [1.5, [0, 0, 0]],
          [2.25, [0, 0.55, 0]],
          [3, [0, 0, 0]]
        ]),
        demoChannel('tractor-work-exhaust', 'bone-exhaust', 'rotation', [
          [0, [0, 0, -2]],
          [0.4, [0, 0, 3]],
          [0.8, [0, 0, -2]],
          [3, [0, 0, -2]]
        ]),
        demoChannel('tractor-work-steering', 'bone-steering', 'rotation', [
          [0, [0, -8, 0]],
          [1.5, [0, 8, 0]],
          [3, [0, -8, 0]]
        ])
      ],
      triggers
    }
  ]
};
