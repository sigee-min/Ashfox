import assert from 'node:assert/strict';

import { createCommandExecutionContext } from '../../src/commands/batch/context';
import { executeCommandBatchPipeline } from '../../src/commands/batch/executePipeline';
import {
  proposeIntentProgramCommand
} from '../../src/commands/program/propose';
import { intentProgramReviewDigest } from '../../src/provenance/program';
import { createProjectDocument } from '../../src/project/create';
import {
  DEFAULT_INTENT_VALIDATION_COMPUTATION,
  type IntentProgramValidationComputation
} from '../../src/validation/project/candidate';
import {
  validateProjectDocumentCandidate
} from '../../src/validation/project/validate';
import { intentProgramSource } from '../program/source';

const source = intentProgramSource({
  name: 'Counted marked walker',
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
      kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
    },
    seed: { kind: 'explicit', value: 'counted-mark' },
    markings: [{
      id: 'crest',
      target: { kind: 'body', id: 'torso' },
      region: 'dorsal',
      placement: 'center',
      motif: 'patch',
      tone: 'accent',
      scale: 'medium',
      density: 'sparse',
      contrast: 'medium'
    }]
  }
});

const seed = createProjectDocument({
  id: 'project-command-attestation',
  name: 'Command attestation',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});
const proposed = proposeIntentProgramCommand.apply(seed, { source });
if (!proposed.ok) throw new Error(proposed.error.message);
const pending = proposed.value.document.intentProgramProposal;
if (!pending) {
  throw new Error('counted compile requires a staged V1 source');
}

let materializeCalls = 0;
let outputDigestCalls = 0;
const computation: IntentProgramValidationComputation = {
  materialize: (document, program) => {
    materializeCalls += 1;
    return DEFAULT_INTENT_VALIDATION_COMPUTATION.materialize(
      document,
      program
    );
  },
  outputDigest: (document) => {
    outputDigestCalls += 1;
    return DEFAULT_INTENT_VALIDATION_COMPUTATION.outputDigest(document);
  }
};
const context = createCommandExecutionContext(computation);
const compiled = executeCommandBatchPipeline(
  proposed.value.document,
  {
    batchId: 'counted-agent-compile',
    baseProjectId: proposed.value.document.id,
    baseRevision: proposed.value.document.revision,
    operations: [{
      name: 'intent.program.compile',
      payload: { sourceDigest: intentProgramReviewDigest(pending) }
    }]
  },
  'agent',
  context
);
if (!compiled.ok) throw new Error(compiled.error.message);
assert.equal(materializeCalls, 1, 'one command must materialize exactly once');
assert.equal(
  outputDigestCalls,
  1,
  'one command must rasterize and compute its output digest exactly once'
);
const confirmed = compiled.document.intentProgram;
if (!confirmed) {
  throw new Error('counted compile must confirm a V1 source');
}
assert.deepEqual(
  confirmed.receipt,
  pending.receipt,
  'ephemeral reuse cannot change persisted receipt bytes'
);
assert.equal(compiled.document.intentProgramProposal, undefined);
assert.equal('validationAttestation' in compiled, false);
assert.equal('validationAttestation' in compiled.document, false);
assert.equal(
  JSON.stringify(compiled.document).includes('canonicalSnapshot'),
  false,
  'attestation state must never enter the document transport shape'
);

const attestation = context.validationAttestation;
if (!attestation) throw new Error('compile must issue command-local evidence');
assert.equal(Object.isFrozen(attestation), true);
assert.equal(attestation.candidate, compiled.document);

materializeCalls = 0;
outputDigestCalls = 0;
const forgedAttestation = {
  ...attestation,
  outputDigest: `sha256:${'0'.repeat(64)}`
};
const forgedReport = validateProjectDocumentCandidate(
  compiled.document,
  forgedAttestation,
  computation
);
assert.equal(forgedReport.valid, true);
assert.equal(materializeCalls, 1, 'forged evidence must recompute authority');
assert.equal(outputDigestCalls, 1, 'forged evidence must rerasterize');

materializeCalls = 0;
outputDigestCalls = 0;
const staleClone = structuredClone(compiled.document);
const staleReport = validateProjectDocumentCandidate(
  staleClone,
  attestation,
  computation
);
assert.equal(staleReport.valid, true);
assert.equal(materializeCalls, 1, 'a cloned candidate must recompute authority');
assert.equal(outputDigestCalls, 1, 'a cloned candidate must rerasterize');

const texture = Object.values(compiled.document.textures)[0];
if (!texture) throw new Error('counted compile requires a generated texture');
texture.width += 1;
materializeCalls = 0;
outputDigestCalls = 0;
const tamperedReport = validateProjectDocumentCandidate(
  compiled.document,
  attestation,
  computation
);
assert.equal(tamperedReport.valid, false);
assert.equal(materializeCalls, 1, 'in-place tampering must reject evidence');
assert.equal(outputDigestCalls, 1, 'in-place tampering must rerasterize');
assert.ok(tamperedReport.findings.some((finding) =>
  finding.code === 'document.invalid_intent'
));
