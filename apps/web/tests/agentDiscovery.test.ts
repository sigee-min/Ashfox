import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  createProjectFromInput,
  executeWebCommandBatch,
  exportCompatibilityOptions,
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
import {
  canonicalFingerprint
} from '../src/application/canonicalFingerprint';

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

assert.doesNotMatch(
  productSource,
  /\bassembly\b/i,
  'web UI and API contracts must not introduce an Assembly surface'
);
for (const relativePath of [
  'application/visualReviewContract.ts',
  'application/visualReviewReceipt.ts',
  'features/agent/presentAgentProject.ts',
  'features/agent/workflow/classifyWorkflowFinding.ts',
  'features/agent/workflow/deriveInspectWorkflow.ts',
  'features/agent/workflow/deriveWorkflowActions.ts'
]) {
  const source = fs.readFileSync(path.join(sourceRoot, relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /getAuthoringRecipe|listAuthoringRecipes|AuthoringRecipe/,
    `${relativePath} must not use discovery recipes as authority`
  );
}

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

assert.equal(manifest.protocol, 'ashfox.agent-command-port');
assert.equal(manifest.workbench, '/workbench/');
assert.equal(manifest.href, '/workbench/agent-manifest.json');
assert.doesNotMatch(JSON.stringify(manifest), /\bassembly\b/i);
assert.doesNotMatch(JSON.stringify(manifest), /\bquadruped\b/i);
assert.match(manifest.description, /structurally authored/);
assert.equal(manifest.pageApi.global, 'ashfox');
assert.equal(manifest.pageApi.presentMethod, 'present');
assert.equal(manifest.pageApi.captureMethod, 'capture');
assert.equal(manifest.pageApi.deliverMethod, 'deliver');
assert.deepEqual(
  manifest.compatibility.options,
  exportCompatibilityOptions()
);
assert.match(manifest.compatibility.contract, /listed target and gameVersion/);
assert.match(manifest.compatibility.contract, /animationSupport/);
assert.match(manifest.compatibility.contract, /canonical source unchanged/);
assert.ok(
  manifest.compatibility.options
    .filter((option) => option.target === 'java_block')
    .every((option) => option.animationSupport === 'none')
);
assert.match(manifest.pageApi.present.call, /window\.ashfox\.present/);
assert.match(manifest.pageApi.present.call, /review:"next"/);
assert.match(manifest.pageApi.present.preview, /review:"preview"/);
assert.match(manifest.pageApi.present.preview, /archetype/);
assert.match(manifest.pageApi.present.preview, /specialists/);
assert.match(manifest.pageApi.present.accept, /review:"accept"/);
assert.match(manifest.pageApi.present.accept, /frameNonce/);
assert.match(manifest.pageApi.present.accept, /checkIds/);
assert.match(manifest.pageApi.present.reject, /review:"reject"/);
assert.match(manifest.pageApi.present.reject, /issues/);
assert.match(manifest.pageApi.present.reject, /failedCheckIds/);
assert.match(manifest.pageApi.present.contract, /delivery ledger/);
assert.match(manifest.pageApi.present.contract, /Stale frames/);
assert.match(manifest.pageApi.capture.result, /window\.ashfox\.capture/);
assert.match(manifest.pageApi.capture.result, /kind:"result"/);
assert.match(manifest.pageApi.capture.animation, /clipId:"idle"/);
assert.match(manifest.pageApi.capture.build, /kind:"build"/);
assert.match(manifest.pageApi.capture.contract, /never raw bytes/);
assert.match(manifest.pageApi.capture.contract, /camera, background, resolution/);
assert.match(manifest.pageApi.deliver.call, /window\.ashfox\.deliver/);
assert.match(manifest.pageApi.deliver.contract, /project profile/);
assert.match(manifest.pageApi.deliver.contract, /game version/);
assert.match(manifest.pageApi.deliver.contract, /adaptationCount/);
assert.match(manifest.pageApi.deliver.contract, /converted,omitted/);
assert.match(manifest.pageApi.deliver.contract, /never mutates/);
assert.match(manifest.pageApi.inspect.command, /kind:"command"/);
assert.match(manifest.pageApi.inspect.catalog, /structuralRole, qualityStage/);
assert.match(manifest.pageApi.inspect.catalog, /Role policies/);
assert.match(manifest.pageApi.run.call, /await window\.ashfox\.run/);
assert.match(manifest.pageApi.run.call, /requestId/);
assert.doesNotMatch(manifest.pageApi.run.call, /baseRevision|batchId/);
assert.match(manifest.setup.manifest, /such as curl/);
assert.match(manifest.setup.manifest, /Do not navigate/);
assert.match(manifest.setup.ready, /What would you like to create/);

assert.match(
  manifest.authoring.project,
  /name,target\?,gameVersion\?,density\?/
);
assert.match(manifest.authoring.coordinates, /one model unit/);
assert.match(manifest.authoring.iconic, /formComposition is diagnostic/);
assert.match(manifest.authoring.iconic, /system-generated surface clusters and noise/);
assert.doesNotMatch(manifest.authoring.iconic, /maximum of 512/);
assert.match(manifest.authoring.iconic, /no style escape hatch/i);
assert.match(manifest.authoring.intent, /explicitly set forward/);
assert.match(manifest.authoring.intent, /references/);
assert.match(manifest.authoring.authority, /project\.authoring\.configure/);
assert.match(manifest.authoring.authority, /composable structural authority/);
assert.match(manifest.authoring.authority, /named body plan/);
assert.match(manifest.authoring.authority, /observed.*requested/);
assert.match(manifest.authoring.authority, /evidenceCriterion/);
assert.match(manifest.authoring.authority, /criterionId/);
assert.match(manifest.authoring.authority, /Specialists.*never topology/);
assert.doesNotMatch(manifest.authoring.structuralAuthority, /v2/i);
assert.match(manifest.authoring.structuralAuthority, /open module graph/);
assert.match(manifest.authoring.structuralAuthority, /parentSlotIds/);
assert.match(manifest.authoring.structuralAuthority, /spatialRelations/);
assert.match(manifest.authoring.structuralAuthority, /facing/);
assert.match(manifest.authoring.structuralAuthority, /pairId/);
assert.match(manifest.authoring.structuralAuthority, /contact/);
assert.deepEqual(
  Object.keys(manifest.authoring.tracks),
  ['contract', 'essential', 'hero', 'coverage']
);
assert.match(manifest.authoring.tracks.contract, /asset-wide representation contracts/);
assert.match(manifest.authoring.tracks.contract, /never low\/high quality/);
assert.match(manifest.authoring.tracks.contract, /hero.*default/);
assert.match(manifest.authoring.tracks.contract, /face rules.*conditional part/);
assert.match(manifest.authoring.tracks.essential, /deliberately distills the whole asset/);
assert.match(manifest.authoring.tracks.essential, /explicit cute, chibi/);
assert.match(manifest.authoring.tracks.essential, /Silhouette and middle structure remain complete/);
assert.match(manifest.authoring.tracks.essential, /Targets may be shared/);
assert.match(manifest.authoring.tracks.hero, /reference fidelity/);
assert.match(manifest.authoring.tracks.hero, /terminal forms/);
assert.match(manifest.authoring.tracks.hero, /semantic material boundaries/);
assert.match(manifest.authoring.tracks.hero, /exclusive feature targets/);
assert.match(manifest.authoring.tracks.hero, /multi-view material review/);
assert.match(manifest.authoring.tracks.coverage, /intent\.features\.N exactly once/);
assert.match(manifest.authoring.tracks.coverage, /slotIds and materialIds/);
assert.match(manifest.authoring.tracks.coverage, /Automatic noise never counts/);
assert.match(manifest.authoring.intent, /every requested or observed cue/);
assert.deepEqual(
  Object.keys(manifest.authoring.face),
  ['contract', 'tracks', 'review']
);
assert.match(manifest.authoring.face.contract, /faceMode explicitly/);
assert.match(manifest.authoring.face.contract, /never infer/);
assert.match(manifest.authoring.face.contract, /biological face uses full/);
assert.match(manifest.authoring.face.contract, /component-exclusive descendant slots/);
assert.match(manifest.authoring.face.tracks, /full essential.*eye.*nasal.*oral/);
assert.match(manifest.authoring.face.tracks, /nose\|muzzle\|beak/);
assert.match(manifest.authoring.face.tracks, /full hero.*reference proportions/);
assert.match(manifest.authoring.face.tracks, /eye-frame orbital\|brow/);
assert.match(manifest.authoring.face.tracks, /open mouth.*mouth-interior/);
assert.match(manifest.authoring.face.review, /native gameplay size/);
assert.match(manifest.authoring.face.review, /lone dot or 1px eye fails/);
assert.match(manifest.authoring.face.review, /non-dot and at least 2x2/);
assert.match(manifest.authoring.face.review, /noise subordinate/);
assert.match(manifest.authoring.face.review, /observed\/requested species evidence/);
assert.deepEqual(
  Object.keys(manifest.authoring.motifs),
  ['core', 'axis', 'articulated', 'span', 'focal-frame', 'accent']
);
assert.match(manifest.authoring.motifs.core, /load-bearing/);
assert.match(manifest.authoring.motifs.axis, /taper/);
assert.match(manifest.authoring.motifs.articulated, /grounded\/free contact/);
assert.match(manifest.authoring.motifs.span, /segments.*plates/);
assert.match(manifest.authoring.motifs['focal-frame'], /before projecting/);
assert.match(manifest.authoring.motifs.accent, /silhouette-changing/);
assert.match(manifest.authoring.recipes, /non-authoritative.*examples/);
assert.match(manifest.authoring.recipes, /never from a recipe/);
assert.match(manifest.authoring.recipes, /claim, slot, and binding/);
assert.match(manifest.pageApi.present.contract, /evidenceCriteria/);
assert.match(manifest.pageApi.present.contract, /criterionId/);
assert.match(manifest.authoring.hierarchy, /rederives model-scale parent contact/);
assert.match(manifest.authoring.hierarchy, /direct semantic cuboids/);
assert.match(manifest.authoring.hierarchy, /implementation detail/);
assert.match(manifest.authoring.materials, /square surface pixels/);
assert.match(manifest.authoring.materials, /clustered automatic noise/);
assert.match(manifest.authoring.materials, /not individual pixels/);
assert.match(manifest.authoring.hierarchy, /parentPartId:null/);
assert.match(manifest.authoring.mutations, /rootPartId,by/);
assert.deepEqual(
  Object.keys(manifest.authoring.parts),
  ['mass', 'segment', 'plate', 'radial', 'feature']
);
assert.match(manifest.animation.command, /animation\.motion\.upsert/);
assert.match(manifest.animation.idle, /static:true/);
assert.match(manifest.animation.idle, /preserve them/);
assert.match(manifest.animation.poses, /rotations/);
assert.match(manifest.animation.spins, /continuous hinge/);
assert.match(manifest.animation.patch, /removePartIds/);
assert.match(manifest.quality.required, /No absolute cuboid count/);
assert.match(manifest.quality.required, /least geometry/);
assert.doesNotMatch(manifest.quality.required, /at most 512/);
assert.match(manifest.quality.required, /may retain canonical clips/);
assert.match(manifest.quality.fidelity, /configured module graph/);
assert.match(manifest.quality.fidelity, /body plan/);
assert.match(manifest.quality.fidelity, /maturity/);
assert.match(manifest.quality.fidelity, /surface glyphs/);
assert.match(manifest.quality.fidelity, /decorative micro-cubes/);
assert.match(manifest.quality.structure, /every requested or observed cue/);
assert.match(
  manifest.quality.structure,
  /explicit geometry, a feature, or a distinct role material/
);
assert.match(
  manifest.quality.structure,
  /Automatic noise never invents semantic material boundaries/
);
assert.deepEqual(
  Object.keys(manifest.quality.gates),
  ['silhouette', 'structure', 'focal', 'surface']
);
assert.match(manifest.quality.gates.silhouette, /Gate 1/);
assert.match(manifest.quality.gates.structure, /Gate 2/);
assert.match(manifest.quality.gates.focal, /Gate 3/);
assert.match(manifest.quality.gates.surface, /Gate 4/);
assert.match(manifest.quality.gates.silhouette, /macro/);
assert.match(manifest.quality.gates.structure, /meso/);
assert.match(manifest.quality.gates.focal, /focal/);
assert.match(manifest.quality.gates.surface, /surface/);
assert.match(manifest.quality.gates.surface, /after the first three gates/);
assert.match(manifest.quality.gates.surface, /required automatic noise/);
assert.match(manifest.authoring.iconic, /identity-bearing middle forms/);
assert.match(manifest.authoring.iconic, /does not mean childlike/);
assert.match(manifest.quality.review, /native gameplay-size/);
assert.match(manifest.quality.review, /reversed feet/);
assert.match(manifest.quality.review, /recognizability or appeal/);
assert.match(manifest.authoring.parts.feature, /exposed mass or segment face/);
assert.match(manifest.authoring.parts.feature, /billboard/);
assert.match(manifest.authoring.parts.feature, /dot.*square.*slit/);
assert.match(manifest.authoring.parts.feature, /nose.*snout/);
assert.match(manifest.authoring.parts.feature, /mouth.*fang.*beak/);
assert.match(manifest.authoring.parts.feature, /outline\/iris\/pupil/);
assert.match(manifest.authoring.parts.feature, /motif:"patch"/);
assert.match(manifest.authoring.parts.feature, /automatic noise/);

const agentDefinitions = listAgentCommandDefinitions();
for (const commandName of ['project.create', 'project.target.set']) {
  const command = agentDefinitions.find(
    (definition) => definition.name === commandName
  );
  assert.ok(command);
  const schema = JSON.stringify(command?.inputSchema);
  assert.match(schema, /gameVersion/);
  for (const option of exportCompatibilityOptions()) {
    if (option.gameVersion !== null) {
      assert.ok(schema.includes(option.gameVersion));
    }
  }
  assert.match(schema, /java_block/);
}
const projectCreateDefinition = agentDefinitions.find(
  (definition) => definition.name === 'project.create'
);
assert.ok(projectCreateDefinition);
for (const variant of (
  projectCreateDefinition?.inputSchema as {
    anyOf: readonly {
      properties: { density: { enum: readonly number[] } };
    }[];
  }
).anyOf) {
  assert.deepEqual(variant.properties.density.enum, [1]);
}
assert.equal(
  canonicalFingerprint({ properties: { b: 2, a: 1 } }),
  canonicalFingerprint({ properties: { a: 1, b: 2 } })
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
    schemaHash: canonicalFingerprint(definition.inputSchema)
  }))
);
assert.ok(
  manifest.commands.every(
    (command) => !Object.hasOwn(command, 'inputSchema')
  )
);
const agentCommandNames = manifest.commands.map((command) => command.name);
for (const command of [
  'project.authoring.configure',
  'model.parts.upsert',
  'model.parts.material',
  'model.parts.delete',
  'animation.motion.upsert'
]) {
  assert.ok(agentCommandNames.includes(command));
}
for (const rawCommand of [
  'scene.bones.create',
  'scene.cubes.create',
  'scene.cubes.geometry.update',
  'scene.nodes.delete',
  'scene.cubes.material',
  'scene.locators.create',
  'scene.locators.update',
  'textures.density.set',
  'animation.clip.upsert',
  'animation.channels.upsert',
  'animation.triggers.upsert'
]) {
  assert.ok(!agentCommandNames.includes(rawCommand));
}

const modelUpsertDefinition = agentDefinitions.find(
  (definition) => definition.name === 'model.parts.upsert'
);
assert.ok(modelUpsertDefinition);
const partVariants = (
  modelUpsertDefinition.inputSchema as {
    properties: {
      parts: {
        items: {
          anyOf: readonly {
            description: string;
            properties: {
              kind: { enum: readonly string[] };
            };
          }[];
        };
      };
    };
  }
).properties.parts.items.anyOf;
for (const [index, kind] of [
  'mass',
  'segment',
  'plate',
  'radial',
  'feature'
].entries()) {
  assert.equal(partVariants[index].properties.kind.enum[0], kind);
  assert.match(
    partVariants[index].description,
    new RegExp(`^${kind[0].toUpperCase()}${kind.slice(1)}\\.`)
  );
}
const materialDefinition = agentDefinitions.find(
  (definition) => definition.name === 'model.parts.material'
);
assert.ok(materialDefinition);
assert.deepEqual(
  (
    materialDefinition.inputSchema as {
      atLeastOne: readonly string[];
    }
  ).atLeastOne,
  ['materialId', 'baseColor']
);

const artifactMarkup = 'data-ashfox-action="artifact.download"';
assertSelectorIsRendered(
  'artifact.downloadSelector',
  manifest.artifact.downloadSelector
);
assert.equal(
  manifest.artifact.downloadSelector,
  `[${artifactMarkup}]`
);
assert.equal(productSource.split(artifactMarkup).length - 1, 1);
assert.equal(
  manifest.domBridge.input.selector,
  `[${agentCommandProtocol.inputAttribute}]`
);
assert.equal(manifest.domBridge.input.property, 'value');
assert.match(manifest.domBridge.input.write, /element\.value/);
assert.match(manifest.domBridge.input.write, /bubbling input event/);
assert.equal(
  Object.hasOwn(manifest.domBridge.input, 'attribute'),
  false,
  'the bridge request must not be documented as attribute input'
);
assert.equal(
  agentCommandProtocol.resultAttribute,
  manifest.domBridge.result.attribute
);
assert.match(manifest.domBridge.request, /requestId/);
assert.match(
  manifest.domBridge.request,
  /inspect\|run\|present\|capture\|deliver/
);
assert.match(manifest.domBridge.response, /same-unique-id/);
assert.deepEqual(
  Object.keys(manifest.domBridge.examples),
  ['inspect', 'run', 'present', 'capture', 'deliver']
);
for (const [method, example] of Object.entries(
  manifest.domBridge.examples
)) {
  const envelope = JSON.parse(example) as {
    requestId: string;
    method: string;
    payload?: unknown;
  };
  assert.equal(envelope.method, method);
  assert.ok(envelope.requestId.length > 0);
  assert.equal(method === 'deliver', envelope.payload === undefined);
  if (method === 'capture') {
    assert.deepEqual(envelope.payload, { kind: 'result' });
  }
}
assert.match(
  html,
  /data-ashfox-agent-manifest="\/workbench\/agent-manifest\.json"/
);
assert.match(html, /type="application\/vnd\.ashfox\.agent\+json"/);
assert.ok(staticFiles.includes('workbench/agent-manifest.json'));

assert.ok(
  Buffer.byteLength(JSON.stringify(manifest)) <= 24_000,
  'the complete machine guide must stay compact'
);
assert.deepEqual(
  manifest.workflow.map((step) => step.stage),
  [
    'start',
    'plan',
    'model',
    'animate',
    'review',
    'deliver'
  ]
);
for (const step of manifest.workflow) {
  assert.ok(JSON.stringify(step).length <= 520);
}
assert.match(manifest.workflow[0].instruction, /project\.create/);
assert.match(manifest.workflow[1].instruction, /project\.authoring\.configure/);
assert.match(
  manifest.workflow[1].instruction,
  /asset-wide track, conditional face contract.*exact feature coverage/
);
assert.match(manifest.workflow[2].instruction, /profile:"block"/);
assert.match(manifest.workflow[2].instruction, /macro, meso, and focal/);
assert.match(
  manifest.workflow[2].instruction,
  /geometry, a feature, or a distinct role material/
);
assert.match(manifest.workflow[3].instruction, /animation\.motion\.upsert/);
assert.match(manifest.workflow[4].instruction, /capture/);
assert.equal(manifest.artifact.requestedPath, 'workspace-relative directory');
assert.equal(manifest.artifact.defaultDirectory, 'artifacts/');
assert.match(manifest.artifact.adaptationReceipt, /adaptationCount/);
assert.match(manifest.artifact.adaptationReceipt, /do not delete/);
assert.match(manifest.artifact.rule, /capture or deliver/);
assert.match(manifest.artifact.rule, /metadata only/);

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
      authoringStyle: string;
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
    formComposition: {
      semanticParts: number;
      compiledCuboids: number;
      cellScaleCuboids: number;
    };
    workflow: {
      nextActions: readonly (
        | {
            kind: 'operation';
            operation: { name: string };
          }
        | {
            kind: 'command';
            name: string;
          }
        | {
            kind: 'present';
          }
        | {
            kind: 'deliver';
          }
      )[];
    };
  };
  assert.equal(data.protocol.workbench, manifest.workbench);
  assert.equal(data.protocol.manifest, manifest.href);
  assert.ok(data.workflow.nextActions.length <= 3);
  for (const action of data.workflow.nextActions) {
    if (action.kind === 'command') {
      assert.ok(
        agentDefinitions.some(
          (definition) => definition.name === action.name
        )
      );
    }
    if (action.kind === 'operation') {
      assert.ok(
        agentDefinitions.some(
          (definition) =>
            definition.name === action.operation.name
        )
      );
    }
  }
  assert.equal(
    data.project.surfacePixelDensity,
    document.settings.surfacePixelDensity
  );
  assert.equal(data.project.authoringStyle, 'iconic-pixel');
  assert.deepEqual(data.formComposition, {
    semanticParts: 0,
    compiledCuboids: 0,
    cellScaleCuboids: 0
  });
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
    idleClips: 0,
    idleChannels: 0
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
    canonicalFingerprint(
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
const authoredModel = executeWebCommandBatch(
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
  }
);
if (!authoredModel.ok) {
  throw new Error(
    `Exact inspect fixture could not be authored: ${JSON.stringify(authoredModel)}`
  );
}
assert.equal(authoredModel.ok, true);
const compatibilityInspect = inspectProject(
  authoredModel.document,
  null,
  validateProjectDocument(authoredModel.document),
  { kind: 'target' }
);
assert.equal(compatibilityInspect.ok, true);
if (compatibilityInspect.ok) {
  const compatibility = compatibilityInspect.data as {
    target: string;
    gameVersion: string | null;
    animationSupport: string | null;
    supportedGameVersions: readonly {
      version: string;
      isDefaultVersion: boolean;
    }[];
  };
  assert.equal(compatibility.target, 'geckolib5');
  assert.equal(compatibility.gameVersion, '26.1');
  assert.equal(compatibility.animationSupport, 'actor');
  assert.deepEqual(
    compatibility.supportedGameVersions.map((option) => ({
      version: option.version,
      isDefaultVersion: option.isDefaultVersion
    })),
    [
      { version: '1.21.5', isDefaultVersion: false },
      { version: '1.21.11', isDefaultVersion: false },
      { version: '26.1', isDefaultVersion: true }
    ]
  );
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
const missingPartInspect = inspectProject(
  authoredModel.document,
  null,
  validateProjectDocument(authoredModel.document),
  { kind: 'parts', ids: ['missing.part'] }
);
assert.equal(missingPartInspect.ok, false);
if (!missingPartInspect.ok) {
  assert.equal(missingPartInspect.error.code, 'not_found');
  assert.equal(missingPartInspect.error.path, 'ids[0]');
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
    target: string;
    structurallyValid: boolean;
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
  assert.equal(data.target, 'geckolib5');
  assert.equal(data.structurallyValid, true);
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
  {
    kind: 'clip',
    id: 'clip-idle',
    trackId: 'channel-root-rotation',
    limit: 20
  }
);
assert.equal(boundedClip.ok, true);
if (boundedClip.ok) {
  const data = boundedClip.data as {
    clip: {
      id: string;
      canonical20Fps: boolean;
    };
    page: {
      kind: string;
      items: readonly { keyId: string }[];
      total: number;
      nextCursor: string | null;
    };
  };
  assert.equal(data.clip.id, 'clip-idle');
  assert.equal(data.clip.canonical20Fps, false);
  assert.equal(data.page.kind, 'keys');
  assert.equal(
    data.page.items.length,
    20
  );
  assert.equal(data.page.total, 800);
  assert.ok(data.page.nextCursor);
  const nextKeyPage = inspectProject(
    largeClipDocument,
    null,
    validateProjectDocument(document),
    {
      kind: 'clip',
      id: 'clip-idle',
      trackId: 'channel-root-rotation',
      limit: 20,
      cursor: data.page.nextCursor ?? undefined
    }
  );
  assert.equal(nextKeyPage.ok, true);
  if (nextKeyPage.ok) {
    const nextData = nextKeyPage.data as {
      page: {
        items: readonly { keyId: string }[];
      };
    };
    assert.notEqual(
      nextData.page.items[0]?.keyId,
      data.page.items[0]?.keyId
    );
  }
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
