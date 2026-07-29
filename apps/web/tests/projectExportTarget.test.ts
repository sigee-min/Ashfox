import assert from 'node:assert/strict';

import { createWorkbenchProject } from '../src/features/workbench/sampleProject';
import {
  projectExportTargetFor,
  projectUsesExportTarget
} from '../src/features/workbench/presentation/projectExportTarget';

const glbProject = createWorkbenchProject();
const glbTarget = projectExportTargetFor(glbProject);
assert.deepEqual(glbTarget, {
  target: 'glb',
  namespace: 'ashfox',
  modelPath: 'copper_fox'
});
assert.equal(projectUsesExportTarget(glbProject, glbTarget), true);
assert.equal(
  projectUsesExportTarget(glbProject, {
    ...glbTarget,
    target: 'gltf'
  }),
  false
);

const geckoProject = {
  ...glbProject,
  formatProfile: {
    id: 'minecraft.java.geckolib5' as const,
    version: '5' as const,
    minecraftVersion: '1.21.1',
    geometryFormatVersion: '1.21.0',
    animationFormatVersion: '1.8.0' as const,
    namespace: 'ashfox',
    assetKind: 'entity' as const,
    modelPath: 'golden_fox',
    animationPath: 'golden_fox',
    geometryIdentifier: 'geometry.golden_fox'
  }
};
assert.deepEqual(projectExportTargetFor(geckoProject), {
  target: 'geckolib5',
  namespace: 'ashfox',
  modelPath: 'golden_fox'
});
assert.equal(
  projectUsesExportTarget(geckoProject, {
    target: 'geckolib5',
    namespace: 'other',
    modelPath: 'golden_fox'
  }),
  false
);
