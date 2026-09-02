export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  titleLines: ['Describe it.', 'Ship it game-ready.'],
  summary:
    'Your AI agent builds one closed, reusable Ashfox asset workspace, reviews a selected entry at native size, and delivers Bedrock, GeckoLib, glTF, or GLB output.',
  showcase: {
    eyebrow: 'Reconstructed build replay',
    body:
      'One closed workspace becomes two selected entries. Each replay starts empty, places geometry in deterministic order, applies complete textures, activates motion, and holds on the validated result.',
    provenance:
      'A reconstructed build replay from the final validated entry — not AI history or a decision log.',
    entries: [
      {
        packageName: 'creatures',
        entryName: 'fox',
        index: '01',
        label: 'Red fox',
        summary: 'Warm ember fur, a bright chest, centered eyes, and a restrained idle.'
      },
      {
        packageName: 'creatures',
        entryName: 'goblin',
        index: '02',
        label: 'Goblin raider',
        summary: 'A scarred green raider with converging eyes, iron armor, shield, and a forward blade.'
      }
    ]
  },
  quickStart: {
    title: 'One instruction. Then describe what you want.',
    body:
      'Paste one line into your agent. The manifest opens the workspace and your agent asks what you want to create.',
    instruction:
      'Fetch and follow https://ashfox.io/workbench/agent-manifest.json using a direct HTTP request such as curl.'
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
      title: 'Build and review',
      body: 'Describe the asset codebase, reuse nominal rigs, components, surfaces, and motions, then review each selected entry.',
      href: '/docs/guides/authoring-and-review/'
    },
    {
      index: '03',
      label: 'Deliver',
      title: 'Export',
      body: 'Keep the portable workspace or export a validated selected entry for your target.',
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
  '/docs/guides/save-and-export/',
  '/docs/guides/choose-a-format/',
  '/docs/guides/troubleshooting/'
];
