import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { validateProjectDocument } from '@ashfox/engine-core';

import { createGltfProject } from '../../../packages/engine-core/tests/helpers';
import manifest from '../agent-manifest.json';
import { agentCommandProtocol } from '../src/features/agent/agentCommandProtocol';
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
assert.ok(
  manifest.rules.some((rule) =>
    rule.includes('atlasMode preserve')
  ),
  'the AI workflow must preserve authored texture meaning'
);
for (const [name, selector] of Object.entries(manifest.domActions)) {
  assertSelectorIsRendered(`domActions.${name}`, selector);
}
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
  Buffer.byteLength(JSON.stringify(manifest)) <= 6_144,
  'the complete agent manual must stay concise'
);
assert.deepEqual(
  manifest.workflow.map((step) => step.stage),
  ['start', 'author', 'review', 'produce', 'deliver']
);
for (const step of manifest.workflow) {
  assert.ok(
    JSON.stringify(step).length <= 420,
    `workflow.${step.stage} must stay concise`
  );
}
const authorStage = manifest.workflow.find((step) => step.stage === 'author');
assert.ok(authorStage && 'inspect' in authorStage);
assert.equal(authorStage.inspect, 'window.ashfox.inspect()');
assert.match(authorStage.schema, /inspect\(\{kind:"command"/);
assert.match(authorStage.run, /await window\.ashfox\.run/);
const produceStage = manifest.workflow.find((step) => step.stage === 'produce');
assert.ok(produceStage && 'instruction' in produceStage);
assert.match(produceStage.instruction, /same operation ID/);
assert.match(produceStage.instruction, /no artifact downloads automatically/);
const deliverStage = manifest.workflow.find((step) => step.stage === 'deliver');
assert.ok(deliverStage && 'instruction' in deliverStage);
assert.match(deliverStage.instruction, /Activate downloadArtifact/);
assert.equal(manifest.delivery.requestedPath, 'workspace-relative directory');
assert.equal(manifest.delivery.defaultDirectory, 'artifacts/');
assert.equal(manifest.delivery.owner, 'agent host');
assert.equal(manifest.delivery.steps.length, 3);
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
assert.ok(manifest.rules.length <= 8);
for (const rule of manifest.rules) {
  assert.ok(rule.length <= 140, 'manual rules must stay concise');
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
    commands: readonly string[];
  };
  assert.equal(data.protocol.workbench, manifest.workbench);
  assert.equal(data.protocol.manifest, manifest.href);
  assert.deepEqual(data.protocol.commandSchema, {
    kind: 'command',
    name: '<commands entry>'
  });
  assert.ok(data.commands.includes('scene.cubes.create'));
  assert.ok(data.commands.includes('scene.cubes.uv.fit'));
}
