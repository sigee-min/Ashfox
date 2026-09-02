import assert from 'node:assert/strict';

import { agentManifest } from '../../src/features/agent/agentManifest';

assert.deepEqual(agentManifest.commands.map((entry) => entry.name),
  ['workspace.apply']);
assert.equal(agentManifest.pageApi.inspect.workspace.includes('expectedWorkspaceHash'), true);
assert.equal(agentManifest.pageApi.run.contract.includes('workspace.apply'), true);
assert.equal(agentManifest.compatibility.options.length, 5);
assert.ok(agentManifest.compatibility.options.every((option) =>
  !Reflect.has(option, 'isDefaultVersion')),
'The agent manifest must expose one current option without a default selector.');
