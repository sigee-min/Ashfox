export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  title: 'Consistent models, textures, and animation.',
  summary:
    'Ashfox gives your AI IDE one visual, deterministic workspace for complete low-poly assets.',
  proof: [
    'AI IDE native',
    'Deterministic edits',
    'Local files'
  ],
  quickStart: {
    title: 'Start with one prompt.',
    body:
      'Paste this into your AI IDE. It opens Ashfox in the in-app browser and builds a complete first asset.',
    prompt:
      'Open https://ashfox.io in the in-app browser. Create a new Ashfox project and build a highly detailed low-poly truck with consistent modeling, texturing, and animation. Review the result in the live viewport.'
  },
  demo: {
    sequences: [
      {
        name: 'Moonveil Kirin',
        prompt:
          'Open https://ashfox.io in the in-app browser and create a Minecraft-style fantasy kirin.',
        poster: '/media/showcase/moonveil-kirin.jpg',
        reel: '/media/showcase/moonveil-kirin-build.gif',
        playbackMs: 6000,
        cooldownMs: 2400
      },
      {
        name: 'Ironroot Tractor',
        prompt:
          'Open https://ashfox.io in the in-app browser and create a Minecraft-style arcane field tractor.',
        poster: '/media/showcase/ironroot-tractor.jpg',
        reel: '/media/showcase/ironroot-tractor-build.gif',
        playbackMs: 5400,
        cooldownMs: 2400
      },
      {
        name: 'Aether Spear Rocket',
        prompt:
          'Open https://ashfox.io in the in-app browser and create a Minecraft-style runic exploration rocket.',
        poster: '/media/showcase/aether-spear-rocket.jpg',
        reel: '/media/showcase/aether-spear-rocket-build.gif',
        playbackMs: 5800,
        cooldownMs: 2400
      }
    ]
  },
  showcase: [
    {
      name: 'Moonveil Kirin',
      kind: 'Celestial creature',
      detail: '113 bones · 131 cubes · 2 clips',
      image: '/media/showcase/moonveil-kirin.jpg',
      animation: '/media/showcase/moonveil-kirin-animation.gif',
      studioSlug: 'moonveil-kirin'
    },
    {
      name: 'Ironroot Tractor',
      kind: 'Arcane machinery',
      detail: '108 bones · 125 cubes · articulated drivetrain',
      image: '/media/showcase/ironroot-tractor.jpg',
      animation: '/media/showcase/ironroot-tractor-animation.gif',
      studioSlug: 'ironroot-tractor'
    },
    {
      name: 'Aether Spear',
      kind: 'Exploration rocket',
      detail: '131 bones · 166 cubes · launch sequence',
      image: '/media/showcase/aether-spear-rocket.jpg',
      animation: '/media/showcase/aether-spear-rocket-animation.gif',
      studioSlug: 'aether-spear-rocket'
    }
  ],
  guides: [
    {
      index: '01',
      label: 'Start here',
      title: 'AI IDE quick start',
      body: 'Open Ashfox in the in-app browser and build the first asset.',
      href: '/docs/guides/ai-ide-quick-start/'
    },
    {
      index: '02',
      label: 'Author',
      title: 'Model, refine, animate',
      body: 'Use short prompts and exact tools for geometry, pixels, and motion.',
      href: '/docs/guides/authoring-and-review/'
    },
    {
      index: '03',
      label: 'Deliver',
      title: 'Save and export',
      body: 'Save the editable project or export the target artifact.',
      href: '/docs/guides/save-and-export/'
    }
  ],
  formats: [
    ['GeckoLib 5', 'Geometry, animation, and textures for Minecraft Java.'],
    ['Bedrock', 'Geometry and actor animation for Bedrock workflows.'],
    ['GLB', 'One embedded binary asset for portable delivery.'],
    ['glTF', 'Open scene data with external resources when needed.']
  ]
};

export const sectionOrder = [
  'overview',
  'guides',
  'product',
  'architecture',
  'ux',
  'research',
  'migration',
  'decisions'
];

export const sectionLabels = {
  overview: 'Overview',
  guides: 'Guides',
  product: 'Product',
  architecture: 'Architecture',
  ux: 'Experience',
  research: 'Research',
  migration: 'Migration',
  decisions: 'Decisions'
};
