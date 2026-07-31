import {
  createProjectFromInput,
  type ProjectCreateInput,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../../application/projectIdentity';

export type NewProjectInput = Omit<
  ProjectCreateInput,
  'id' | 'createdAt'
>;

export interface NewProjectIdentity {
  id: string;
  createdAt: string;
}

export const createProjectOperation = (
  input: NewProjectInput,
  identity: NewProjectIdentity
): ProjectCommandOperation => ({
  name: 'project.create',
  payload: {
    ...input,
    ...identity
  }
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
