import assert from 'node:assert/strict';

import type {
  CommandBatch,
  ValidationReport
} from '@ashfox/engine-core';
import { createProjectDocument } from '@ashfox/engine-core';

import { AgentCommandPort } from '../../src/features/agent/AgentCommandPort';
import { inspectProject } from '../../src/features/agent/inspect';
import {
  INTENT_PROGRAM_INSPECT_SOURCE_MAX_LENGTH
} from '../../src/features/agent/parseInspectRequest';
import type {
  InspectRequest,
  IntentProgramInspectData
} from '../../src/features/agent/types';

const document = createProjectDocument({
  id: 'agent-intent-inspect',
  name: 'Agent lint',
  revision: 'revision-lint',
  createdAt: '2026-08-09T00:00:00.000Z'
});
const report: ValidationReport = { valid: true, findings: [] };
let mutationCalls = 0;
const port = new AgentCommandPort({
  inspect: (request) =>
    inspectProject(document, null, report, request),
  currentProjectId: () => document.id,
  currentRevision: () => document.revision,
  submit: async (_batch: CommandBatch) => {
    mutationCalls += 1;
    throw new Error('inspect must not submit a command');
  }
});

const validSource = [
  'metadata {',
  '  name "Lint walker"',
  '  track essential',
  '  domain constructed',
  '}',
  'model {',
  '  orientation forward north',
  '  symmetry bilateral',
  '  support feet contacts legs',
  '  body {',
  '    core torso',
  '    limb legs paired parent torso anchor sides growth down lane center',
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
].join('\n');

const valid = port.inspect({
  kind: 'intent-program',
  source: validSource
});
assert.equal(valid.ok, true);
if (!valid.ok) throw new Error('valid source lint must succeed');
const validData = valid.data as IntentProgramInspectData;
assert.equal(validData.kind, 'intent-program');
assert.equal(validData.valid, true);
assert.deepEqual(validData.diagnostics, []);

const invalid = port.inspect({
  kind: 'intent-program',
  source: [
    'metadata {',
    '  name "Broken walker"',
    '  track essential',
    '  domain constructed',
    '}',
    'model {',
    '  orientation forward north',
    '  symmetry bilateral',
    '  support feet contacts missing',
    '  body {',
    '    core torso',
    '    mass head single parent missing anchor front growth forward lane center',
    '  }',
    '  face {',
    '    none',
    '  }',
    '}',
    'animation {',
    '  idle still target missing',
    '}',
    'appearance {',
    '  palette metal',
    '  texture brushed scale medium density sparse contrast subtle',
    '  seed auto',
    '}'
  ].join('\n')
});
assert.equal(invalid.ok, true);
if (!invalid.ok) throw new Error('invalid source returns lint data');
const invalidData = invalid.data as IntentProgramInspectData;
assert.equal(invalidData.valid, false);
assert.ok(invalidData.diagnostics.length > 1);
assert.ok(invalidData.diagnostics.every((diagnostic) =>
  diagnostic.path === 'source' && diagnostic.span !== undefined
));
assert.deepEqual(
  invalidData.diagnostics.map((diagnostic) => diagnostic.span?.start.line),
  [9, 12, 19],
  'diagnostics retain spans and are presented in source order'
);

const unknown = port.inspect({
  kind: 'intent-program',
  source: validSource,
  extra: true
} as InspectRequest);
assert.equal(unknown.ok, false);
if (unknown.ok) throw new Error('unknown inspect key must be rejected');
assert.equal(unknown.error.code, 'invalid_request');
assert.equal(unknown.error.path, 'extra');

const oversized = port.inspect({
  kind: 'intent-program',
  source: 'x'.repeat(INTENT_PROGRAM_INSPECT_SOURCE_MAX_LENGTH + 1)
});
assert.equal(oversized.ok, false);
if (oversized.ok) throw new Error('oversize source must be rejected');
assert.equal(oversized.error.code, 'invalid_request');
assert.equal(oversized.error.path, 'source');
assert.equal(mutationCalls, 0, 'inspect surface never submits mutations');
