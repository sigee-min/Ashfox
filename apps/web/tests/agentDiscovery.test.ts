import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  listCommandDefinitions,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createGeckoLib5Project,
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import { agentCommandProtocol } from '../src/features/agent/agentCommandProtocol';
import { agentManifest as manifest } from '../src/features/agent/agentManifest';
import { inspectProject } from '../src/features/agent/inspect';

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
  assert.ok(match, `${name} must be a single exact attribute selector`);
  const [, attribute, value] = match;
  assert.ok(
    productSource.includes(`${attribute}="${value}"`),
    `${name} must reference a rendered product attribute`
  );
};

const assertAttributeIsRendered = (
  name: string,
  attribute: string
): void => {
  assert.match(attribute, /^[\w-]+$/, `${name} must be an attribute name`);
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
assert.match(manifest.pageApi.inspect.current, /typed scene/);
assert.match(manifest.completionContract.defaultScope.model, /Required/);
assert.match(
  manifest.completionContract.defaultScope.texture,
  /textureContract/
);
assert.match(
  manifest.completionContract.defaultScope.idleAnimation,
  /animation\.<asset>\.idle/
);
assert.deepEqual(
  Object.keys(manifest.completionContract),
  [
    'defaultScope',
    'verificationBoundary',
    'subjectFidelity',
    'reviewGates'
  ]
);
assert.match(
  manifest.completionContract.verificationBoundary.machine,
  /explicit structural facts/
);
assert.match(
  manifest.completionContract.verificationBoundary.semantic,
  /not deterministically provable/
);
assert.match(
  manifest.completionContract.subjectFidelity.eyes,
  /When visible eyes define the subject/
);
assert.match(
  manifest.completionContract.subjectFidelity.general,
  /never substitute a familiar generic body or rig/
);
assert.match(
  manifest.completionContract.subjectFidelity.bodyPlan,
  /human shoulder or pelvis layout/
);
assert.match(
  manifest.completionContract.defaultScope.idleAnimation,
  /identical hold keys/
);
assert.match(
  manifest.completionContract.reviewGates.form,
  /z-fighting/
);
assert.match(
  manifest.completionContract.reviewGates.form,
  /coarse stage/
);
assert.match(
  manifest.completionContract.reviewGates.form,
  /cube\.fully_occluded/
);
assert.match(manifest.completionContract.reviewGates.texture, /textureContract/);
assert.match(manifest.textureContract.authority, /baseColor/);
assert.match(manifest.textureContract.material, /#RRGGBB/);
assert.match(
  manifest.textureContract.generated.bootstrap,
  /automatically creates or reuses/
);
assert.match(
  manifest.textureContract.generated.synchronize,
  /exactly 1 square texel per model unit/
);
assert.match(
  manifest.textureContract.generated.triggers,
  /baseColor renders directly/
);
assert.match(
  manifest.textureContract.generated.grid,
  /whole model unit/
);
assert.match(
  manifest.textureContract.generated.surfacePattern,
  /pixel-art tonal pattern/
);
assert.match(
  manifest.textureContract.generated.surfacePattern,
  /canonical direction, edge contrast, and pixel variation rules/
);
assert.match(
  manifest.textureContract.generated.terminal,
  /no_change/
);
assert.match(
  manifest.textureContract.review,
  /identical square-pixel size/
);
assert.match(manifest.textureContract.limits, /never silently reduces/);
assert.match(manifest.exportContract.precondition, /completionContract/);
assert.ok(
  manifest.rules.some((rule) =>
    rule.includes('textureContract')
  ),
  'the AI workflow must use the canonical texture contract'
);
assert.match(manifest.setup.manifest, /such as curl/);
assert.match(manifest.setup.manifest, /Never navigate/);
assert.match(manifest.setup.authority, /complete ashfox operating guide/);
assert.equal(
  manifest.setup.ready,
  'After the page API is connected and the current project is inspected, ask exactly: "What would you like to create?" Do not mutate the project before the user answers.'
);
assert.deepEqual(
  manifest.commands.map((command) => ({
    name: command.name,
    purpose: command.purpose,
    inputSchema: command.inputSchema
  })),
  listCommandDefinitions().map((definition) => ({
    name: definition.name,
    purpose: definition.purpose,
    inputSchema: definition.inputSchema
  })),
  'the manifest command catalog must be generated from the canonical registry'
);
assert.match(manifest.authoringModel.coordinates, /right-handed Y-up/);
assert.match(
  manifest.authoringModel.cubes,
  /scene\.cubes\.geometry\.update/
);
assert.match(
  manifest.authoringModel.hierarchy,
  /scene\.locators\.create/
);
assert.match(manifest.authoringModel.hierarchy, /scene\.nodes\.delete/);
assert.match(
  manifest.authoringModel.animation,
  /animation\.tracks\.delete/
);
assert.match(manifest.authoringModel.project, /project\.target\.set/);
assert.deepEqual(
  Object.keys(manifest.authoringModel.targets),
  ['bedrock', 'geckolib5', 'gltf', 'glb']
);
assert.match(manifest.exportContract.precondition, /productionReady/);
assert.deepEqual(
  Object.keys(manifest.exportContract.outputs),
  ['geckolib5', 'bedrock', 'gltf', 'glb']
);
for (const [name, selector] of Object.entries(manifest.domActions)) {
  assertSelectorIsRendered(`domActions.${name}`, selector);
}
assert.ok(!Object.hasOwn(manifest.domActions, 'newProject'));
assert.ok(!Object.hasOwn(manifest.domActions, 'createProject'));
assert.ok(!Object.hasOwn(manifest.domActions, 'downloadCapture'));
const artifactAction = manifest.domActions.downloadArtifact;
const artifactActionMarkup =
  'data-ashfox-action="artifact.download"';
assert.equal(artifactAction, `[${artifactActionMarkup}]`);
assert.equal(
  productSource.split(artifactActionMarkup).length - 1,
  1,
  'save, export, and capture must share one artifact handoff anchor'
);
assert.ok(!productSource.includes('project.capture.download'));
assert.ok(!productSource.includes('downloadBytes('));
assert.ok(
  !productSource.includes('Download started'),
  'artifact preparation must not claim an automatic browser download'
);
for (const [name, selector] of Object.entries(manifest.domFields)) {
  const attributes = [...selector.matchAll(
    /\[([\w-]+)="([^"]+)"\]/g
  )];
  assert.ok(attributes.length > 0, `domFields.${name} must be exact`);
  for (const [, attribute, value] of attributes) {
    assert.ok(
      productSource.includes(`${attribute}="${value}"`),
      `domFields.${name} must reference a rendered product field`
    );
  }
}
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
assert.match(
  html,
  /type="application\/vnd\.ashfox\.agent\+json"/
);
assert.ok(
  staticFiles.includes('workbench/agent-manifest.json'),
  'the static deployment must include the discovered manifest'
);
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
assert.ok(
  productSource.includes(
    `data-ashfox-agent-manifest={agentCommandProtocol.href}`
  ),
  'the rendered workbench must expose the discovered manifest'
);

const fileOperation = manifest.domState.fileOperation;
assertAttributeIsRendered(
  'domState.fileOperation.phaseAttribute',
  fileOperation.phaseAttribute
);
assertAttributeIsRendered(
  'domState.fileOperation.kindAttribute',
  fileOperation.kindAttribute
);
assertAttributeIsRendered(
  'domState.fileOperation.operationIdAttribute',
  fileOperation.operationIdAttribute
);
assert.deepEqual(fileOperation.terminalPhases, [
  'idle',
  'succeeded',
  'cancelled',
  'failed'
]);
assert.ok(!fileOperation.terminalPhases.includes('running'));
const messageAttribute = fileOperation.messageSelector.match(
  /^\[([\w-]+)\]$/
)?.[1];
assert.ok(messageAttribute, 'file message must use a presence selector');
assert.ok(
  productSource.includes(messageAttribute),
  'the file operation message must be rendered for observation'
);
const artifactState = manifest.domState.artifact;
assert.equal(artifactState.action, 'downloadArtifact');
assert.ok(
  Object.hasOwn(manifest.domActions, artifactState.action),
  'artifact state must reference the canonical DOM action key'
);
assertAttributeIsRendered(
  'domState.artifact.nameAttribute',
  artifactState.nameAttribute
);
assertAttributeIsRendered(
  'domState.artifact.contentTypeAttribute',
  artifactState.contentTypeAttribute
);
assertAttributeIsRendered(
  'domState.artifact.byteLengthAttribute',
  artifactState.byteLengthAttribute
);

assert.ok(
  Buffer.byteLength(JSON.stringify(manifest)) <= 40_960,
  'the complete machine guide must remain practical to fetch in one request'
);
assert.deepEqual(
  manifest.workflow.map((step) => step.stage),
  ['start', 'prove', 'author', 'review', 'produce', 'deliver']
);
for (const step of manifest.workflow) {
  assert.ok(
    JSON.stringify(step).length <= 520,
    `workflow.${step.stage} must remain focused`
  );
}
const startStage = manifest.workflow.find((step) => step.stage === 'start');
assert.ok(startStage && 'instruction' in startStage);
assert.match(startStage.instruction, /project\.create/);
assert.match(startStage.instruction, /do not operate the New Project UI/);
const proveStage = manifest.workflow.find((step) => step.stage === 'prove');
assert.ok(proveStage && 'instruction' in proveStage);
assert.match(proveStage.instruction, /first real model part/);
assert.match(proveStage.instruction, /not completion or quality proof/);
assert.doesNotMatch(proveStage.instruction, /productionReady/);
const authorStage = manifest.workflow.find((step) => step.stage === 'author');
assert.ok(authorStage && 'instruction' in authorStage);
assert.match(authorStage.instruction, /command schemas in this manifest/);
assert.match(authorStage.instruction, /coarse-to-fine/);
assert.match(authorStage.instruction, /locked body-plan silhouette/);
assert.match(manifest.pageApi.inspect.command, /inspect\(\{kind:"command"/);
assert.match(manifest.pageApi.run.call, /await window\.ashfox\.run/);
const produceStage = manifest.workflow.find((step) => step.stage === 'produce');
assert.ok(produceStage && 'instruction' in produceStage);
assert.match(produceStage.instruction, /same operation ID/);
const deliverStage = manifest.workflow.find((step) => step.stage === 'deliver');
assert.ok(deliverStage && 'instruction' in deliverStage);
assert.match(deliverStage.instruction, /Activate downloadArtifact/);
assert.equal(manifest.delivery.requestedPath, 'workspace-relative directory');
assert.equal(manifest.delivery.defaultDirectory, 'artifacts/');
assert.equal(manifest.delivery.owner, 'agent host');
assert.equal(manifest.delivery.steps.length, 3);
assert.equal(
  new Set(manifest.delivery.steps).size,
  manifest.delivery.steps.length,
  'delivery steps must not repeat'
);
const deliveryContract = [
  ...manifest.delivery.steps,
  manifest.delivery.fallback
].join(' ').toLowerCase();
assert.match(deliveryContract, /active workspace/);
assert.match(deliveryContract, /persistent artifact anchor/);
assert.match(deliveryContract, /never rely on auto-download/);
assert.match(deliveryContract, /never copy its bytes through model context/);
assert.match(deliveryContract, /verify the file exists/);
assert.match(deliveryContract, /actual workspace-relative path/);
assert.match(deliveryContract, /last completed boundary exactly/);
assert.match(deliveryContract, /never claim a workspace save/);
assert.ok(manifest.rules.length <= 10);
for (const rule of manifest.rules) {
  assert.ok(rule.length <= 180, 'manual rules must stay focused');
}
const serializedManifest = JSON.stringify(manifest);
for (const removedCommand of [
  'textures.preview.set',
  'textures.raster.set',
  'textures.uvAtlas.generate'
]) {
  assert.ok(
    !serializedManifest.includes(removedCommand),
    `the manifest must not retain ${removedCommand}`
  );
}

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
      commandSchema: {
        kind: string;
        name: string;
      };
    };
    counts: {
      nodes: number;
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
    commands: readonly string[];
  };
  assert.equal(data.protocol.workbench, manifest.workbench);
  assert.equal(data.protocol.manifest, manifest.href);
  assert.deepEqual(data.protocol.commandSchema, {
    kind: 'command',
    name: '<commands entry>'
  });
  assert.ok(data.commands.includes('scene.cubes.create'));
  assert.ok(data.commands.includes('scene.cubes.geometry.update'));
  assert.ok(data.commands.includes('scene.nodes.rename'));
  assert.ok(data.commands.includes('scene.nodes.delete'));
  assert.ok(data.commands.includes('textures.sync'));
  assert.equal(data.counts.nodes, 3);
  assert.equal(data.counts.bones, 1);
  assert.equal(data.counts.cubes, 1);
  assert.equal(data.counts.visibleCubes, 1);
  assert.equal(data.counts.meshes, 0);
  assert.equal(data.counts.locators, 1);
  assert.equal(data.counts.enabledVisibleFaces, 6);
  assert.equal(data.counts.texturedVisibleFaces, 6);
  assert.equal(data.counts.untexturedVisibleFaces, 0);
  assert.equal(data.counts.textures, 1);
  assert.equal(data.counts.clips, 1);
  assert.equal(data.counts.channels, 1);
  assert.equal(data.counts.triggers, 0);
  assert.equal(data.counts.idleClips, 1);
  assert.equal(data.counts.idleChannels, 1);
  assert.deepEqual(
    data.commands,
    listCommandDefinitions().map((definition) => definition.name),
    'command discovery must not depend on the visible selection'
  );
}

const hiddenRootProject = structuredClone(document);
(
  hiddenRootProject.scene.nodes['bone-root'] as {
    visible: boolean;
  }
).visible = false;
const hiddenRootResult = inspectProject(
  hiddenRootProject,
  null,
  validateProjectDocument(hiddenRootProject)
);
assert.equal(hiddenRootResult.ok, true);
if (hiddenRootResult.ok) {
  assert.equal(
    (
      hiddenRootResult.data as {
        counts: {
          visibleCubes: number;
          enabledVisibleFaces: number;
        };
      }
    ).counts.visibleCubes,
    0,
    'visibility counts must exclude cubes hidden by their hierarchy'
  );
  assert.equal(
    (
      hiddenRootResult.data as {
        counts: { enabledVisibleFaces: number };
      }
    ).counts.enabledVisibleFaces,
    0
  );
}

const untexturedGecko = structuredClone(createGeckoLib5Project());
const untexturedCube = untexturedGecko.scene.nodes['cube-body'];
assert.equal(untexturedCube.kind, 'cube');
if (untexturedCube.kind !== 'cube') {
  throw new Error('GeckoLib fixture cube missing');
}
for (const face of Object.values(untexturedCube.faces)) {
  (face as { textureId: null }).textureId = null;
}
(untexturedGecko as {
  textures: Record<string, never>;
}).textures = {};
const readiness = inspectProject(
  untexturedGecko,
  null,
  validateProjectDocument(untexturedGecko),
  { kind: 'target' }
);
assert.equal(readiness.ok, true);
if (readiness.ok) {
  const data = readiness.data as {
    valid: boolean;
    productionReady: boolean;
    counts: {
      warnings: number;
      textures: number;
    };
    firstReadinessFinding: {
      code: string;
    };
  };
  assert.equal(data.valid, true);
  assert.equal(data.productionReady, false);
  assert.equal(data.counts.warnings, 1);
  assert.equal(data.counts.textures, 0);
  assert.equal(
    data.firstReadinessFinding.code,
    'format.texture_missing'
  );
}

const untexturedCoverage = inspectProject(
  untexturedGecko,
  null,
  validateProjectDocument(untexturedGecko)
);
assert.equal(untexturedCoverage.ok, true);
if (untexturedCoverage.ok) {
  const counts = (
    untexturedCoverage.data as {
      counts: {
        enabledVisibleFaces: number;
        texturedVisibleFaces: number;
        untexturedVisibleFaces: number;
      };
    }
  ).counts;
  assert.equal(counts.enabledVisibleFaces, 6);
  assert.equal(counts.texturedVisibleFaces, 0);
  assert.equal(counts.untexturedVisibleFaces, 6);
}

const unselectedResult = inspectProject(
  document,
  null,
  validateProjectDocument(document)
);
assert.equal(unselectedResult.ok, true);
if (result.ok && unselectedResult.ok) {
  assert.deepEqual(
    (unselectedResult.data as { commands: readonly string[] }).commands,
    (result.data as { commands: readonly string[] }).commands
  );
}
