export const landingContent = {
  eyebrow: 'Free · open source · local',
  title: 'Type it. Watch it become game-ready.',
  summary:
    'Your AI IDE authors through Ashfox’s deterministic 3D tools while geometry, texture, UV, and animation changes appear live.',
  proof: [
    'MIT licensed',
    'Free to use',
    'No account',
    'No server'
  ],
  demo: {
    label: 'AI IDE-native workflow',
    prompts: [
      'Build a golden fox with a soft idle animation.',
      'Make the tail fuller and keep the Minecraft pixel density.',
      'Validate it for GeckoLib 5 and export one portable file.'
    ],
    phases: [
      ['Ready', 'Empty local scene', 'Batch received'],
      ['Rig', '12 animation bones created', 'Rig committed'],
      ['Geometry', '50 voxel cubes committed', 'Geometry committed'],
      ['Details', 'Face, ruff, paws, and tail refined', 'Details committed'],
      ['Texture + UV', '512 × 512 deterministic atlas', 'UV atlas committed'],
      ['Export-ready', '3 animation clips validated', 'Batch complete']
    ],
    phaseDelays: [0, 900, 1800, 3000, 4200, 5700],
    duration: 7900
  },
  workflow: [
    {
      step: '01',
      title: 'Ask',
      body:
        'Describe the asset in your AI IDE with normal language. Start from an idea, a reference, or an existing project.'
    },
    {
      step: '02',
      title: 'Watch',
      body:
        'Geometry, UVs, texture, and animation update in the live viewport while receipts record every change.'
    },
    {
      step: '03',
      title: 'Ship',
      body:
        'Undo anything you dislike, then export a validated game-ready asset without leaving the browser.'
    }
  ],
  principles: [
    {
      label: 'Local by design',
      title: 'Your project stays in the browser.',
      body:
        'No database, daemon, account, or background service is required. Open, edit, validate, and save locally.'
    },
    {
      label: 'Agent-native',
      title: 'One command path. Fully inspectable.',
      body:
        'The interface and any connected AI IDE use the same validated reducer. Every committed change has a revision and receipt.'
    },
    {
      label: 'Target-correct',
      title: 'Outputs are part of the model.',
      body:
        'Format constraints are explicit before export, so target validation is deterministic instead of improvised.'
    }
  ],
  openSource: {
    label: 'MIT licensed',
    title: 'Free. Open source. Yours.',
    body:
      'Use it, modify it, fork it, and ship with it. Ashfox runs locally in the browser without an account, paid tier, hosted database, or private backend.',
    facts: [
      ['$0', 'to start and keep using'],
      ['MIT', 'permission to build on it'],
      ['Local', 'your files stay with you']
    ]
  },
  formats: [
    ['GeckoLib 5', 'Geometry, animation, and textures for Minecraft Java.'],
    ['Bedrock', 'Geometry and actor animation for Bedrock workflows.'],
    ['GLB', 'One embedded binary asset for portable delivery.'],
    ['glTF', 'Open scene data with external resources when needed.']
  ]
};

export const sectionOrder = [
  'overview',
  'product',
  'architecture',
  'ux',
  'research',
  'migration',
  'decisions'
];

export const sectionLabels = {
  overview: 'Overview',
  product: 'Product',
  architecture: 'Architecture',
  ux: 'Experience',
  research: 'Research',
  migration: 'Migration',
  decisions: 'Decisions'
};
