import assert from 'node:assert/strict';

import { canonicalJsonString } from '../../../src/canonicalJson';
import { compileIntentProgram } from '../../../src/compiler/program';
import {
  materializeCompiledIntentProgram
} from '../../../src/compiler/program/materialize';
import {
  intentProgramOutputDigest,
  sha256Digest
} from '../../../src/provenance/program';
import type { ProjectDocument } from '../../../src/model';
import {
  ASHFOX_PROJECT_FILE_CONTENT_TYPE,
  ASHFOX_PROJECT_FILE_EXTENSION,
  openProjectFile,
  serializeProjectFile,
  type ProjectFileIdentitySeed
} from '../../../src/projectFile';
import {
  openProjectFileWithComputation,
  type ProjectFileOpenComputation
} from '../../../src/projectFile/open';
import {
  INTENT_PROGRAM_SOURCE_MAX_LENGTH
} from '../../../src/project/program/language';
import { validateProjectDocument } from '../../../src/validation';
import {
  DEFAULT_INTENT_VALIDATION_COMPUTATION
} from '../../../src/validation/project/candidate';
import { intentProgramSource } from '../../program/source';

const source = [
  '# Exact source spelling and line endings are portable authority.',
  intentProgramSource({
    name: 'Source Crate',
    track: 'essential',
    domain: 'constructed',
    forward: 'north',
    symmetry: 'bilateral',
    support: { kind: 'base', contacts: ['pedestal'] },
    body: [{ id: 'pedestal', kind: 'core', cardinality: 'single' }],
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
  })
].join('\n').replace(/\n/g, '\r\n');

const identity: ProjectFileIdentitySeed = Object.freeze({
  id: 'project-source-crate',
  revision: 'revision-1',
  createdAt: '2026-08-10T00:00:00.000Z'
});

const opened = openProjectFile({ source, identity });
assert.equal(opened.ok, true);
assert.equal(Object.isFrozen(opened), true);
assert.equal(Object.isFrozen(opened.diagnostics), true);
assert.deepEqual(opened.diagnostics, []);
assert.equal(opened.document.id, identity.id);
assert.equal(opened.document.revision, identity.revision);
assert.equal(opened.document.createdAt, identity.createdAt);
assert.equal(opened.document.updatedAt, identity.createdAt);
assert.equal(opened.document.name, 'Source Crate');
assert.equal(opened.document.intentProgramProposal, undefined);
const openedAuthority = opened.document.intentProgram;
assert.ok(openedAuthority);
if (!openedAuthority) {
  throw new Error('source-only open must create current runtime provenance');
}
assert.equal(openedAuthority.version, 1);
assert.equal(openedAuthority.source, source);
assert.equal(
  openedAuthority.receipt.sourceDigest,
  sha256Digest(source)
);
assert.equal(openedAuthority.receipt.compilerVersion, 1);
assert.equal(openedAuthority.receipt.specificationVersion, 1);
assert.equal(validateProjectDocument(opened.document).valid, true);

const repeated = openProjectFile({ source, identity });
assert.equal(repeated.ok, true);
assert.equal(
  canonicalJsonString(repeated.document),
  canonicalJsonString(opened.document),
  'the same exact source and identity seed must reproduce one runtime document'
);
assert.equal(source.includes('\r\n'), true, 'open never normalizes line endings');
assert.deepEqual(identity, {
  id: 'project-source-crate',
  revision: 'revision-1',
  createdAt: '2026-08-10T00:00:00.000Z'
});

const portable = openProjectFile({
  source,
  identity: {
    id: 'another-runtime-project',
    revision: 'revision-83',
    createdAt: '2027-01-02T03:04:05.000Z'
  }
});
assert.equal(portable.ok, true);
assert.notEqual(portable.document.id, opened.document.id);
assert.notEqual(
  portable.document.animations.idle?.name,
  opened.document.animations.idle?.name,
  'runtime display metadata may still follow its host project identity'
);
const portableAuthority = portable.document.intentProgram;
assert.ok(portableAuthority);
if (!portableAuthority) {
  throw new Error('portable source must compile with a V1 receipt');
}
assert.equal(
  portableAuthority.receipt.outputDigest,
  openedAuthority.receipt.outputDigest,
  'portable source receipts must not depend on host project identity'
);
assert.equal(
  intentProgramOutputDigest(portable.document),
  intentProgramOutputDigest(opened.document),
  'compiler output projection must exclude host-only storage locators'
);

let compileCalls = 0;
let materializeCalls = 0;
let outputDigestCalls = 0;
const countedComputation: ProjectFileOpenComputation = {
  compile: (input) => {
    compileCalls += 1;
    return compileIntentProgram(input);
  },
  materialize: (document, program, plan) => {
    materializeCalls += 1;
    return materializeCompiledIntentProgram(document, program, plan);
  },
  outputDigest: (document) => {
    outputDigestCalls += 1;
    return intentProgramOutputDigest(document);
  },
  validation: {
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
  }
};
const counted = openProjectFileWithComputation(
  { source, identity },
  countedComputation
);
assert.equal(counted.ok, true);
assert.equal(compileCalls, 1, 'open must compile its source exactly once');
assert.equal(
  materializeCalls,
  1,
  'open must materialize its immutable compiler plan exactly once'
);
assert.equal(
  outputDigestCalls,
  1,
  'open must rasterize and digest its exact candidate only once'
);

assert.equal(ASHFOX_PROJECT_FILE_EXTENSION, '.ashfox');
assert.equal(
  ASHFOX_PROJECT_FILE_CONTENT_TYPE,
  'text/x-ashfox;charset=utf-8'
);
const serialized = serializeProjectFile(opened.document);
assert.deepEqual(serialized, { ok: true, source });
assert.equal(Object.isFrozen(serialized), true);

const invalidSource = [
  'metadata {',
  '  name "Broken source"',
  '  track impossible',
  '  domain machine',
  '}',
  'model {',
  '  orientation forward diagonal',
  '  symmetry radial',
  '  support hovering',
  '  body {',
  '    core pedestal',
  '  }',
  '  face {',
  '    none',
  '  }',
  '}',
  'animation {',
  '  idle dance',
  '}',
  'appearance {',
  '  palette ultraviolet',
  '  texture brushed scale medium density sparse contrast subtle',
  '  seed auto',
  '}'
].join('\n');
const invalid = openProjectFile({ source: invalidSource, identity });
assert.equal(invalid.ok, false);
if (invalid.ok) throw new Error('invalid source must fail atomically');
assert.ok(invalid.diagnostics.length >= 5, 'source errors aggregate');
assert.deepEqual(
  invalid.diagnostics.map((entry) => entry.span.start.offset),
  [...invalid.diagnostics]
    .map((entry) => entry.span.start.offset)
    .sort((left, right) => left - right),
  'source diagnostics retain stable source order'
);
assert.equal(Object.isFrozen(invalid.diagnostics), true);

const oversized = openProjectFile({
  source: ' '.repeat(INTENT_PROGRAM_SOURCE_MAX_LENGTH + 1),
  identity
});
assert.equal(oversized.ok, false);
if (oversized.ok) throw new Error('oversized source must fail');
assert.equal(oversized.diagnostics[0]?.code, 'intent.source_too_long');
assert.equal(
  oversized.diagnostics[0]?.span.start.offset,
  INTENT_PROGRAM_SOURCE_MAX_LENGTH
);

const badIdentity = openProjectFile({
  source,
  identity: { ...identity, createdAt: 'today' }
});
assert.equal(badIdentity.ok, false);
if (badIdentity.ok) throw new Error('invalid identity must fail');
assert.equal(
  badIdentity.diagnostics[0]?.code,
  'project-file.invalid_identity'
);

const archivedDocument = openProjectFile({
  source: JSON.stringify(opened.document),
  identity
});
assert.equal(archivedDocument.ok, false);
if (archivedDocument.ok) {
  throw new Error('compiled JSON archives are not project files');
}
assert.ok(archivedDocument.diagnostics.length > 0);

const missing = serializeProjectFile({
  ...opened.document,
  intentProgram: undefined
});
assert.equal(missing.ok, false);
if (missing.ok) throw new Error('missing source must not serialize');
assert.equal(missing.error.code, 'project-file.missing_source');

const pending = serializeProjectFile({
  ...opened.document,
  intentProgramProposal: opened.document.intentProgram
});
assert.equal(pending.ok, false);
if (pending.ok) throw new Error('pending source must not serialize');
assert.equal(pending.error.code, 'project-file.pending_source');

const current = openedAuthority;

const wrongHash = serializeProjectFile({
  ...opened.document,
  intentProgram: { ...current, hash: 'intent:00000000' }
});
assert.equal(wrongHash.ok, false);
if (wrongHash.ok) throw new Error('mismatched source hash must not serialize');
assert.equal(wrongHash.error.code, 'project-file.invalid_source');

const cube = Object.values(opened.document.scene.nodes).find((node) =>
  node.kind === 'cube'
);
assert.ok(cube && cube.kind === 'cube');
if (!cube || cube.kind !== 'cube') {
  throw new Error('compiled file fixture requires one cube');
}
const tampered: ProjectDocument = {
  ...opened.document,
  scene: {
    ...opened.document.scene,
    nodes: {
      ...opened.document.scene.nodes,
      [cube.id]: {
        ...cube,
        bounds: {
          ...cube.bounds,
          to: [
            cube.bounds.to[0] + 1,
            cube.bounds.to[1],
            cube.bounds.to[2]
          ]
        }
      }
    }
  }
};
const stale = serializeProjectFile(tampered);
assert.equal(stale.ok, true);
assert.deepEqual(
  stale,
  { ok: true, source },
  'derived runtime state is not persisted project-file authority'
);
const repaired = openProjectFile({ source: stale.source, identity });
assert.equal(repaired.ok, true);
assert.equal(
  canonicalJsonString(repaired.document.scene),
  canonicalJsonString(opened.document.scene),
  'opening the saved source deterministically repairs derived runtime state'
);

const changedSource = serializeProjectFile({
  ...opened.document,
  intentProgram: {
    ...current,
    source: current.source.replace('Source Crate', 'Changed Crate')
  }
});
assert.equal(changedSource.ok, false);
assert.equal(changedSource.error.code, 'project-file.invalid_source');

const staleOutputReceipt = serializeProjectFile({
  ...opened.document,
  intentProgram: {
    ...current,
    receipt: {
      ...current.receipt,
      outputDigest: `sha256:${'0'.repeat(64)}`
    }
  }
});
assert.deepEqual(
  staleOutputReceipt,
  { ok: true, source },
  'runtime output receipts are not serialized project-file authority'
);
