import assert from 'node:assert/strict';

import {
  diagnoseIntentProgramSource,
  intentProgramOutputProjection,
  previewIntentProgram
} from '../../src';
import { compileIntentProgramCommand } from '../../src/commands/program/compile';
import { proposeIntentProgramCommand } from '../../src/commands/program/propose';
import { createProjectDocument } from '../../src/project/create';
import { intentProgramSource } from './source';

const source = (name: string, facing: 'north' | 'east'): string =>
  intentProgramSource({
    name, track: 'essential', domain: 'constructed', forward: facing,
    symmetry: 'bilateral', support: { kind: 'feet', contacts: ['legs'] },
    body: [
      { id: 'torso', kind: 'core', cardinality: 'single' },
      {
        id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'torso',
        anchor: 'sides', growth: 'down', lane: 'center'
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

const seed = createProjectDocument({
  id: 'project-intent-preview',
  name: 'Intent preview',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});

const initialProposal = proposeIntentProgramCommand.apply(
  seed,
  { source: source('Confirmed walker', 'north') }
);
if (!initialProposal.ok) throw new Error(initialProposal.error.message);
assert.equal(initialProposal.ok, true);
const initialPending = initialProposal.value.document.intentProgramProposal;
assert.ok(initialPending);
if (!initialPending) {
  throw new Error('initial proposal must have a v1 receipt');
}
const compiled = compileIntentProgramCommand.apply(
  initialProposal.value.document,
  { sourceDigest: initialPending.receipt.sourceDigest }
);
if (!compiled.ok) throw new Error(compiled.error.message);
assert.equal(compiled.ok, true);
const canonical = compiled.value.document;

const nextProposal = proposeIntentProgramCommand.apply(
  canonical,
  { source: source('Pending walker', 'east') }
);
if (!nextProposal.ok) throw new Error(nextProposal.error.message);
assert.equal(nextProposal.ok, true);
const pending = nextProposal.value.document.intentProgramProposal;
assert.ok(pending);
if (!pending) {
  throw new Error('pending proposal must have a v1 receipt');
}

const canonicalBefore = JSON.stringify(canonical);
const first = previewIntentProgram(canonical, pending);
const second = previewIntentProgram(canonical, pending);
assert.equal(first.ok, true);
assert.equal(second.ok, true);
if (!first.ok || !second.ok) throw new Error('preview must succeed');
assert.equal(
  JSON.stringify(canonical),
  canonicalBefore,
  'preview must not install pending source or mutate canonical state'
);
assert.equal(canonical.intentProgramProposal, undefined);
assert.equal(
  first.preview.outputDigest,
  pending.receipt.outputDigest,
  'preview succeeds only for the reviewed output digest'
);
assert.equal(first.preview.outputDigest, second.preview.outputDigest);
assert.deepEqual(
  intentProgramOutputProjection(first.preview.candidateDocument),
  intentProgramOutputProjection(second.preview.candidateDocument),
  'preview materialization is deterministic'
);
assert.equal(
  first.preview.candidateDocument.intentProgram,
  canonical.intentProgram,
  'preview retains only the existing confirmed authority, never the pending source'
);

const tampered = {
  ...pending,
  receipt: {
    ...pending.receipt,
    outputDigest: `sha256:${'0'.repeat(64)}`
  }
};
const mismatch = previewIntentProgram(canonical, tampered);
assert.equal(mismatch.ok, false);
if (mismatch.ok) throw new Error('digest mismatch must be rejected');
assert.ok(mismatch.diagnostics.some((diagnostic) =>
  diagnostic.code === 'intent-program.preview.output-digest-mismatch' &&
  diagnostic.path === 'receipt.outputDigest'
));
assert.equal(JSON.stringify(canonical), canonicalBefore);

const aggregate = diagnoseIntentProgramSource(source(
  'Broken walker', 'north'
).replace('contacts legs', 'contacts missing')
  .replace('parent torso anchor sides', 'parent missing anchor sides')
  .replace('idle still', 'idle still target missing'));
assert.equal(aggregate.ok, false);
assert.ok(
  aggregate.diagnostics.length > 1,
  'agent diagnostics expose every issue reported by the rejecting compiler stage'
);
