import assert from 'node:assert/strict';

import { isMinecraftExportTarget, projectTargetVersionFor } from
  '../../src/application/projectExportTarget';

assert.equal(projectTargetVersionFor('geckolib5'), '26.2');
assert.equal(projectTargetVersionFor('java_block'), '26.2');
assert.equal(projectTargetVersionFor('bedrock'), '26.45');
assert.equal(projectTargetVersionFor('glb'), '2.0');
assert.equal(projectTargetVersionFor(null), null);
assert.equal(isMinecraftExportTarget('geckolib5'), true);
assert.equal(isMinecraftExportTarget('java_block'), true);
assert.equal(isMinecraftExportTarget('bedrock'), true);
assert.equal(isMinecraftExportTarget('glb'), false);

console.log('web exports expose one read-only current target authority');
