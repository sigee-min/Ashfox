import assert from 'node:assert/strict';

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
      modelPath: 'copper_truck'
    }
  }),
  [{
    name: 'project.target.set',
    payload: {
      target: 'bedrock'
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
