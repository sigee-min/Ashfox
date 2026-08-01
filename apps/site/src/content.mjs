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
