import assert from 'node:assert/strict';

import {
  EXPORT_COMPATIBILITY_REGISTRY,
  EXPORT_PRESETS,
  MINECRAFT_GAME_VERSIONS,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  animationSupportForFormatProfile,
  createProjectFromInput,
  evaluateProductionReadiness,
  executeAgentCommandBatch,
  executeSystemCommandBatch,
  exportCompatibilityFor,
  exportCompatibilityOptions,
  exportPresetForFormatProfile,
  formatProfileForExport,
  gameVersionForFormatProfile,
  getCommandDefinition,
  isExportModelPathValid,
  isExportNamespaceValid,
  normalizeExportModelPath,
  validateProjectDocument,
  type CommandBatch,
  type ProjectDocument
} from '../src';
import {
  createBedrockProject,
  createGltfProject,
  createJavaProject
} from './helpers';

assert.equal(PROJECT_DOCUMENT_SCHEMA_VERSION, 1);
assert.deepEqual(EXPORT_PRESETS, [
  'geckolib5',
  'java_block',
  'bedrock',
  'glb',
  'gltf'
]);
assert.deepEqual(MINECRAFT_GAME_VERSIONS, [
  '1.21.5',
  '1.21.11',
  '26.1',
  '26.2',
  '1.21.130',
  '1.26.0',
  '1.26.30'
]);
assert.deepEqual(
  exportCompatibilityOptions(),
  EXPORT_COMPATIBILITY_REGISTRY.map((entry) => ({
    target: entry.target,
    label: entry.label,
    gameVersion: entry.gameVersion,
    gameVersionLabel: entry.gameVersionLabel,
    isDefaultVersion: entry.isDefaultVersion,
    animationSupport: entry.animationSupport
  }))
);

for (const target of EXPORT_PRESETS) {
  assert.equal(
    exportCompatibilityOptions(target).filter(
      (option) => option.isDefaultVersion
    ).length,
    1,
    `${target} must have exactly one default compatibility entry`
  );
}
const compatibilityPairs = EXPORT_COMPATIBILITY_REGISTRY.map(
  ({ target, gameVersion }) => `${target}:${gameVersion ?? '-'}`
);
assert.equal(
  new Set(compatibilityPairs).size,
  compatibilityPairs.length,
  'each target and gameVersion pair must be unique'
);

assert.equal(
  exportCompatibilityFor('geckolib5')?.gameVersion,
  '26.1'
);
assert.equal(
  exportCompatibilityFor('java_block')?.gameVersion,
  '26.2'
);
assert.equal(
  exportCompatibilityFor('bedrock')?.gameVersion,
  '1.26.30'
);
assert.equal(exportCompatibilityFor('glb')?.gameVersion, null);
assert.equal(
  exportCompatibilityFor('java_block', '1.21.5')
    ?.profile.resourcePackFormat,
  55
);
assert.equal(
  exportCompatibilityFor('java_block', '1.21.11')
    ?.profile.resourcePackFormat,
  75
);
assert.equal(
  exportCompatibilityFor('java_block', '26.2')
    ?.profile.resourcePackFormat,
  88
);
assert.equal(
  exportCompatibilityFor('java_block', '26.1')
    ?.profile.resourcePackFormat,
  84
);
assert.equal(
  exportCompatibilityFor('geckolib5', '26.1')
    ?.profile.minecraftVersion,
  '26.1'
);
assert.equal(
  exportCompatibilityFor('bedrock', '1.21.130')
    ?.profile.geometryFormatVersion,
  '1.21.0'
);
assert.equal(
  exportCompatibilityFor('bedrock', '1.21.5'),
  null
);
assert.equal(
  normalizeExportModelPath(
    'java_block',
    'Vehicles/Copper Truck'
  ),
  'vehicles/copper_truck'
);
assert.equal(
  normalizeExportModelPath('glb', 'Vehicles/Copper Truck'),
  'Vehicles/Copper Truck'
);
assert.equal(isExportNamespaceValid('java_block', 'ashfox.mod'), true);
assert.equal(isExportNamespaceValid('java_block', 'Ashfox Mod'), false);
assert.equal(
  isExportModelPathValid('bedrock', 'vehicles/copper_truck'),
  true
);
assert.equal(
  isExportModelPathValid('bedrock', '../copper_truck.json'),
  false
);
assert.equal(
  isExportModelPathValid('glb', 'Vehicles/Copper Truck'),
  false
);

const javaProfile = formatProfileForExport(
  'java_block',
  '1.21.5',
  'ashfox',
  'compatibility/test'
);
assert.ok(javaProfile);
assert.equal(javaProfile.id, 'minecraft.java_block');
if (javaProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block profile.');
}
assert.equal(javaProfile.minecraftVersion, '1.21.5');
assert.equal(javaProfile.resourcePackFormat, 55);
assert.equal(exportPresetForFormatProfile(javaProfile), 'java_block');
assert.equal(gameVersionForFormatProfile(javaProfile), '1.21.5');
assert.equal(animationSupportForFormatProfile(javaProfile), 'none');

const glbProfile = formatProfileForExport(
  'glb',
  undefined,
  'ignored',
  'compatibility_test'
);
assert.ok(glbProfile);
assert.equal(glbProfile.id, 'gltf.2');
assert.equal(exportPresetForFormatProfile(glbProfile), 'glb');
assert.equal(gameVersionForFormatProfile(glbProfile), null);
assert.equal(animationSupportForFormatProfile(glbProfile), 'scene');

const createDefinition = getCommandDefinition('project.create');
const targetDefinition = getCommandDefinition('project.target.set');
assert.ok(createDefinition);
assert.ok(targetDefinition);
assert.equal(createDefinition.validate({ name: 'Default GLB' }), null);
assert.equal(
  createDefinition.validate({
    name: 'Java asset',
    target: 'java_block',
    gameVersion: '1.21.5'
  }),
  null
);
assert.equal(
  targetDefinition.validate({
    target: 'bedrock',
    gameVersion: '1.21.130'
  }),
  null
);
assert.ok(
  createDefinition.validate({
    name: 'Free string',
    target: 'java_block',
    gameVersion: 'latest'
  })
);
assert.ok(
  createDefinition.validate({
    name: 'Wrong pair',
    target: 'java_block',
    gameVersion: '1.26.0'
  })
);
assert.ok(
  targetDefinition.validate({
    target: 'glb',
    gameVersion: '1.21.11'
  })
);

const base = createProjectFromInput(
  {
    id: 'project-export-compatibility',
    name: 'Export compatibility',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'export_compatibility',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'local-0001'
);

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: CommandBatch['operations']
): ProjectDocument => {
  const result = executeAgentCommandBatch(
    document,
    {
      batchId,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations
    }
  );
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} ` +
      `at ${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const createdJava = execute(base, 'create-java-1215', [{
  name: 'project.create',
  payload: {
    name: 'Java compatibility',
    target: 'java_block',
    gameVersion: '1.21.5'
  }
}]);
assert.equal(createdJava.formatProfile.id, 'minecraft.java_block');
if (createdJava.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
assert.equal(createdJava.formatProfile.minecraftVersion, '1.21.5');
assert.equal(createdJava.formatProfile.resourcePackFormat, 55);

const defaultJava = execute(base, 'target-java-default', [{
  name: 'project.target.set',
  payload: { target: 'java_block' }
}]);
assert.equal(defaultJava.formatProfile.id, 'minecraft.java_block');
if (defaultJava.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
assert.equal(defaultJava.formatProfile.minecraftVersion, '26.2');
assert.equal(defaultJava.formatProfile.resourcePackFormat, 88);

const defaultGecko = execute(base, 'target-gecko-default', [{
  name: 'project.target.set',
  payload: { target: 'geckolib5' }
}]);
assert.equal(
  defaultGecko.formatProfile.id,
  'minecraft.java.geckolib5'
);
if (
  defaultGecko.formatProfile.id !==
  'minecraft.java.geckolib5'
) {
  throw new Error('Expected a GeckoLib 5 project.');
}
assert.equal(defaultGecko.formatProfile.minecraftVersion, '26.1');

const defaultBedrock = execute(base, 'target-bedrock-default', [{
  name: 'project.target.set',
  payload: { target: 'bedrock' }
}]);
assert.equal(defaultBedrock.formatProfile.id, 'minecraft.bedrock');
if (defaultBedrock.formatProfile.id !== 'minecraft.bedrock') {
  throw new Error('Expected a Bedrock project.');
}
assert.equal(defaultBedrock.formatProfile.minecraftVersion, '1.26.30');
assert.equal(defaultBedrock.formatProfile.geometryFormatVersion, '1.21.0');

const explicitBedrock = execute(base, 'target-bedrock-121130', [{
  name: 'project.target.set',
  payload: {
    target: 'bedrock',
    gameVersion: '1.21.130'
  }
}]);
assert.equal(explicitBedrock.formatProfile.id, 'minecraft.bedrock');
if (explicitBedrock.formatProfile.id !== 'minecraft.bedrock') {
  throw new Error('Expected a Bedrock project.');
}
assert.equal(explicitBedrock.formatProfile.minecraftVersion, '1.21.130');
assert.equal(explicitBedrock.formatProfile.geometryFormatVersion, '1.21.0');

const changedVersion = execute(
  explicitBedrock,
  'target-bedrock-1260',
  [{
    name: 'project.target.set',
    payload: {
      target: 'bedrock',
      gameVersion: '1.26.0'
    }
  }]
);
assert.equal(changedVersion.formatProfile.id, 'minecraft.bedrock');
if (changedVersion.formatProfile.id !== 'minecraft.bedrock') {
  throw new Error('Expected a Bedrock project.');
}
assert.equal(changedVersion.formatProfile.minecraftVersion, '1.26.0');

const javaPreferences = structuredClone(createJavaProject());
if (javaPreferences.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
javaPreferences.formatProfile.parent = 'minecraft:block/cube_all';
const changedJavaVersion = execute(
  javaPreferences,
  'target-java-preserve-preferences',
  [{
    name: 'project.target.set',
    payload: {
      target: 'java_block',
      gameVersion: '26.2'
    }
  }]
);
assert.equal(changedJavaVersion.formatProfile.id, 'minecraft.java_block');
if (changedJavaVersion.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
assert.equal(changedJavaVersion.formatProfile.parent, 'minecraft:block/cube_all');
assert.equal(changedJavaVersion.formatProfile.ambientOcclusion, false);
assert.equal(changedJavaVersion.formatProfile.guiLight, 'front');

const relocatedJavaResult = executeSystemCommandBatch(
  changedJavaVersion,
  {
    batchId: 'resource-java-preserve-version',
    baseProjectId: changedJavaVersion.id,
    baseRevision: changedJavaVersion.revision,
    operations: [{
    name: 'project.resource.set',
    payload: {
      namespace: 'ashfox',
      modelPath: 'compatibility/relocated'
    }
    }]
  }
);
assert.equal(relocatedJavaResult.ok, true);
if (!relocatedJavaResult.ok) {
  throw new Error(relocatedJavaResult.error.message);
}
const relocatedJava = relocatedJavaResult.document;
assert.equal(relocatedJava.formatProfile.id, 'minecraft.java_block');
if (relocatedJava.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
assert.equal(relocatedJava.formatProfile.minecraftVersion, '26.2');
assert.equal(relocatedJava.formatProfile.resourcePackFormat, 88);
assert.equal(relocatedJava.formatProfile.parent, 'minecraft:block/cube_all');

const bedrockPreferences = createBedrockProject();
const changedBedrockVersion = execute(
  bedrockPreferences,
  'target-bedrock-preserve-preferences',
  [{
    name: 'project.target.set',
    payload: {
      target: 'bedrock',
      gameVersion: '1.26.30'
    }
  }]
);
assert.equal(changedBedrockVersion.formatProfile.id, 'minecraft.bedrock');
if (changedBedrockVersion.formatProfile.id !== 'minecraft.bedrock') {
  throw new Error('Expected a Bedrock project.');
}
assert.equal(changedBedrockVersion.formatProfile.geometryKind, 'block');
assert.deepEqual(
  changedBedrockVersion.formatProfile.visibleBounds,
  bedrockPreferences.formatProfile.id === 'minecraft.bedrock'
    ? bedrockPreferences.formatProfile.visibleBounds
    : undefined
);

const geckoPreferences = createProjectFromInput(
  {
    id: 'project-gecko-preferences',
    name: 'Gecko preferences',
    target: 'geckolib5',
    gameVersion: '1.21.5',
    namespace: 'ashfox',
    modelPath: 'gecko_preferences',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'local-0001'
);
if (geckoPreferences.formatProfile.id !== 'minecraft.java.geckolib5') {
  throw new Error('Expected a GeckoLib 5 project.');
}
geckoPreferences.formatProfile.assetKind = 'item';
geckoPreferences.formatProfile.visibleBounds = {
  width: 4,
  height: 6,
  offset: [0, 3, 0]
};
const changedGeckoVersion = execute(
  geckoPreferences,
  'target-gecko-preserve-preferences',
  [{
    name: 'project.target.set',
    payload: {
      target: 'geckolib5',
      gameVersion: '26.1'
    }
  }]
);
assert.equal(
  changedGeckoVersion.formatProfile.id,
  'minecraft.java.geckolib5'
);
if (
  changedGeckoVersion.formatProfile.id !==
  'minecraft.java.geckolib5'
) {
  throw new Error('Expected a GeckoLib 5 project.');
}
assert.equal(changedGeckoVersion.formatProfile.assetKind, 'item');
assert.deepEqual(
  changedGeckoVersion.formatProfile.visibleBounds,
  geckoPreferences.formatProfile.visibleBounds
);

const gltfPreferences = createGltfProject('gltf', 'external');
if (gltfPreferences.formatProfile.id !== 'gltf.2') {
  throw new Error('Expected a glTF project.');
}
gltfPreferences.formatProfile.copyright = 'ashfox contributors';
const changedGltfContainer = execute(
  gltfPreferences,
  'target-glb-preserve-preferences',
  [{ name: 'project.target.set', payload: { target: 'glb' } }]
);
assert.equal(changedGltfContainer.formatProfile.id, 'gltf.2');
if (changedGltfContainer.formatProfile.id !== 'gltf.2') {
  throw new Error('Expected a glTF project.');
}
assert.equal(
  changedGltfContainer.formatProfile.copyright,
  'ashfox contributors'
);

const animatedSource = createGltfProject('glb', 'embedded');
const authoredScene = structuredClone(animatedSource.scene);
const authoredAnimations = structuredClone(animatedSource.animations);
const staticResult = executeAgentCommandBatch(
  animatedSource,
  {
    batchId: 'target-java-preserves-authoring',
    baseProjectId: animatedSource.id,
    baseRevision: animatedSource.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'java_block',
        gameVersion: '26.2'
      }
    }]
  }
);
assert.equal(staticResult.ok, true);
if (!staticResult.ok) throw new Error(staticResult.error.message);
assert.deepEqual(staticResult.document.scene, authoredScene);
assert.deepEqual(staticResult.document.animations, authoredAnimations);
assert.deepEqual(staticResult.effects.removedEntityIds, []);
assert.equal(staticResult.effects.invalidated.includes('scene'), false);

const actorResult = executeAgentCommandBatch(
  animatedSource,
  {
    batchId: 'target-bedrock-preserves-authoring',
    baseProjectId: animatedSource.id,
    baseRevision: animatedSource.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'bedrock',
        gameVersion: '1.26.30'
      }
    }]
  }
);
assert.equal(actorResult.ok, true);
if (!actorResult.ok) throw new Error(actorResult.error.message);
assert.deepEqual(actorResult.document.scene, authoredScene);
assert.deepEqual(actorResult.document.animations, authoredAnimations);
assert.equal(
  actorResult.document.animations['clip-idle'].name,
  'Idle',
  'target selection must not rewrite canonical clip names'
);
assert.deepEqual(actorResult.effects.removedEntityIds, []);

const invalidJavaVersion = {
  ...createJavaProject(),
  formatProfile: {
    ...createJavaProject().formatProfile,
    minecraftVersion: 'latest'
  }
} as unknown as ProjectDocument;
assert.ok(
  validateProjectDocument(invalidJavaVersion).findings.some(
    (finding) =>
      finding.path === 'formatProfile.minecraftVersion' &&
      finding.severity === 'error'
  )
);

const mismatchedJavaFormat = {
  ...createJavaProject(),
  formatProfile: {
    ...createJavaProject().formatProfile,
    resourcePackFormat: 55
  }
} as ProjectDocument;
assert.ok(
  validateProjectDocument(mismatchedJavaFormat).findings.some(
    (finding) =>
      finding.path === 'formatProfile.resourcePackFormat' &&
      finding.severity === 'error'
  )
);

const staticJava = createJavaProject();
const staticReadiness = evaluateProductionReadiness(
  staticJava,
  validateProjectDocument(staticJava)
);
assert.equal(
  staticReadiness.findings.some(
    (finding) => finding.code === 'production.idle_missing'
  ),
  false
);

const gltfIdle = createGltfProject().animations['clip-idle'];
const animatedJava: ProjectDocument = {
  ...staticJava,
  animations: {
    [gltfIdle.id]: gltfIdle
  }
};
const animatedReadiness = evaluateProductionReadiness(
  animatedJava,
  validateProjectDocument(animatedJava)
);
assert.equal(
  animatedReadiness.findings.some(
    (finding) =>
      finding.code === 'production.idle_missing' ||
      finding.code === 'production.idle_loop_invalid' ||
      finding.code === 'production.animation_loop_invalid' ||
      finding.code === 'production.animation_preview_unfaithful' ||
      finding.code === 'production.animation_export_unsupported'
  ),
  false,
  'preserved source animations are statically omitted for Java readiness'
);
