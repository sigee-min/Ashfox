import assert from 'node:assert/strict';

import {
  AGENT_ACCESSIBLE_COMMAND_NAMES,
  commandAllowedForSource,
  executeAgentCommandBatch,
  executeWebCommandBatch,
  getAgentCommandDefinition,
  listAgentCommandDefinitions
} from '../../src/commands';
import { intentProgramReviewDigest } from '../../src/provenance/program';
import { createProjectDocument } from '../../src/project/create';
import { intentProgramSource } from '../program/source';

const document = createProjectDocument({
  id: 'project-agent-authority',
  name: 'Agent authority',
  revision: 'revision-agent-authority',
  createdAt: '2026-08-09T00:00:00.000Z'
});

const authorityWalkerSource = intentProgramSource({
  name: 'Authority walker',
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'feet', contacts: ['legs'] },
  body: [{
    id: 'torso', kind: 'core', cardinality: 'single'
  }, {
    id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
    anchor: 'sides', growth: 'down', lane: 'center'
  }],
  face: { kind: 'none' },
  idle: { mode: 'still' },
  appearance: {
    palette: 'metal',
    texture: {
      kind: 'brushed', scale: 'medium', density: 'sparse', contrast: 'subtle'
    },
    seed: { kind: 'auto' },
    markings: []
  }
});

assert.deepEqual(
  AGENT_ACCESSIBLE_COMMAND_NAMES,
  ['intent.program.compile', 'intent.program.propose'],
  'the Agent owns only the staged source and compilation decision'
);
assert.deepEqual(
  listAgentCommandDefinitions().map((definition) => definition.name),
  AGENT_ACCESSIBLE_COMMAND_NAMES
);
assert.equal(
  getAgentCommandDefinition('intent.program.propose')?.name,
  'intent.program.propose'
);
assert.equal(
  getAgentCommandDefinition('intent.program.compile')?.name,
  'intent.program.compile'
);
for (const forbidden of [
  'project.create',
  'project.rename'
] as const) {
  assert.equal(getAgentCommandDefinition(forbidden), undefined);
  assert.equal(commandAllowedForSource(forbidden, 'agent'), false);
}
assert.equal(
  commandAllowedForSource('intent.program.propose', 'agent'),
  true
);
assert.equal(
  commandAllowedForSource('intent.program.compile', 'agent'),
  true
);
assert.equal(
  commandAllowedForSource('intent.program.propose', 'web'),
  false,
  'human-facing Web commands cannot author Intent Programs'
);
assert.equal(
  commandAllowedForSource('intent.program.compile', 'web'),
  false,
  'human-facing Web commands cannot decide compilation'
);
assert.equal(
  commandAllowedForSource('project.create', 'web'),
  true,
  'the human-facing Web may create a project container'
);
assert.equal(
  commandAllowedForSource('project.rename', 'web'),
  false,
  'the human-facing Web cannot mutate project identity after creation'
);
assert.equal(
  commandAllowedForSource('project.rename', 'system'),
  true,
  'the compatibility command remains available to trusted migrations'
);

const acceptedAgentBatch = executeAgentCommandBatch(document, {
  batchId: 'agent-one-proposal',
  baseProjectId: document.id,
  baseRevision: document.revision,
  operations: [{
    name: 'intent.program.propose',
    payload: {
      source: authorityWalkerSource
    }
  }]
});
if (!acceptedAgentBatch.ok) {
  throw new Error(acceptedAgentBatch.error.message);
}
assert.equal(acceptedAgentBatch.ok, true);
assert.ok(acceptedAgentBatch.document.intentProgramProposal);
const pending = acceptedAgentBatch.document.intentProgramProposal;
if (!pending) throw new Error('Agent proposal must stage a source');
const rejectedHumanCompile = executeWebCommandBatch(
  acceptedAgentBatch.document,
  {
    batchId: 'human-compile-is-forbidden',
    baseProjectId: acceptedAgentBatch.document.id,
    baseRevision: acceptedAgentBatch.document.revision,
    operations: [{
      name: 'intent.program.compile',
      payload: { sourceDigest: intentProgramReviewDigest(pending) }
    }]
  }
);
assert.equal(rejectedHumanCompile.ok, false);
if (rejectedHumanCompile.ok) {
  throw new Error('Web must not decide whether an Intent Program compiles');
}
assert.equal(
  rejectedHumanCompile.error.path,
  'operations[0].name'
);
const compiledAgentBatch = executeAgentCommandBatch(
  acceptedAgentBatch.document,
  {
    batchId: 'agent-one-compile',
    baseProjectId: acceptedAgentBatch.document.id,
    baseRevision: acceptedAgentBatch.document.revision,
    operations: [{
      name: 'intent.program.compile',
      payload: { sourceDigest: intentProgramReviewDigest(pending) }
    }]
  }
);
if (!compiledAgentBatch.ok) {
  throw new Error(compiledAgentBatch.error.message);
}
assert.equal(compiledAgentBatch.ok, true);
assert.ok(compiledAgentBatch.document.intentProgram);
assert.equal(compiledAgentBatch.document.intentProgramProposal, undefined);

const rejectedAgentBatch = executeAgentCommandBatch(document, {
  batchId: 'agent-two-operations',
  baseProjectId: document.id,
  baseRevision: document.revision,
  operations: [
    { name: 'project.rename', payload: { name: 'First' } },
    { name: 'project.rename', payload: { name: 'Second' } }
  ]
});
assert.equal(rejectedAgentBatch.ok, false);
if (rejectedAgentBatch.ok) {
  throw new Error('Agent batch with multiple operations must be rejected');
}
assert.deepEqual(rejectedAgentBatch.error, {
  code: 'invalid_batch',
  message: 'Agent batches must contain exactly one operation.',
  path: 'operations',
  expected: 'exactly one operation'
});

const rejectedWebRename = executeWebCommandBatch(document, {
  batchId: 'web-rename-is-forbidden',
  baseProjectId: document.id,
  baseRevision: document.revision,
  operations: [{ name: 'project.rename', payload: { name: 'First' } }]
});
assert.equal(rejectedWebRename.ok, false);
if (rejectedWebRename.ok) {
  throw new Error('Web must not rename a project after creation');
}
assert.equal(rejectedWebRename.error.path, 'operations[0].name');
