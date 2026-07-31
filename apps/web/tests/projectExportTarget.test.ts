import assert from 'node:assert/strict';

import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
import {
  projectExportTargetFor
} from '../src/application/projectExportTarget';

const geckoProject = createWorkbenchProject();
const geckoTarget = projectExportTargetFor(geckoProject);
assert.deepEqual(geckoTarget, {
  target: 'geckolib5',
  namespace: 'ashfox',
  modelPath: 'moonveil_celestial_kirin'
});

const glbProject = {
  ...geckoProject,
  formatProfile: {
    id: 'gltf.2' as const,
    version: '2.0' as const,
    container: 'glb' as const,
    imageStorage: 'embedded' as const,
    modelPath: 'moonveil_celestial_kirin'
  }
};
assert.deepEqual(projectExportTargetFor(glbProject), {
  target: 'glb',
  namespace: 'ashfox',
  modelPath: 'moonveil_celestial_kirin'
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
  modelPath: 'moonveil_celestial_kirin'
});
