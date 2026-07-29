export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  title: 'Describe it. Watch it come alive.',
  summary:
    'Your AI agent models, textures, rigs, and animates your asset live in ashfox—ready for your game.',
  quickStart: {
    title: 'One instruction. Then describe what you want.',
    body:
      'Paste one line into your agent. The manifest handles the workspace and your agent asks what you want to create.',
    instruction:
      'Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.'
  },
  demo: {
    sequences: [
      {
        name: 'Ironroot Tractor',
        prompt:
          'Create a high-quality Minecraft-style arcane field tractor, fully textured, rigged, animated, and ready for a game.',
        poster: '/media/showcase/ironroot-tractor.jpg',
        reel: '/media/showcase/ironroot-tractor-build.gif',
        playbackMs: 5500,
        cooldownMs: 2400
      },
      {
        name: 'Aether Spear Rocket',
        prompt:
          'Create a high-quality Minecraft-style runic exploration rocket, fully textured, rigged, animated, and ready for a game.',
        poster: '/media/showcase/aether-spear-rocket.jpg',
        reel: '/media/showcase/aether-spear-rocket-build.gif',
        playbackMs: 5900,
        cooldownMs: 2400
      },
      {
        name: 'Moonveil Kirin',
        prompt:
          'Create a high-quality Minecraft-style fantasy kirin, fully textured, rigged, animated, and ready for a game.',
        poster: '/media/showcase/moonveil-kirin.jpg',
        reel: '/media/showcase/moonveil-kirin-build.gif',
        playbackMs: 6100,
        cooldownMs: 2400
      }
    ]
  },
  story: [
    {
      eyebrow: 'Structure',
      title: 'Structure takes shape.',
      body:
        'An empty scene becomes an articulated machine with every part still editable.',
      detail: '108 bones · 125 cubes · articulated drivetrain',
      poster: '/media/showcase/ironroot-tractor.jpg',
      media: '/media/showcase/ironroot-tractor-build.gif',
      alt: 'Ironroot Tractor assembled from an empty ashfox scene'
    },
    {
      eyebrow: 'Motion',
      title: 'Built to move.',
      body:
        'Rig, runes, engine plume, and launch timing remain one coherent project.',
      detail: '131 bones · 166 cubes · launch sequence',
      poster: '/media/showcase/aether-spear-rocket.jpg',
      media: '/media/showcase/aether-spear-rocket-animation.gif',
      alt: 'Aether Spear Rocket launch animation in ashfox'
    },
    {
      eyebrow: 'Character',
      title: 'Character stays alive.',
      body:
        'Geometry, authored pixels, expressive details, and animation share the same source.',
      detail: '113 bones · 131 cubes · 2 animation clips',
      poster: '/media/showcase/moonveil-kirin.jpg',
      media: '/media/showcase/moonveil-kirin-animation.gif',
      alt: 'Moonveil Kirin character animation in ashfox'
    }
  ],
  guides: [
    {
      index: '01',
      label: 'Start here',
      title: 'Connect your agent',
      body: 'Paste the copied instructions into Codex desktop app, Cursor, or another browser-capable agent.',
      href: '/docs/guides/ai-agent-quick-start/'
    },
    {
      index: '02',
      label: 'Author',
      title: 'Model, refine, animate',
      body: 'Shape the model, fix details, and add motion with focused requests.',
      href: '/docs/guides/authoring-and-review/'
    },
    {
      index: '03',
      label: 'Deliver',
      title: 'Save and export',
      body: 'Keep the editable project or export a file ready for your target.',
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
  'guides'
];

export const sectionLabels = {
  overview: 'Start here',
  guides: 'Guides'
};

export const documentationOrder = [
  '/docs/',
  '/docs/guides/ai-agent-quick-start/',
  '/docs/guides/authoring-and-review/',
  '/docs/guides/examples/',
  '/docs/guides/save-and-export/',
  '/docs/guides/choose-a-format/',
  '/docs/guides/troubleshooting/'
];
