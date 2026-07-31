import assert from 'node:assert/strict';

import {
  createProjectFromInput
} from '@ashfox/engine-core';

import {
  createBlankWorkbenchProject
} from '../src/features/workbench/newProject';
import {
  editableProjectTargetFor
} from '../src/application/projectExportTarget';
import {
  createProjectSettingsOperations
} from '../src/features/workbench/projectSettings';

const project = createBlankWorkbenchProject(
  '2026-07-30T00:00:00.000Z'
);
const exportTarget = editableProjectTargetFor(project);
assert.ok(exportTarget);
if (!exportTarget) {
  throw new Error('Expected an editable project target.');
}

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: 'Copper truck',
    surfacePixelDensity: 1,
    exportTarget
  }),
  [
    {
      name: 'project.rename',
      payload: { name: 'Copper truck' }
    }
  ],
  'human project settings must use one canonical command batch'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: project.name,
    surfacePixelDensity: 1,
    exportTarget
  }),
  [],
  'unchanged project settings must not create a receipt'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: project.name,
    surfacePixelDensity: 1,
    exportTarget: null
  }),
  [],
  'an unavailable target editor must leave the target unchanged'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: project.name,
    surfacePixelDensity: 4,
    exportTarget
  }),
  [{
    name: 'textures.density.set',
    payload: { density: 4 }
  }],
  'surface detail must use the canonical density command'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: project.name,
    surfacePixelDensity: 1,
    exportTarget: {
      target: 'bedrock',
      namespace: 'ashfox',
      modelPath: 'copper_truck',
      gameVersion: '1.26.0'
    }
  }),
  [{
    name: 'project.target.set',
    payload: {
      target: 'bedrock',
      gameVersion: '1.26.0'
    }
  }, {
    name: 'project.resource.set',
    payload: {
      namespace: 'ashfox',
      modelPath: 'copper_truck'
    }
  }],
  'target changes must use the canonical target command'
);

const geckoProject = createProjectFromInput(
  {
    id: 'settings-gecko',
    name: 'Versioned creature',
    target: 'geckolib5',
    gameVersion: '1.21.11',
    namespace: 'ashfox',
    modelPath: 'versioned_creature',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'local-0001'
);
const geckoTarget = editableProjectTargetFor(geckoProject);
assert.ok(geckoTarget);
if (!geckoTarget) {
  throw new Error('Expected the GeckoLib target to be editable.');
}
assert.deepEqual(
  createProjectSettingsOperations(geckoProject, {
    name: geckoProject.name,
    surfacePixelDensity: 1,
    exportTarget: {
      ...geckoTarget,
      gameVersion: '1.21.5'
    }
  }),
  [{
    name: 'project.target.set',
    payload: {
      target: 'geckolib5',
      gameVersion: '1.21.5'
    }
  }],
  'changing only the game version must not rewrite resource settings'
);
