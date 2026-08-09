import assert from 'node:assert/strict';

import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION,
  createProjectFromInput,
  executeAgentCommandBatch,
  intentProgramReviewDigest,
  type CommandBatch
} from '@ashfox/engine-core';

import { parseRunRequest } from '../../src/features/agent/parseRunRequest';
import { agentManifest } from '../../src/features/agent/agentManifest';
import { AgentPortLifecycle } from '../../src/features/agent/port/AgentPortLifecycle';
import type {
  AgentCommandPortDependencies
} from '../../src/features/agent/port/types';
import { RunRequestController } from '../../src/features/agent/port/RunRequestController';
import {
  deriveWorkflowActions
} from '../../src/features/agent/workflow/actions';

const requestId = 'agent-run-authority-1';
const operation = {
  name: 'intent.program.propose',
  payload: { source: 'complete-source' }
} as const;

const grammar = agentManifest.authoring.program.grammar;
const symmetryRule = INTENT_PROGRAM_LANGUAGE_SPECIFICATION
  .symmetryCompatibility.singleLateralAttachment;
assert.equal(Object.isFrozen(agentManifest.authoring.program.specification), true);
assert.equal(
  Object.isFrozen(agentManifest.authoring.program.specification.identifier),
  true
);
assert.equal(
  agentManifest.authoring.program.specification.statements,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.statements,
  'Agent manifest consumes the engine statement-schema authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.relations,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.relations,
  'Agent manifest consumes the engine relation-matrix authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.surfaceShapes.compatibility,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.surfaceShapes.compatibility,
  'Agent manifest consumes the engine shape-compatibility authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.supportCompatibility,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.supportCompatibility,
  'Agent manifest consumes the engine support-compatibility authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.symmetryCompatibility,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.symmetryCompatibility,
  'Agent manifest consumes the engine symmetry-compatibility authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.appearance.specification,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification,
  'Agent manifest consumes the Surface Appearance authority directly'
);
assert.equal(
  agentManifest.authoring.program.specification.appearance.specification
    .statements.mark.targetReferences,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification.statements
    .mark.targetReferences,
  'Agent manifest preserves target-reference namespace identity'
);
assert.equal(
  agentManifest.authoring.program.specification.appearance.specification
    .markingOverlap,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification
    .markingOverlap,
  'Agent manifest preserves marking-overlap policy identity'
);
assert.equal(
  agentManifest.authoring.program.specification.appearance.specification
    .statements.seed.forms,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification.statements
    .seed.forms,
  'Agent manifest preserves seed-form policy identity'
);
assert.equal(
  Object.isFrozen(
    agentManifest.authoring.program.specification.surfaceShapes.compatibility
      .allowedOffsetsByAxis.transverse
  ),
  true,
  'Published shape compatibility is immutable at every level'
);
assert.equal(
  Object.isFrozen(
    agentManifest.authoring.program.specification.relations.moduleTuples[0]
  ),
  true,
  'Published relation tuples are immutable at every level'
);
assert.equal(
  agentManifest.authoring.program.specification.identifier.pattern,
  '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$',
  'the machine manifest serializes the engine identifier authority'
);
assert.deepEqual(
  agentManifest.authoring.program.specification.rootBlocks,
  ['metadata', 'model', 'animation', 'appearance']
);
assert.equal(
  agentManifest.authoring.program.specification.statements.model.shape.fields
    .axis.enum,
  'surfaceShapes.axis'
);
for (const word of [
  'axis vertical|longitudinal|transverse',
  'span short|medium|long',
  'chord narrow|medium|broad',
  'tip pointed|rounded|flat|flared|forked',
  'offset center|anterior|posterior|dorsal|ventral|medial|distal',
  'edge straight|convex|concave'
]) {
  assert.ok(
    grammar.includes(word),
    `Agent grammar must advertise Surface Shape V1 vocabulary: ${word}`
  );
}
assert.ok(
  grammar.includes('Do not use aliases, coordinates, vertices, cubes'),
  'Agent grammar must keep raw geometry outside the authoring authority'
);
assert.ok(
  grammar.includes('specification.surfaceShapes.compatibility'),
  'Agent grammar must point to the machine-readable shape compatibility table'
);
assert.ok(
  grammar.includes(
    'specification.supportCompatibility.contactRequirementsByKind'
  ) && grammar.includes(
    'specification.supportCompatibility.requiredModuleContacts'
  ),
  'Agent grammar must point to both machine-readable support rules'
);
assert.ok(
  grammar.includes(
    'specification.symmetryCompatibility.singleLateralAttachment'
  ) && grammar.includes(
    `${symmetryRule.whenSymmetry} symmetry, ${symmetryRule.cardinality} ` +
      `${symmetryRule.appliesTo.join('|')} attachments on ` +
      symmetryRule.anchors.join('|')
  ),
  'Agent grammar must derive and point to the lateral symmetry rule'
);
for (const relation of [
  'mass:single:front:forward',
  'limb:paired:sides:down',
  'wheel:paired:sides:down',
  'paired:sides:outward',
  'paired:sides:down'
]) {
  assert.ok(
    grammar.includes(relation),
    `Agent grammar must project the relation authority: ${relation}`
  );
}
assert.ok(
  grammar.includes('body:body:1') &&
    grammar.includes('surface:surfaces:1') &&
    grammar.includes('face:face:0') &&
    grammar.includes('focal:focal:1'),
  'Agent grammar must project target-specific ID cardinality'
);
assert.ok(
  grammar.includes('accepted only for motif band|stripe|bars'),
  'Agent grammar must project the motif-flow condition'
);
assert.ok(
  grammar.includes(
    'specification.appearance.specification.statements.mark.targetReferences'
  ) && grammar.includes(
    'specification.appearance.specification.markingOverlap'
  ),
  'Agent grammar must point to appearance reference and overlap authorities'
);
assert.ok(
  grammar.includes('seed auto|<lower-kebab-case>') && grammar.includes(
    'specification.appearance.specification.statements.seed.forms'
  ),
  'Agent grammar must derive and point to the machine-readable seed forms'
);

const single = parseRunRequest({
  requestId,
  operations: [operation]
});
assert.equal(single.ok, true);
if (!single.ok) throw new Error('single Agent operation must parse');
assert.equal(single.request.operations.length, 1);

const compile = parseRunRequest({
  requestId: 'agent-run-authority-compile',
  operations: [{
    name: 'intent.program.compile',
    payload: { sourceDigest: `sha256:${'a'.repeat(64)}` }
  }]
});
assert.equal(compile.ok, true);

const extra = parseRunRequest({
  requestId,
  operations: [operation, operation]
});
assert.deepEqual(extra, {
  ok: false,
  error: {
    code: 'invalid_batch',
    path: 'operations',
    expected: 'exactly one operation'
  }
});

const forbidden = parseRunRequest({
  requestId,
  operations: [{ name: 'project.rename', payload: { name: 'No' } }]
});
assert.deepEqual(forbidden, {
  ok: false,
  error: {
    code: 'invalid_batch',
    path: 'operations[0]',
    expected: 'registered command operation'
  }
});

const empty = createProjectFromInput({
  id: 'project-agent-autonomous-compile',
  name: 'Agent autonomous compile',
  createdAt: '2026-08-09T00:00:00.000Z'
}, 'local-0001');
const staged = executeAgentCommandBatch(empty, {
  batchId: 'agent-autonomous-stage',
  baseProjectId: empty.id,
  baseRevision: empty.revision,
  operations: [{
    name: 'intent.program.propose',
    payload: {
      source: [
        'metadata {',
        '  name "Autonomous courier"',
        '  track essential',
        '  domain constructed',
        '}',
        'model {',
        '  orientation forward north',
        '  symmetry bilateral',
        '  support base contacts body',
        '  body {',
        '    core body',
        '  }',
        '  face {',
        '    none',
        '  }',
        '}',
        'animation {',
        '  idle still',
        '}',
        'appearance {',
        '  palette metal',
        '  texture brushed scale medium density sparse contrast subtle',
        '  seed auto',
        '}'
      ].join('\n')
    }
  }]
});
assert.equal(staged.ok, true);
if (!staged.ok || !staged.document.intentProgramProposal) {
  throw new Error('Agent must be able to stage a valid source');
}
const compileOperation = {
  name: 'intent.program.compile',
  payload: {
    sourceDigest: intentProgramReviewDigest(
      staged.document.intentProgramProposal
    )
  }
} as const;
assert.deepEqual(
  deriveWorkflowActions(staged.document, 'plan', null, null),
  {
    exactOperation: compileOperation,
    nextActions: [{ kind: 'operation', operation: compileOperation }]
  },
  'a staged proposal routes back to the Agent, never to human confirmation'
);

let submitted: CommandBatch | null = null;
const dependencies: AgentCommandPortDependencies = {
  inspect: () => ({ ok: true, revision: 'revision-1', data: {} }),
  currentProjectId: () => 'project-1',
  currentRevision: () => 'revision-1',
  submit: async (batch) => {
    submitted = batch;
    throw new Error('multi-operation input must not reach submission');
  }
};
const controller = new RunRequestController(
  dependencies,
  new AgentPortLifecycle(dependencies)
);

export const test = (async (): Promise<void> => {
  const result = await controller.run({
    requestId,
    operations: [operation, operation]
  });
  assert.equal(result.ok, false);
  if (result.ok) throw new Error('multi-operation run must fail');
  assert.equal(result.error.code, 'invalid_batch');
  assert.equal(result.error.path, 'operations');
  assert.equal(result.error.expected, 'exactly one operation');
  assert.equal(submitted, null, 'parser rejection must precede execution');
})();
