import {
  createProjectFromInput,
  executeAgentCommandBatch,
  executeWebCommandBatch,
  type ProjectDocument
} from '@ashfox/engine-core';

export const WORKBENCH_PROJECT_ID = 'project-workbench-unit-fixture';

const createUnitFixture = (): ProjectDocument => {
  const empty = createProjectFromInput({
    id: WORKBENCH_PROJECT_ID,
    name: 'Workbench unit fixture',
    createdAt: '2026-07-29T00:00:00.000Z'
  }, 'local-0001');
  const source = [
    'asset "Workbench unit fixture"',
    'track essential',
    'domain constructed',
    'frame front north',
    'symmetry bilateral',
    'rest neutral base',
    'body core body',
    'face none',
    'style palette ocean'
  ].join('\n');
  const proposed = executeAgentCommandBatch(empty, {
    batchId: 'workbench-unit-fixture-proposal',
    baseProjectId: empty.id,
    baseRevision: empty.revision,
    operations: [{
      name: 'intent.program.propose',
      payload: { source }
    }]
  });
  if (!proposed.ok || !proposed.document.intentProgramProposal) {
    throw new Error('Could not propose the workbench unit Intent Program.');
  }
  const result = executeWebCommandBatch(proposed.document, {
    batchId: 'workbench-unit-fixture-compile',
    baseProjectId: proposed.document.id,
    baseRevision: proposed.document.revision,
    operations: [{
      name: 'intent.program.compile',
      payload: { hash: proposed.document.intentProgramProposal.hash }
    }]
  });
  if (!result.ok) {
    throw new Error(
      `Could not compile the workbench unit fixture: ${result.error.message}`
    );
  }
  return result.document;
};

const UNIT_FIXTURE = createUnitFixture();

export const createWorkbenchProject = (): ProjectDocument =>
  structuredClone(UNIT_FIXTURE);
