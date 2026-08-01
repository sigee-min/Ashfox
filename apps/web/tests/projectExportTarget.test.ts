import assert from 'node:assert/strict';

import { createWorkbenchProject } from './fixtures/workbenchProject';
import {
  defaultProjectGameVersionFor,
  isMinecraftExportTarget,
  PROJECT_EXPORT_TARGETS,
  projectGameVersionOptionsFor,
  projectExportTargetFor
} from '../src/application/projectExportTarget';

assert.deepEqual(
  PROJECT_EXPORT_TARGETS.map((option) => option.id),
  ['geckolib5', 'java_block', 'bedrock', 'glb', 'gltf']
);
assert.equal(isMinecraftExportTarget('java_block'), true);
assert.equal(isMinecraftExportTarget('glb'), false);
assert.deepEqual(
  projectGameVersionOptionsFor('java_block').map(
    (option) => option.value
  ),
  ['1.21.5', '1.21.11', '26.1', '26.2']
);
assert.equal(
  defaultProjectGameVersionFor('java_block'),
  '26.2'
);

const geckoProject = createWorkbenchProject();
const geckoTarget = projectExportTargetFor(geckoProject);
assert.deepEqual(geckoTarget, {
  target: 'geckolib5',
  namespace: 'ashfox',
  modelPath: 'workbench_unit_fixture',
  gameVersion: '26.1'
});

const glbProject = {
  ...geckoProject,
  formatProfile: {
    id: 'gltf.2' as const,
    version: '2.0' as const,
    container: 'glb' as const,
    imageStorage: 'embedded' as const,
    modelPath: 'workbench_unit_fixture'
  }
};
assert.deepEqual(projectExportTargetFor(glbProject), {
  target: 'glb',
  namespace: 'ashfox',
  modelPath: 'workbench_unit_fixture',
  gameVersion: null
});

const genericProject = {
  ...geckoProject,
  formatProfile: {
    id: 'ashfox.generic' as const,
    version: '1' as const
  }
};
assert.deepEqual(projectExportTargetFor(genericProject), {
  target: 'ashfox.generic',
  namespace: 'ashfox',
  modelPath: 'workbench_unit_fixture',
  gameVersion: null
});
