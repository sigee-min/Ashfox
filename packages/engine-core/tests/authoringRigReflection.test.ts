import assert from 'node:assert/strict';

import {
  exactAuthoringRigReflection
} from '../src/authoring/authoringRigReflection';
import { compileIntentProgram } from '../src/compiler/intentProgram';
import { derivePartAttachments } from '../src/modeling/partAttachmentDerivation';
import {
  areLatticeCellSetsExactReflections
} from '../src/modeling/partRecipeTransforms/geometry';
import {
  validationOccupancyForPart
} from '../src/modeling/semanticCuboidGrammar';
import { parseIntentProgram } from '../src/project/intentProgram';
import { projectSpatialFrame } from '../src/project/projectSpatialFrame';

for (const fixture of [{
  forward: 'north' as const,
  sourcePivot: [-4, 7, 1] as const,
  targetPivot: [4, 7, 1] as const,
  joint: 'hinge:z'
}, {
  forward: 'east' as const,
  sourcePivot: [1, 7, -4] as const,
  targetPivot: [1, 7, 4] as const,
  joint: 'hinge:x'
}]) {
  const frame = projectSpatialFrame({
    forward: fixture.forward,
    symmetry: { kind: 'bilateral', planeTwice: 0 }
  });
  assert.equal(exactAuthoringRigReflection(
    [{ pivot: fixture.sourcePivot, joint: fixture.joint }],
    [{ pivot: fixture.targetPivot, joint: fixture.joint }],
    frame
  ), true, `${fixture.forward} lateral hinge must reflect exactly`);
  assert.equal(exactAuthoringRigReflection(
    [{ pivot: fixture.sourcePivot, joint: fixture.joint }],
    [{ pivot: fixture.targetPivot, joint: 'hinge:y' }],
    frame
  ), false, 'reflection cannot hide a changed hinge axis');
}

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  for (const extension of ['up', 'forward', 'rearward'] as const) {
    const source = [
      'asset "paired surface"',
      'track essential',
      'domain organism',
      `frame front ${forward}`,
      'symmetry bilateral',
      'rest neutral feet',
      'body core body',
      `surface wing pair wing from body extends ${extension}`,
      'face none',
      'style palette ember'
    ].join('\n');
    const parsed = parseIntentProgram(source);
    assert.equal(
      parsed.diagnostics.some((item) => item.severity === 'error'),
      false,
      `${forward}/${extension} must parse without an error`
    );
    if (!parsed.ir) throw new Error(`${forward}/${extension} lacks IR`);
    const compiled = compileIntentProgram({
      program: parsed.ir,
      sourceMap: parsed.sourceMap
    });
    assert.equal(compiled.ok, true, `${forward}/${extension} must lower`);
    if (!compiled.ok) throw new Error(`${forward}/${extension} failed`);
    const frame = projectSpatialFrame(compiled.plan.projectIntent);
    if (frame.plane === null) throw new Error('Expected bilateral plane.');
    const derived = derivePartAttachments(compiled.plan.recipe.parts, 1, {
      reflection: {
        frame,
        pairs: compiled.plan.attachmentReflections
      }
    });
    assert.equal(
      derived.ok,
      true,
      `${forward}/${extension} attachment derivation must succeed`
    );
    if (!derived.ok) throw new Error(`${forward}/${extension} failed`);
    const parts = new Map(derived.parts.map((part) => [part.partId, part]));
    for (const pair of compiled.plan.attachmentReflections) {
      const sourcePart = parts.get(pair.sourcePartId);
      const reflectedPart = parts.get(pair.reflectedPartId);
      if (
        !sourcePart ||
        !reflectedPart ||
        sourcePart.kind === 'feature' ||
        reflectedPart.kind === 'feature'
      ) {
        throw new Error(`Missing geometric pair ${pair.sourcePartId}.`);
      }
      assert.equal(
        areLatticeCellSetsExactReflections(
          validationOccupancyForPart(sourcePart, 1).cells,
          validationOccupancyForPart(reflectedPart, 1).cells,
          frame.lateralAxis,
          frame.plane
        ),
        true,
        `${forward}/${extension} must reflect ${pair.sourcePartId} atomically`
      );
    }
  }
}
