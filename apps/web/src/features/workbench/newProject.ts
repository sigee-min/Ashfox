import {
  createProjectFromInput,
  type ProjectCreateInput,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

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

export const BLANK_WORKBENCH_PROJECT_ID = 'project-local-workbench';

export const createBlankWorkbenchProject = (
  createdAt: string
): ProjectDocument =>
  createProjectFromInput(
    {
      id: BLANK_WORKBENCH_PROJECT_ID,
      name: 'Untitled project',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'untitled_project',
      createdAt
    },
    'local-0001'
  );
