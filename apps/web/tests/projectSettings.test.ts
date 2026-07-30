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
    name: 'Copper truck'
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
    name: project.name
  }),
  [],
  'unchanged project settings must not create a receipt'
);
