import { showcaseCatalog } from './showcaseCatalog.mjs';

const [tractor, rocket, kirin] = showcaseCatalog;

export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  titleLines: ['Describe it.', 'Watch it come alive.'],
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
    sequences: showcaseCatalog.map((item) => ({
      name: item.name,
      prompt: item.prompt,
      poster: item.poster,
      video: item.build.video,
      cooldownMs: 2400
    }))
  },
  story: [
    {
      eyebrow: 'Structure',
      title: 'Structure takes shape.',
      body:
        'An empty scene becomes an articulated machine with every part still editable.',
      detail: '108 bones · 125 cubes · articulated drivetrain',
      poster: tractor.poster,
      video: tractor.build.video,
      alt: tractor.build.alt
    },
    {
      eyebrow: 'Motion',
      title: 'Built to move.',
      body:
        'Rig, runes, engine plume, and launch timing remain one coherent project.',
      detail: '131 bones · 166 cubes · launch sequence',
      poster: rocket.poster,
      video: rocket.animation.video,
      alt: rocket.animation.alt
    },
    {
      eyebrow: 'Character',
      title: 'Character stays alive.',
      body:
        'Geometry, derived pixels, expressive details, and animation share the same source.',
      detail: '113 bones · 131 cubes · 2 animation clips',
      poster: kirin.poster,
      video: kirin.animation.video,
      alt: kirin.animation.alt
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
      title: 'Export',
      body: 'Keep the editable project or export a file ready for your target.',
      href: '/docs/guides/save-and-export/'
    }
  ],
  formats: [
    ['Java block', 'A version-matched resource pack with model and textures.'],
    ['GeckoLib 5', 'Geometry, animation, and textures for Minecraft Java.'],
    ['Bedrock', 'Geometry and actor animation for Bedrock workflows.'],
    ['GLB', 'One embedded binary asset for portable delivery.'],
    ['glTF', 'Open scene data with external resources when needed.']
  ]
};

export const galleryContent = {
  eyebrow: 'Gallery',
  title: 'Made in ashfox.',
  summary:
    'Finished low-poly assets. Point to a card—or tap it—to watch the build.',
  pageSize: 3,
  items: showcaseCatalog.map((item) => ({
    ...item,
    galleryId: item.id,
    phase: 'Complete asset',
    gif: item.build.gif,
    alt: item.build.alt
  }))
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
