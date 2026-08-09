import assert from 'node:assert/strict';

import type { IntentProgramSourceV1 } from '@ashfox/engine-core';

import {
  presentIntentProgramAuthority,
  presentIntentProgramDigest,
  snapshotIntentProgramAuthority
} from '../../src/features/intentProgram/presentation';

const fingerprint = (character: string): string =>
  `sha256:${character.repeat(64)}`;
const presenterSource = [
  'metadata {',
  '  name "Presenter fixture"',
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
].join('\n');
const confirmed: IntentProgramSourceV1 = {
  version: 1,
  source: presenterSource,
  hash: 'intent:presenter',
  receipt: {
    sourceDigest: fingerprint('1'),
    semanticDigest: fingerprint('2'),
    compilerVersion: 1,
    specificationVersion: 1,
    outputDigest: fingerprint('3')
  }
};

const digest = presentIntentProgramDigest(confirmed.receipt.sourceDigest);
assert.equal(digest.full, confirmed.receipt.sourceDigest);
assert.match(digest.compact, /^sha256:[a-f0-9]{10}…[a-f0-9]{8}$/);

const authority = presentIntentProgramAuthority(confirmed);
assert.equal(authority.versionLabel, 'Intent Program 1');
assert.equal(authority.receipt.source.full, confirmed.receipt.sourceDigest);
assert.equal(authority.compactReviewDigest, digest.compact);
assert.deepEqual(
  snapshotIntentProgramAuthority(confirmed),
  {
    version: 1,
    source: confirmed.source,
    sourceHash: confirmed.hash,
    receipt: confirmed.receipt
  },
  'Agent inspect receives a stable raw snapshot without human authoring UI'
);
