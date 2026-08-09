import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  canonicalJsonString,
  evaluateProductionReadiness,
  exportProductionProject,
  intentProgramRasterProjection,
  openProjectFile,
  parseIntentProgram,
  serializeProjectFile,
  type ExportAdapterInput,
  type ProjectDocument
} from '../../../src';

interface SharkFixture {
  readonly variant: 'essential' | 'hero';
  readonly track: 'essential' | 'hero';
  readonly markingCount: number;
  readonly partCount: number;
  readonly rasterDigest: string;
  readonly outputDigest: string;
}

const examples = resolve(
  __dirname,
  '../../../../../examples/program/v1/animal/shark'
);

const fixtures: readonly SharkFixture[] = [{
  variant: 'essential',
  track: 'essential',
  markingCount: 3,
  partCount: 31,
  rasterDigest:
    'sha256:0d5a2f36494e77f24c08ebcb8d800a3a59693455b486b723c9a3255ba75b7f27',
  outputDigest:
    'sha256:1e5ad353064b55db5f9c396b0f1f83d165f3634aa4529d8978bdb5605d6be686'
}, {
  variant: 'hero',
  track: 'hero',
  markingCount: 6,
  partCount: 38,
  rasterDigest:
    'sha256:3e575bf26829fb26a86ee37b2d02a2a3f29e6e54e4465ac7a06f67b863e2031d',
  outputDigest:
    'sha256:e858550a06e51b9f573b12dc630cd6f0cf704d3c7c74fe042145e9efbcbb7d40'
}];

assert.deepEqual(
  readdirSync(examples).sort(),
  ['essential.ashfox', 'hero.ashfox'],
  'the shark family owns exactly one source-only file per quality track'
);

const open = (fixture: SharkFixture): {
  readonly source: string;
  readonly document: ProjectDocument;
} => {
  const source = readFileSync(
    resolve(examples, `${fixture.variant}.ashfox`),
    'utf8'
  );
  const result = openProjectFile({
    source,
    identity: {
      id: `example-shark-${fixture.variant}`,
      revision: 'revision-1',
      createdAt: '2026-08-10T00:00:00.000Z'
    }
  });
  if (!result.ok) {
    throw new Error(result.diagnostics.map((entry) =>
      `${entry.span.start.line}:${entry.span.start.column} ${entry.message}`
    ).join('\n'));
  }
  assert.deepEqual(result.diagnostics, []);
  return { source, document: result.document };
};

const adapters = (
  fixture: SharkFixture
): readonly ExportAdapterInput[] => [{
  target: 'bedrock',
  gameVersion: '1.26.30',
  namespace: 'ashfox',
  modelPath: `entity/shark_${fixture.variant}`
}, {
  target: 'geckolib5',
  gameVersion: '26.1',
  namespace: 'ashfox',
  modelPath: `shark/${fixture.variant}`
}];

for (const fixture of fixtures) {
  const first = open(fixture);
  const second = open(fixture);
  const parsed = parseIntentProgram(first.source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.ir?.track, fixture.track);
  assert.equal(
    parsed.ir?.appearance.markings.length,
    fixture.markingCount
  );
  assert.equal(first.document.modeling?.parts.length, fixture.partCount);
  assert.equal(
    canonicalJsonString(first.document),
    canonicalJsonString(second.document),
    `${fixture.variant} must compile byte-stably from the same source and identity`
  );

  const authority = first.document.intentProgram;
  assert.ok(authority);
  if (!authority) {
    throw new Error(`${fixture.variant} requires a confirmed V1 authority`);
  }
  assert.equal(authority.receipt.compilerVersion, 1);
  assert.equal(authority.receipt.specificationVersion, 1);
  assert.equal(authority.receipt.outputDigest, fixture.outputDigest);
  assert.deepEqual(
    intentProgramRasterProjection(first.document).map((entry) =>
      entry.rgbaDigest
    ),
    [fixture.rasterDigest],
    `${fixture.variant} must retain its reviewed Surface Synthesis 1 pixels`
  );

  const saved = serializeProjectFile(first.document);
  assert.deepEqual(saved, { ok: true, source: first.source });
  const readiness = evaluateProductionReadiness(first.document);
  assert.equal(readiness.structurallyValid, true);
  assert.equal(readiness.mechanicallyReady, true);
  assert.equal(readiness.semanticReviewRequired, true);
  assert.deepEqual(readiness.findings, []);

  const beforeExport = canonicalJsonString(first.document);
  for (const adapter of adapters(fixture)) {
    const bundle = exportProductionProject(first.document, adapter);
    assert.ok(bundle.files.some((file) => file.role === 'geometry'));
    assert.ok(bundle.files.some((file) => file.role === 'animation'));
    assert.ok(bundle.files.some((file) => file.role === 'texture'));
    assert.equal(
      bundle.findings.some((finding) => finding.severity === 'error'),
      false,
      `${fixture.variant}/${adapter.target} cannot ship an export error`
    );
    assert.deepEqual(bundle.adaptations, { omitted: [], converted: [] });
    assert.ok(bundle.entrypoints.length > 0);
  }
  assert.equal(
    canonicalJsonString(first.document),
    beforeExport,
    'delivery adapters cannot mutate the source-compiled canonical document'
  );
}

assert.ok(
  fixtures[1]!.partCount > fixtures[0]!.partCount,
  'Hero must carry more authored structure than Essential'
);
