import {
  createProjectFromInput,
  executeSystemCommandBatch,
  type ProjectDocument
} from '@ashfox/engine-core';

export const WORKBENCH_PROJECT_ID = 'project-workbench-unit-fixture';

const createUnitFixture = (): ProjectDocument => {
  const empty = createProjectFromInput({
    id: WORKBENCH_PROJECT_ID,
    name: 'Workbench unit fixture',
    target: 'geckolib5',
    gameVersion: '26.1',
    namespace: 'ashfox',
    modelPath: 'workbench_unit_fixture',
    createdAt: '2026-07-29T00:00:00.000Z'
  }, 'local-0001');
  const result = executeSystemCommandBatch(empty, {
    batchId: 'workbench-unit-fixture-content',
    baseProjectId: empty.id,
    baseRevision: empty.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'mass',
          partId: 'fixture.body',
          materialId: 'fixture.material',
          center: [0, 2, 0],
          radii: [2, 2, 2],
          profile: 'hard'
        }],
        materials: [{
          id: 'fixture.material',
          baseColor: '#5E748C'
        }]
      }
    }, {
      name: 'animation.clip.upsert',
      payload: {
        id: 'idle',
        name: 'animation.workbench_fixture.idle',
        durationSeconds: 1,
        fps: 20,
        loop: 'loop'
      }
    }, {
      name: 'animation.channels.upsert',
      payload: {
        clipId: 'idle',
        channels: [{
          id: 'fixture.body.rotation',
          targetNodeId: 'bone:fixture.body',
          property: 'rotation',
          keys: [{
            id: 'fixture.body.rotation.start',
            timeSeconds: 0,
            value: [0, 0, 0]
          }, {
            id: 'fixture.body.rotation.middle',
            timeSeconds: 0.5,
            value: [0, 8, 0]
          }, {
            id: 'fixture.body.rotation.end',
            timeSeconds: 1,
            value: [0, 0, 0]
          }]
        }]
      }
    }]
  });
  if (!result.ok) {
    throw new Error(
      `Could not create the workbench unit fixture: ${result.error.message}`
    );
  }
  return result.document;
};

const UNIT_FIXTURE = createUnitFixture();

export const createWorkbenchProject = (): ProjectDocument =>
  structuredClone(UNIT_FIXTURE);
