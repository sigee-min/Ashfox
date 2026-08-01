import { showcaseCatalog } from './showcaseCatalog.mjs';

const featuredDemos = showcaseCatalog.filter(
  (item) => item.featured
);
if (featuredDemos.length === 0) {
  throw new Error('At least one featured demo is required.');
}
const landingFlagship = showcaseCatalog.find(
  (item) => item.id === 'blackfrost-dreadwing'
);
if (!landingFlagship?.build) {
  throw new Error('Blackfrost Dreadwing requires build-process media.');
}
const requiredDemo = (id) => {
  const item = showcaseCatalog.find((demo) => demo.id === id);
  if (!item) throw new Error(`Required landing demo is missing: ${id}`);
  return item;
};
const tractor = requiredDemo('ironroot-tractor');
const rocket = requiredDemo('aether-spear-rocket');
const kirin = requiredDemo('moonveil-kirin');

export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  titleLines: ['Describe it.', 'Ship it game-ready.'],
  summary:
    'Your AI agent models, textures, rigs, and animates one editable asset live in ashfox—then delivers optimized Bedrock, GeckoLib, glTF, or GLB output.',
  quickStart: {
    title: 'One instruction. Then describe what you want.',
    body:
      'Paste one line into your agent. The manifest handles the workspace and your agent asks what you want to create.',
    instruction:
      'Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.'
  },
  demo: {
    sequences: [{
      name: landingFlagship.name,
      prompt: landingFlagship.prompt,
      poster: landingFlagship.poster,
      gif: landingFlagship.build.gif,
      durationMs: 11_000,
      model: landingFlagship.agent.model,
      reasoning: landingFlagship.agent.reasoning,
      cooldownMs: 2400
    }]
  },
  story: [
    {
      id: tractor.id,
      eyebrow: 'Structure',
      title: 'Every part has a job.',
      body:
        'Wheel rigs, steering, cabin, lights, and hitch remain editable while the complete machine moves as one.',
      detail: `${tractor.detail} · articulated drivetrain`,
      poster: tractor.poster,
      gif: tractor.animation.gif,
      alt: tractor.animation.alt
    },
    {
      id: rocket.id,
      eyebrow: 'Motion',
      title: 'Built to move.',
      body:
        'Rig, runes, engine plume, and launch timing remain one coherent project.',
      detail: `${rocket.detail} · launch sequence`,
      poster: rocket.poster,
      gif: rocket.animation.gif,
      alt: rocket.animation.alt
    },
    {
      id: kirin.id,
      eyebrow: 'Character',
      title: 'Character stays alive.',
      body:
        'Geometry, derived pixels, expressive details, and animation share the same editable source.',
      detail: `${kirin.detail} · 2 animation clips`,
      poster: kirin.poster,
      gif: kirin.animation.gif,
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
    ['GeckoLib 5', 'Compact geometry, animation, and textures for Minecraft Java.'],
    ['Bedrock', 'Optimized geometry and actor animation for Bedrock workflows.'],
    ['GLB', 'Batched, compressed geometry in one portable binary asset.'],
    ['glTF', 'Optimized open scene data with external resources when needed.']
  ]
};

export const galleryContent = {
  eyebrow: 'Editable demo projects',
  title: 'Open the source.',
  summary:
    'Search the latest production demos, filter by asset type, and open any complete .ashfox project directly in the workbench.',
  categories: [...new Set(
    showcaseCatalog.map((item) => item.category)
  )]
    .sort((left, right) => left.localeCompare(right)),
  items: showcaseCatalog.map((item) => ({
    ...item,
    galleryId: item.id,
    gif: item.animation.gif,
    searchText: item.name
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
