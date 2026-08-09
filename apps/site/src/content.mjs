export const landingContent = {
  eyebrow: 'AI-native low-poly workbench',
  titleLines: ['Describe it.', 'Ship it game-ready.'],
  summary:
    'Your AI agent turns one reviewed Intent Program into an editable asset, then delivers optimized Bedrock, GeckoLib, glTF, or GLB output.',
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
      title: 'Model and review',
      body: 'Describe the asset, confirm its intent, and review the compiled result.',
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
