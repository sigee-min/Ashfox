import assert from 'node:assert/strict';

import {
  compileIntentProgram,
  materializeIntentProgram
} from '../../../src/compiler/program';
import type { ModelPartSpec } from '../../../src/model';
import type { EyeFeaturePartSpec } from '../../../src/modeling/part';
import { orientedSurfaceFeatureRect } from '../../../src/modeling/surface/feature';
import { createProjectDocument } from '../../../src/project/create';
import { parseIntentProgram } from '../../../src/project/program';
import {
  compileTextureSurfaceAuthority
} from '../../../src/textures/textureRecipe/surfaceMetrics';

const sourceFor = (
  forward: 'north' | 'south' | 'east' | 'west'
): string => [
  'metadata {',
  `  name "Paired eyes ${forward}"`,
  '  track hero',
  '  domain organism',
  '}',
  'model {',
  `  orientation forward ${forward}`,
  '  symmetry bilateral',
  '  support none',
  '  body {',
  '    core torso',
  '    mass head single parent torso anchor front growth forward lane center',
  '  }',
  '  face {',
  '    full parent head',
  '    eyes paired gaze center',
  '    nose absent',
  '    mouth neutral',
  '  }',
  '}',
  'animation {',
  '  idle breathe',
  '}',
  'appearance {',
  '  palette ember',
  '  texture mottle scale broad density balanced contrast subtle',
  '  seed auto',
  '}'
].join('\n');

const requiredEye = (
  parts: readonly ModelPartSpec[],
  partId: string
): EyeFeaturePartSpec => {
  const part = parts.find((candidate) => candidate.partId === partId);
  if (!part || part.kind !== 'feature' || part.motif !== 'eye') {
    throw new Error(`Missing eye feature ${partId}.`);
  }
  return part as EyeFeaturePartSpec;
};

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  const source = sourceFor(forward);
  const parsed = parseIntentProgram(source);
  assert.ok(parsed.ir);
  assert.ok(parsed.hash);
  assert.deepEqual(parsed.diagnostics, []);
  const compiled = compileIntentProgram({
    program: parsed.ir,
    sourceMap: parsed.sourceMap
  });
  if (!compiled.ok) throw new Error(compiled.diagnostics[0]?.message);
  assert.equal(compiled.ok, true);
  const left = requiredEye(compiled.plan.recipe.parts, 'face.eye.left');
  const right = requiredEye(compiled.plan.recipe.parts, 'face.eye.right');
  assert.equal(left.parentPartId, right.parentPartId);
  const rects = [
    orientedSurfaceFeatureRect(left),
    orientedSurfaceFeatureRect(right)
  ].sort((first, second) => first.x - second.x);
  const first = rects[0];
  const second = rects[1];
  assert.ok(first && second);
  assert.ok(
    second.x - (first.x + first.width) >= 2,
    `${forward} paired eye footprints need visible host-surface separation`
  );

  const materialized = materializeIntentProgram(createProjectDocument({
    id: `paired-eyes-${forward}`,
    name: `Paired eyes ${forward}`,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source, hash: parsed.hash });
  assert.equal(
    materialized.ok,
    true,
    materialized.ok ? undefined : materialized.error.message
  );
  if (!materialized.ok) continue;
  const faceAuthority = [...compileTextureSurfaceAuthority(
    materialized.document
  ).faces.values()].find((authority) => {
    const ids = new Set(authority.markings?.map((marking) => marking.id));
    return ids.has('face.eye.left') && ids.has('face.eye.right');
  });
  const renderedEyes = faceAuthority?.markings
    ?.filter((marking) => marking.motif === 'eye')
    .sort((first, second) => first.x - second.x) ?? [];
  assert.equal(renderedEyes.length, 2);
  const renderedFirst = renderedEyes[0];
  const renderedSecond = renderedEyes[1];
  assert.ok(renderedFirst && renderedSecond);
  assert.ok(
    renderedSecond.x - (renderedFirst.x + renderedFirst.width) >= 2,
    `${forward} generated eye markings must retain their host-tone gap`
  );
}
