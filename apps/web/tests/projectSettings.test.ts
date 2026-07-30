import assert from 'node:assert/strict';

import {
  createBlankWorkbenchProject
} from '../src/features/workbench/newProject';
import {
  createProjectSettingsOperations
} from '../src/features/workbench/projectSettings';

const project = createBlankWorkbenchProject(
  '2026-07-30T00:00:00.000Z'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: 'Copper truck',
    surfacePixelDensity: 1
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
    surfacePixelDensity: 1
  }),
  [],
  'unchanged project settings must not create a receipt'
);

assert.deepEqual(
  createProjectSettingsOperations(project, {
    name: project.name,
    surfacePixelDensity: 4
  }),
  [{
    name: 'textures.density.set',
    payload: { density: 4 }
  }],
  'surface detail must use the canonical density command'
);
