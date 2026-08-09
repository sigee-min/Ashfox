import assert from 'node:assert/strict';

import { validateIntentProgramInput } from '../../src/compiler/program/input';
import { INTENT_PROGRAM_INPUT_CORE_POLICY } from '../../src/compiler/program/input/body';
import { parseIntentProgram } from '../../src/project/program';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from '../../src/project/program/language';
import type { IntentProgramIr } from '../../src/project/program/types';
import { intentProgramSource } from './source';

const source = intentProgramSource({
  name: 'Input Stage Fixture',
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'base', contacts: ['chassis'] },
  body: [
    { id: 'chassis', kind: 'core', cardinality: 'single' },
    {
      id: 'payload', kind: 'mass', cardinality: 'single', parent: 'chassis',
      anchor: 'front', growth: 'forward', lane: 'center'
    }
  ],
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
const parsed = parseIntentProgram(source);
assert.ok(parsed.ir);
assert.deepEqual(parsed.diagnostics, []);
assert.equal(
  INTENT_PROGRAM_INPUT_CORE_POLICY,
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.invariants.body.core,
  'the compiler input boundary consumes the exact core policy authority'
);

const pairedCore = {
  ...parsed.ir,
  body: parsed.ir.body.map((module) =>
    module.kind === INTENT_PROGRAM_INPUT_CORE_POLICY.kind
      ? { ...module, cardinality: 'paired' as const }
      : module
  )
} as IntentProgramIr;
const pairedCoreDiagnostics = validateIntentProgramInput(
  pairedCore, parsed.sourceMap
);
assert.equal(
  pairedCoreDiagnostics.some((diagnostic) =>
    diagnostic.code === 'intent-program.invalid-normalized-module-cardinality'
  ),
  true,
  'the direct IR boundary enforces the shared core cardinality policy'
);

const program = {
  ...parsed.ir,
  body: parsed.ir.body.map((module) =>
    module.kind !== 'core' && module.id === 'payload'
    ? { ...module, parent: 'missing' }
    : module
  ),
  support: { kind: 'base' as const, contacts: ['missing'] as const }
};
const snapshot = JSON.stringify(program);
const diagnostics = validateIntentProgramInput(program, parsed.sourceMap);
const repeated = validateIntentProgramInput(program, parsed.sourceMap);

assert.deepEqual(repeated, diagnostics, 'input validation is deterministic');
assert.equal(JSON.stringify(program), snapshot, 'input validation does not mutate input');
assert.equal(Object.isFrozen(diagnostics), true);
assert.deepEqual(
  diagnostics.map((diagnostic) => diagnostic.code),
  [
    'intent.unknown_body_parent',
    'intent.unknown_support_contact'
  ],
  'resolver diagnostics preserve deterministic semantic-stage order'
);
assert.throws(() => {
  Reflect.apply(Array.prototype.push, diagnostics, [diagnostics[0]]);
}, TypeError, 'callers cannot append outside either validation stage');
