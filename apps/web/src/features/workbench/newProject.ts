import {
  createProjectFromInput,
  type ProjectCreateInput,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../../application/projectIdentity';

export type NewProjectInput = ProjectCreateInput;

export const createProjectOperation = (
  input: NewProjectInput
): ProjectCommandOperation => ({
  name: 'project.create',
  payload: input
});

export const createBlankWorkbenchProject = (
  createdAt: string
): ProjectDocument =>
  createProjectFromInput(
    {
      id: WORKBENCH_PLACEHOLDER_PROJECT_ID,
      name: 'Untitled project',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'untitled_project',
      createdAt
    },
    'local-0001'
  );
