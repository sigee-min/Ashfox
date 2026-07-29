import assert from 'node:assert/strict';

import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
import {
  projectExportTargetFor,
  projectUsesExportTarget
} from '../src/features/workbench/presentation/projectExportTarget';

const geckoProject = createWorkbenchProject();
const geckoTarget = projectExportTargetFor(geckoProject);
assert.deepEqual(geckoTarget, {
  target: 'geckolib5',
  namespace: 'ashfox',
  modelPath: 'moonveil_celestial_kirin'
});
assert.equal(projectUsesExportTarget(geckoProject, geckoTarget), true);
assert.equal(
  projectUsesExportTarget(geckoProject, {
    ...geckoTarget,
    namespace: 'other'
  }),
  false
);

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
assert.equal(
  projectUsesExportTarget(glbProject, {
    target: 'gltf',
    namespace: 'ashfox',
    modelPath: 'moonveil_celestial_kirin'
  }),
  false
);
