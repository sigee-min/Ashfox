import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  createProjectFromInput,
  executeCommandBatch,
  listAgentCommandDefinitions,
  validateProjectDocument,
  type CommandReceipt,
  type PartSpec
} from '@ashfox/engine-core';

import {
  createGeckoLib5Project,
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import { agentCommandProtocol } from '../src/features/agent/agentCommandProtocol';
import { agentManifest as manifest } from '../src/features/agent/agentManifest';
import { inspectProject } from '../src/features/agent/inspect';
import { schemaHash } from '../src/features/agent/schemaHash';

const webRoot = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(webRoot, 'index.html'), 'utf8');
const sourceRoot = path.join(webRoot, 'src');
const { staticFiles } = require('../scripts/prepareOutput') as {
  staticFiles: readonly string[];
};

const readSourceTree = (directory: string): string =>
  fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) return readSourceTree(target);
      if (target.endsWith('features/agent/agentManifest.ts')) return '';
      return /\.[cm]?[jt]sx?$/.test(entry.name)
        ? fs.readFileSync(target, 'utf8')
        : '';
    })
    .join('\n');

const productSource = readSourceTree(sourceRoot);

const assertSelectorIsRendered = (
  name: string,
  selector: string
): void => {
  const match = selector.match(/^\[([\w-]+)="([^"]+)"\]$/);
  assert.ok(match, `${name} must be one exact attribute selector`);
  const [, attribute, value] = match;
  assert.ok(
    productSource.includes(`${attribute}="${value}"`),
    `${name} must reference rendered product markup`
  );
};

const assertAttributeIsRendered = (
  name: string,
  attribute: string
): void => {
  assert.match(attribute, /^[\w-]+$/);
  assert.ok(
    productSource.includes(`${attribute}=`) ||
      productSource.includes(`${attribute}\n`),
    `${name} must reference rendered product state`
  );
};

assert.equal(manifest.protocol, 'ashfox.agent-command-port');
assert.equal(manifest.workbench, '/workbench/');
assert.equal(manifest.href, '/workbench/agent-manifest.json');
assert.equal(manifest.pageApi.global, 'ashfox');
assert.equal(manifest.pageApi.presentMethod, 'present');
assert.match(manifest.pageApi.present.call, /window\.ashfox\.present/);
assert.match(manifest.pageApi.inspect.command, /kind:"command"/);
assert.match(manifest.pageApi.run.call, /await window\.ashfox\.run/);
assert.match(manifest.setup.manifest, /such as curl/);
assert.match(manifest.setup.manifest, /Never navigate/);
assert.match(manifest.setup.ready, /What would you like to create/);

assert.match(manifest.modeling.authority, /Raw bone and cube commands/);
assert.match(manifest.modeling.canonicalState, /one normalized/);
assert.match(manifest.modeling.canonicalState, /structural drift/);
assert.match(manifest.modeling.canonicalState, /UV and raster caches/);
assert.match(manifest.modeling.lattice, /1\/d model unit/);
assert.match(manifest.modeling.hierarchy, /bone:<partId>/);
assert.match(manifest.modeling.hierarchy, /not agent input/);
assert.match(manifest.modeling.hierarchy, /project space/);
assert.deepEqual(
  Object.keys(manifest.modeling.primitives),
  ['mass', 'segment', 'plate', 'radial', 'feature']
);
assert.equal(manifest.modeling.enforcedInvariants.length, 12);
assert.ok(
  manifest.modeling.enforcedInvariants.some((entry) =>
    entry.includes('6-connected')
  )
);
assert.ok(
  manifest.modeling.enforcedInvariants.some((entry) =>
    entry.includes('single-owned cells without overlap')
  )
);
assert.ok(
  manifest.modeling.enforcedInvariants.some((entry) =>
    entry.includes('at most two surface cells')
  )
);
assert.ok(
  manifest.modeling.enforcedInvariants.some((entry) =>
    entry.includes('static support')
  )
);
assert.match(manifest.texture.authority, /derives external-face UVs/);
assert.match(manifest.texture.density, /1, 2, or 4/);
assert.match(manifest.texture.review, /square-pixel size/);
assert.match(manifest.completion.model, /never a quality score/);
assert.match(manifest.completion.semanticBoundary, /not subject identity/);
assert.match(manifest.completion.review, /generic humanoid substitution/);

const agentDefinitions = listAgentCommandDefinitions();
assert.equal(
  schemaHash({ properties: { b: 2, a: 1 } }),
  schemaHash({ properties: { a: 1, b: 2 } })
);
assert.deepEqual(
  manifest.commands.map((command) => ({
    name: command.name,
    purpose: command.purpose,
    schemaHash: command.schemaHash
  })),
  agentDefinitions.map((definition) => ({
    name: definition.name,
    purpose: definition.purpose,
    schemaHash: schemaHash(definition.inputSchema)
  }))
);
assert.ok(
  manifest.commands.every(
    (command) => !Object.hasOwn(command, 'inputSchema')
  )
);
const agentCommandNames = manifest.commands.map((command) => command.name);
for (const command of [
  'model.parts.upsert',
  'model.parts.material',
  'model.parts.delete',
  'textures.density.set',
  'animation.clip.upsert'
]) {
  assert.ok(agentCommandNames.includes(command));
}
for (const rawCommand of [
  'scene.bones.create',
  'scene.cubes.create',
  'scene.cubes.geometry.update',
  'scene.nodes.delete',
  'scene.cubes.material'
]) {
  assert.ok(!agentCommandNames.includes(rawCommand));
}

for (const [name, selector] of Object.entries(manifest.domActions)) {
  assertSelectorIsRendered(`domActions.${name}`, selector);
}
assert.ok(!Object.hasOwn(manifest.domActions, 'newProject'));
assert.ok(!Object.hasOwn(manifest.domActions, 'createProject'));
assert.ok(!Object.hasOwn(manifest, 'domFields'));
const artifactMarkup = 'data-ashfox-action="artifact.download"';
assert.equal(
  manifest.domActions.downloadArtifact,
  `[${artifactMarkup}]`
);
assert.equal(productSource.split(artifactMarkup).length - 1, 1);
assert.equal(
  agentCommandProtocol.inputAttribute,
  manifest.domBridge.input.attribute
);
assert.equal(
  agentCommandProtocol.resultAttribute,
  manifest.domBridge.result.attribute
);
assert.match(
  html,
  /data-ashfox-agent-manifest="\/workbench\/agent-manifest\.json"/
);
assert.match(html, /type="application\/vnd\.ashfox\.agent\+json"/);
assert.ok(staticFiles.includes('workbench/agent-manifest.json'));

assert.equal(
  manifest.domState.root,
  `[${manifest.domState.statusAttribute}]`
);
assertAttributeIsRendered(
  'domState.statusAttribute',
  manifest.domState.statusAttribute
);
assertAttributeIsRendered(
  'domState.revisionAttribute',
  manifest.domState.revisionAttribute
);
for (const attribute of [
  manifest.domState.fileOperation.phaseAttribute,
  manifest.domState.fileOperation.kindAttribute,
  manifest.domState.fileOperation.operationIdAttribute,
  manifest.domState.artifact.nameAttribute,
  manifest.domState.artifact.contentTypeAttribute,
  manifest.domState.artifact.byteLengthAttribute
]) {
  assertAttributeIsRendered(attribute, attribute);
}
assert.deepEqual(
  manifest.domState.fileOperation.terminalPhases,
  ['idle', 'succeeded', 'cancelled', 'failed']
);
assert.match(manifest.export.operation, /derived from the canonical/);
assert.doesNotMatch(manifest.export.operation, /set format/);
assert.ok(
  Buffer.byteLength(JSON.stringify(manifest)) <= 40_960,
  'the complete machine guide must fit one practical request'
);
assert.deepEqual(
  manifest.workflow.map((step) => step.stage),
  [
    'start',
    'specify',
    'prove',
    'author',
    'animate',
    'review',
    'produce'
  ]
);
for (const step of manifest.workflow) {
  assert.ok(JSON.stringify(step).length <= 520);
}
assert.match(manifest.workflow[0].instruction, /project\.create/);
assert.match(manifest.workflow[2].instruction, /root part/);
assert.match(manifest.workflow[3].instruction, /coarse-to-fine/);
assert.equal(manifest.delivery.requestedPath, 'workspace-relative directory');
assert.equal(manifest.delivery.defaultDirectory, 'artifacts/');
assert.equal(manifest.delivery.steps.length, 3);

const document = createGltfProject();
const selectedCube = Object.values(document.scene.nodes)
  .find((node) => node.kind === 'cube');
const result = inspectProject(
  document,
  selectedCube?.id ?? null,
  validateProjectDocument(document)
);
assert.equal(result.ok, true);
assert.ok(Buffer.byteLength(JSON.stringify(result)) <= 2_048);
if (result.ok) {
  const data = result.data as {
    protocol: {
      workbench: string;
      manifest: string;
    };
    project: {
      surfacePixelDensity: number;
      textureResolution: {
        width: number;
        height: number;
      };
    };
    counts: {
      nodes: number;
      parts: number;
      bones: number;
      cubes: number;
      visibleCubes: number;
      meshes: number;
      locators: number;
      enabledVisibleFaces: number;
      texturedVisibleFaces: number;
      untexturedVisibleFaces: number;
      textures: number;
      clips: number;
      channels: number;
      triggers: number;
      idleClips: number;
      idleChannels: number;
    };
    workflow: {
      recommendedCommands: readonly string[];
    };
  };
  assert.equal(data.protocol.workbench, manifest.workbench);
  assert.equal(data.protocol.manifest, manifest.href);
  assert.ok(data.workflow.recommendedCommands.length <= 3);
  assert.ok(
    data.workflow.recommendedCommands.every((command) =>
      agentDefinitions.some(
        (definition) => definition.name === command
      )
    )
  );
  assert.equal(
    data.project.surfacePixelDensity,
    document.settings.surfacePixelDensity
  );
  assert.deepEqual(
    data.project.textureResolution,
    document.settings.textureResolution
  );
  assert.deepEqual(data.counts, {
    nodes: 3,
    parts: 0,
    bones: 1,
    cubes: 1,
    visibleCubes: 1,
    meshes: 0,
    locators: 1,
    enabledVisibleFaces: 6,
    texturedVisibleFaces: 6,
    untexturedVisibleFaces: 0,
    textures: 1,
    clips: 1,
    channels: 1,
    triggers: 0,
    idleClips: 1,
    idleChannels: 1
  });
}

const modelCommand = inspectProject(
  document,
  null,
  validateProjectDocument(document),
  { kind: 'command', name: 'model.parts.upsert' }
);
assert.equal(modelCommand.ok, true);
if (modelCommand.ok) {
  const data = modelCommand.data as {
    schemaHash: string;
    inputSchema: unknown;
  };
  assert.equal(
    data.schemaHash,
    schemaHash(
      agentDefinitions.find(
        (definition) => definition.name === 'model.parts.upsert'
      )?.inputSchema
    )
  );
  assert.ok(data.inputSchema);
}
const rawCommand = inspectProject(
  document,
  null,
  validateProjectDocument(document),
  { kind: 'command', name: 'scene.cubes.create' }
);
assert.equal(rawCommand.ok, false);
if (!rawCommand.ok) assert.equal(rawCommand.error.code, 'not_found');

const exactPart: PartSpec = {
  kind: 'mass',
  partId: 'demo.core',
  parentPartId: null,
  materialId: 'copper',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [2, 3, 4],
  radii: [2, 1, 3],
  profile: 'soft'
};
const { attachment: _exactAttachment, ...exactAuthoringPart } =
  exactPart;
const emptyModel = createProjectFromInput(
  {
    id: 'inspect-recipe',
    name: 'Inspect recipe',
    target: 'geckolib5',
    namespace: 'ashfox',
    modelPath: 'inspect_recipe',
    createdAt: '2026-07-30T00:00:00.000Z'
  },
  'inspect-recipe-revision'
);
const authoredModel = executeCommandBatch(
  emptyModel,
  {
    batchId: 'inspect-recipe-author',
    baseProjectId: emptyModel.id,
    baseRevision: emptyModel.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [exactAuthoringPart],
        materials: [{
          id: 'copper',
          baseColor: '#A65C35'
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(authoredModel.ok, true);
if (!authoredModel.ok) {
  throw new Error('Exact inspect fixture could not be authored.');
}
const exactInspect = inspectProject(
  authoredModel.document,
  null,
  validateProjectDocument(authoredModel.document),
  { kind: 'parts', ids: ['demo.core'] }
);
assert.equal(exactInspect.ok, true);
if (exactInspect.ok) {
  const inspected = exactInspect.data as {
    parts: readonly {
      spec: Omit<PartSpec, 'attachment'>;
      material: {
        id: string;
        baseColor: string;
      };
      canonicalization: {
        authoredCellCount: number;
        canonicalCellCount: number;
        trimmedCellCount: number;
        maximumTrimDepthCells: number;
      };
    }[];
  };
  assert.deepEqual(
    inspected.parts[0]?.spec,
    exactAuthoringPart
  );
  assert.equal(
    Object.hasOwn(
      inspected.parts[0]?.spec ?? {},
      'attachment'
    ),
    false
  );
  assert.deepEqual(inspected.parts[0]?.material, {
    id: 'copper',
    baseColor: '#A65C35'
  });
  assert.equal(
    inspected.parts[0]?.canonicalization.authoredCellCount,
    inspected.parts[0]?.canonicalization.canonicalCellCount
  );
  assert.equal(
    inspected.parts[0]?.canonicalization.trimmedCellCount,
    0
  );
  assert.equal(
    inspected.parts[0]?.canonicalization.maximumTrimDepthCells,
    0
  );
}

const hiddenRootProject = structuredClone(document);
hiddenRootProject.scene.nodes['bone-root'].visible = false;
const hidden = inspectProject(
  hiddenRootProject,
  null,
  validateProjectDocument(hiddenRootProject)
);
assert.equal(hidden.ok, true);
if (hidden.ok) {
  const counts = (hidden.data as {
    counts: {
      visibleCubes: number;
      enabledVisibleFaces: number;
    };
  }).counts;
  assert.equal(counts.visibleCubes, 0);
  assert.equal(counts.enabledVisibleFaces, 0);
}

const untextured = structuredClone(createGeckoLib5Project());
const untexturedCube = untextured.scene.nodes['cube-body'];
assert.equal(untexturedCube.kind, 'cube');
if (untexturedCube.kind !== 'cube') {
  throw new Error('GeckoLib fixture cube missing');
}
for (const face of Object.values(untexturedCube.faces)) {
  face.textureId = null;
}
untextured.textures = {};
const readiness = inspectProject(
  untextured,
  null,
  validateProjectDocument(untextured),
  { kind: 'target' }
);
assert.equal(readiness.ok, true);
if (readiness.ok) {
  const data = readiness.data as {
    valid: boolean;
    mechanicallyReady: boolean;
    semanticReviewRequired: boolean;
    counts: {
      warnings: number;
      textures: number;
    };
    firstReadinessFinding: {
      code: string;
    };
  };
  assert.equal(data.valid, true);
  assert.equal(data.mechanicallyReady, false);
  assert.equal(data.semanticReviewRequired, true);
  assert.equal(data.counts.warnings, 1);
  assert.equal(data.counts.textures, 0);
  assert.equal(
    data.firstReadinessFinding.code,
    'production.texture_coverage_incomplete'
  );
}

const catalogPageOne = inspectProject(
  document,
  null,
  validateProjectDocument(document),
  { kind: 'catalog', limit: 1 }
);
assert.equal(catalogPageOne.ok, true);
if (catalogPageOne.ok) {
  const data = catalogPageOne.data as {
    items: readonly { kind: string; id: string }[];
    nextCursor: string | null;
    total: number;
  };
  assert.equal(data.items.length, 1);
  assert.equal(data.total, 2);
  assert.ok(data.nextCursor);
  const catalogPageTwo = inspectProject(
    document,
    null,
    validateProjectDocument(document),
    {
      kind: 'catalog',
      limit: 1,
      cursor: data.nextCursor ?? undefined
    }
  );
  assert.equal(catalogPageTwo.ok, true);
  if (catalogPageTwo.ok) {
    const secondData = catalogPageTwo.data as {
      items: readonly { id: string }[];
    };
    assert.notEqual(
      secondData.items[0]?.id,
      data.items[0]?.id
    );
  }
}

const largeClipDocument = structuredClone(document);
const largeClip = largeClipDocument.animations['clip-idle'];
const largeChannel = largeClip.channels['channel-root-rotation'];
largeClipDocument.animations = {
  ...largeClipDocument.animations,
  'clip-idle': {
    ...largeClip,
    channels: {
      ...largeClip.channels,
      'channel-root-rotation': {
        ...largeChannel,
        keys: Array.from({ length: 800 }, (_, index) => ({
          id: `large-key-${index}`,
          timeSeconds: index / 799,
          value: [0, index % 2, 0] as const,
          interpolation: 'linear' as const
        }))
      }
    }
  }
};
const boundedClip = inspectProject(
  largeClipDocument,
  null,
  validateProjectDocument(document),
  { kind: 'clip', ids: ['clip-idle'] }
);
assert.equal(boundedClip.ok, true);
if (boundedClip.ok) {
  assert.equal(boundedClip.truncated, true);
  assert.equal(
    (boundedClip.data as readonly { channelCount: number }[])[0]
      ?.channelCount,
    1
  );
}

const activity = [0, 1].map((index): CommandReceipt => ({
  schemaVersion: 1,
  commandId: `activity-${index}`,
  projectId: document.id,
  actorId: 'agent-discovery-test',
  source: 'agent',
  summary: `Activity ${index}`,
  beforeRevision: `revision-${index}`,
  revision: `revision-${index + 1}`,
  completedAt: `2026-07-31T00:00:0${index}.000Z`,
  durationMs: index,
  effects: {
    createdEntityIds: [],
    changedEntityIds: [],
    removedEntityIds: [],
    invalidated: ['validation']
  },
  findings: []
}));
const activityPage = inspectProject(
  document,
  null,
  validateProjectDocument(document),
  { kind: 'activity', limit: 1 },
  activity
);
assert.equal(activityPage.ok, true);
if (activityPage.ok) {
  const data = activityPage.data as {
    items: readonly { commandId: string }[];
    nextCursor: string | null;
  };
  assert.equal(data.items[0]?.commandId, 'activity-0');
  assert.ok(data.nextCursor);
}

const largeFinding = inspectProject(
  document,
  null,
  {
    valid: false,
    findings: [{
      code: 'scene.root_missing',
      severity: 'error',
      message: 'Missing root.',
      path: 'scene.roots',
      entityIds: Array.from(
        { length: 5_000 },
        (_, index) => `entity-${index}`
      )
    }]
  },
  { kind: 'finding', path: 'scene.roots' }
);
assert.equal(largeFinding.ok, true);
if (largeFinding.ok) {
  assert.equal(largeFinding.truncated, true);
  assert.equal(
    (largeFinding.data as { entityCount: number }).entityCount,
    5_000
  );
}
