import {
  createProjectDocument,
  executeCommandBatch,
  type ProjectCommandOperation,
  type ProjectDocument
} from '@ashfox/engine-core';

import type {
  VisibleExportPreset
} from './presentation/projectExportTarget';

export interface NewProjectInput {
  name: string;
  target: VisibleExportPreset;
  namespace: string;
  modelPath: string;
  textureResolution: number;
}

export interface NewProjectIdentity {
  id: string;
  createdAt: string;
}

export const createNewProjectDocument = (
  input: NewProjectInput,
  identity: NewProjectIdentity
): ProjectDocument => {
  const base = createProjectDocument({
    id: identity.id,
    name: input.name,
    revision: 'local-0001',
    createdAt: identity.createdAt,
    textureResolution: input.textureResolution
  });
  const operations: ProjectCommandOperation[] = [];
  if (input.target === 'geckolib5') {
    operations.push({
      name: 'animation.clip.upsert',
      payload: {
        id: 'animation-rest-pose',
        name: 'Rest pose',
        durationSeconds: 1,
        fps: 20,
        loop: 'loop'
      }
    });
  }
  operations.push({
    name: 'project.target.set',
    payload: {
      target: input.target,
      namespace: input.namespace,
      modelPath: input.modelPath
    }
  });
  const result = executeCommandBatch(base, {
    batchId: `create-project-target:${identity.id}`,
    baseRevision: base.revision,
    operations
  });
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.document;
};

export const BLANK_WORKBENCH_PROJECT_ID = 'project-local-workbench';

export const createBlankWorkbenchProject = (
  createdAt: string
): ProjectDocument =>
  createNewProjectDocument(
    {
      name: 'Untitled project',
      target: 'glb',
      namespace: 'ashfox',
      modelPath: 'untitled_project',
      textureResolution: 64
    },
    {
      id: BLANK_WORKBENCH_PROJECT_ID,
      createdAt
    }
  );
