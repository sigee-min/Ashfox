import assert from 'node:assert/strict';

import { compileIntentProgramCommand } from '../../src/commands/program/compile';
import { proposeIntentProgramCommand } from '../../src/commands/program/propose';
import {
  INTENT_PROGRAM_PROVENANCE_CONTRACT,
  intentProgramOutputDigest,
  intentProgramOutputProjection,
  intentProgramRasterProjection,
  isIntentProgramDigest,
  readIntentProgramSource,
  sha256ByteDigest,
  sha256Digest
} from '../../src/provenance/program';
import { createProjectDocument } from '../../src/project/create';
import { rasterizeTexture } from '../../src/textures/textureRecipe/raster';
import { intentProgramSource } from './source';

const source = intentProgramSource({
  name: 'Receipt walker',
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'feet', contacts: ['legs'] },
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

const seed = () => createProjectDocument({
  id: 'project-intent-provenance',
  name: 'Intent provenance',
  revision: 'revision-1',
  createdAt: '2026-08-09T00:00:00.000Z'
});

assert.equal(
  sha256Digest(''),
  'sha256:e3b0c44298fc1c149afbf4c8996fb924' +
    '27ae41e4649b934ca495991b7852b855'
);
assert.equal(INTENT_PROGRAM_PROVENANCE_CONTRACT.sourceVersion, 1);
assert.equal(INTENT_PROGRAM_PROVENANCE_CONTRACT.specificationVersion, 1);
assert.equal(isIntentProgramDigest(sha256Digest('contract')), true);
assert.equal(isIntentProgramDigest('sha256:ABC'), false);

const versionlessRead = readIntentProgramSource({ source: 'source', hash: 'hash' });
assert.equal(versionlessRead.ok, false);
if (versionlessRead.ok) throw new Error('versionless provenance must be rejected');
assert.ok(versionlessRead.issues.some((issue) => issue.path === 'version'));
assert.ok(versionlessRead.issues.some((issue) => issue.path === 'receipt'));
const malformedRead = readIntentProgramSource({
  version: 1,
  source: 'source',
  hash: 'hash',
  receipt: {
    sourceDigest: 'not-a-digest',
    semanticDigest: `sha256:${'0'.repeat(64)}`,
    compilerVersion: 1,
    specificationVersion: 1,
    outputDigest: `sha256:${'0'.repeat(64)}`,
    extra: true
  }
});
assert.equal(malformedRead.ok, false);
if (malformedRead.ok) throw new Error('malformed receipt must be rejected');
assert.ok(malformedRead.issues.some((issue) => issue.path === 'receipt.sourceDigest'));
assert.ok(malformedRead.issues.some((issue) => issue.path === 'receipt.extra'));
assert.equal(
  sha256Digest('abc'),
  'sha256:ba7816bf8f01cfea414140de5dae2223' +
    'b00361a396177a9cb410ff61f20015ad'
);

const proposed = proposeIntentProgramCommand.apply(seed(), { source });
if (!proposed.ok) throw new Error(proposed.error.message);
assert.equal(proposed.ok, true);
const proposal = proposed.value.document.intentProgramProposal;
assert.ok(proposal);
if (!proposal) {
  throw new Error('proposal must persist a v1 compilation receipt');
}
assert.equal(proposal.version, 1);
assert.equal(proposal.receipt.compilerVersion, 1);
assert.equal(proposal.receipt.specificationVersion, 1);

const compiled = compileIntentProgramCommand.apply(proposed.value.document, {
  sourceDigest: proposal.receipt.sourceDigest
});
if (!compiled.ok) throw new Error(compiled.error.message);
assert.equal(compiled.ok, true);
const confirmed = compiled.value.document.intentProgram;
assert.ok(confirmed);
if (!confirmed) {
  throw new Error('compile must confirm a v1 source');
}
assert.equal(
  confirmed.receipt.outputDigest,
  proposal.receipt.outputDigest,
  'confirmation must reproduce the reviewed preview'
);
assert.equal(
  confirmed.receipt.outputDigest,
  intentProgramOutputDigest(compiled.value.document)
);
const rasterProjection = intentProgramRasterProjection(compiled.value.document);
assert.ok(rasterProjection.length > 0);
assert.deepEqual(
  (intentProgramOutputProjection(compiled.value.document) as {
    generatedRasters: readonly unknown[];
  }).generatedRasters,
  rasterProjection,
  'the persisted output receipt must bind canonical generated raster bytes'
);
const generatedTexture = Object.values(compiled.value.document.textures)[0];
if (!generatedTexture) throw new Error('compiled fixture requires a texture');
assert.equal(
  sha256ByteDigest(
    rasterizeTexture(compiled.value.document, generatedTexture).rgba
  ),
  'sha256:2f39001a0a20556d39415c053f915fe82cc58385ebfdfd33d60e7ecfe8c8d9d0',
  'Surface Synthesis 1 must freeze the canonical compositor RGBA output'
);
const markedSource = intentProgramSource({
  name: 'Receipt walker',
  track: 'essential',
  domain: 'constructed',
  forward: 'north',
  symmetry: 'bilateral',
  support: { kind: 'feet', contacts: ['legs'] },
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
      kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
    },
    seed: { kind: 'explicit', value: 'receipt-mark' },
    markings: [{
      id: 'crest', target: { kind: 'body', id: 'torso' },
      region: 'dorsal', placement: 'center', motif: 'patch', tone: 'accent',
      scale: 'medium', density: 'sparse', contrast: 'medium'
    }]
  }
});
const markedProposal = proposeIntentProgramCommand.apply(seed(), {
  source: markedSource
});
if (!markedProposal.ok) throw new Error(markedProposal.error.message);
const markedPending = markedProposal.value.document.intentProgramProposal;
if (!markedPending) {
  throw new Error('marked fixture requires a V1 proposal');
}
const markedCompiled = compileIntentProgramCommand.apply(
  markedProposal.value.document,
  { sourceDigest: markedPending.receipt.sourceDigest }
);
if (!markedCompiled.ok) throw new Error(markedCompiled.error.message);
const markedTexture = Object.values(markedCompiled.value.document.textures)[0];
if (!markedTexture) throw new Error('marked fixture requires a texture');
const markedRasterDigest = sha256ByteDigest(
  rasterizeTexture(markedCompiled.value.document, markedTexture).rgba
);
assert.equal(
  markedRasterDigest,
  'sha256:ed3831c4d7dbae53e0d3ed051fe49f1547ce1571d119b59bce5cb7ac8511cf1f',
  'authored appearance must freeze its canonical marked RGBA output'
);
assert.equal(
  intentProgramRasterProjection(markedCompiled.value.document)[0]?.rgbaDigest,
  markedRasterDigest,
  'the output receipt must bind the authored marking raster bytes'
);
assert.notEqual(
  intentProgramOutputDigest(markedCompiled.value.document),
  confirmed.receipt.outputDigest,
  'authored appearance meaning and raster bytes must change the output receipt'
);
const additionalTexture = {
  ...generatedTexture,
  id: 'texture-zeta',
  source: {
    ...generatedTexture.source,
    key: 'generated/texture-zeta.png'
  }
};
assert.deepEqual(
  intentProgramRasterProjection({
    ...compiled.value.document,
    textures: {
      [additionalTexture.id]: additionalTexture,
      [generatedTexture.id]: generatedTexture
    }
  }),
  intentProgramRasterProjection({
    ...compiled.value.document,
    textures: {
      [generatedTexture.id]: generatedTexture,
      [additionalTexture.id]: additionalTexture
    }
  }),
  'raster receipt projection must ignore texture insertion order'
);
assert.equal(compiled.value.document.intentProgramProposal, undefined);

const changedConfirmed = {
  ...confirmed,
  receipt: {
    ...confirmed.receipt,
    semanticDigest: `sha256:${'9'.repeat(64)}`
  }
};
const rejectedConfirmed = compileIntentProgramCommand.apply({
  ...compiled.value.document,
  intentProgram: changedConfirmed
}, {
  sourceDigest: changedConfirmed.receipt.sourceDigest
});
assert.equal(rejectedConfirmed.ok, false);
if (rejectedConfirmed.ok) throw new Error('tampered authority must be rejected');
assert.equal(
  rejectedConfirmed.error.path,
  'intentProgram.receipt.semanticDigest',
  'receipt diagnostics retain the active confirmed/proposal authority path'
);

const changedPreview = {
  ...proposal,
  receipt: {
    ...proposal.receipt,
    outputDigest: `sha256:${'0'.repeat(64)}`
  }
};
const rejected = compileIntentProgramCommand.apply({
  ...proposed.value.document,
  intentProgramProposal: changedPreview
}, {
  sourceDigest: changedPreview.receipt.sourceDigest
});
assert.equal(rejected.ok, false);
if (rejected.ok) throw new Error('tampered preview must be rejected');
assert.equal(rejected.error.path, 'intentProgramProposal.receipt.outputDigest');
