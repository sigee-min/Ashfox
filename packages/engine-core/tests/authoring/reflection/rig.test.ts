import assert from 'node:assert/strict';

import {
  exactAuthoringRigReflection
} from '../../../src/authoring/reflection/rig';
import { compileIntentProgram } from '../../../src/compiler/program';
import { derivePartAttachments } from '../../../src/modeling/attachment/derive';
import {
  areLatticeCellSetsExactReflections
} from '../../../src/modeling/recipe/transforms/geometry';
import {
  validationOccupancyForPart
} from '../../../src/modeling/cuboid/grammar';
import { parseIntentProgram } from '../../../src/project/program';
import { projectSpatialFrame } from '../../../src/project/frame';
import { intentProgramSource } from '../../program/source';

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
  ), true, `${fixture.forward} transverse hinge must reflect exactly`);
  assert.equal(exactAuthoringRigReflection(
    [{ pivot: fixture.sourcePivot, joint: fixture.joint }],
    [{ pivot: fixture.targetPivot, joint: 'hinge:y' }],
    frame
  ), false, 'reflection cannot hide a changed hinge axis');
}

for (const forward of ['north', 'south', 'east', 'west'] as const) {
  for (const growth of ['up', 'forward', 'rearward'] as const) {
    const source = intentProgramSource({
      name: 'paired surface',
      track: 'essential',
      domain: 'organism',
      forward,
      symmetry: 'bilateral',
      support: { kind: 'feet', contacts: ['legs'] },
      body: [{
        id: 'body', kind: 'core', cardinality: 'single'
      }, {
        id: 'legs', kind: 'limb', cardinality: 'paired', parent: 'body',
        anchor: 'sides', growth: 'down', lane: 'center'
      }],
      surfaces: [{
        id: 'wing', role: 'wing', cardinality: 'paired', parent: 'body',
        anchor: 'sides', growth, lane: 'upper'
      }],
      face: { kind: 'none' },
      idle: { mode: 'still' },
      appearance: {
        palette: 'ember',
        texture: {
          kind: 'mottle', scale: 'broad', density: 'balanced', contrast: 'subtle'
        },
        seed: { kind: 'auto' },
        markings: []
      }
    });
    const parsed = parseIntentProgram(source);
    assert.equal(
      parsed.diagnostics.some((item) => item.severity === 'error'),
      false,
      `${forward}/${growth} must parse without an error`
    );
    if (!parsed.ir) throw new Error(`${forward}/${growth} lacks IR`);
    const compiled = compileIntentProgram({
      program: parsed.ir,
      sourceMap: parsed.sourceMap
    });
    assert.equal(compiled.ok, true, `${forward}/${growth} must lower`);
    if (!compiled.ok) throw new Error(`${forward}/${growth} failed`);
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
      `${forward}/${growth} attachment derivation must succeed`
    );
    if (!derived.ok) throw new Error(`${forward}/${growth} failed`);
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
        `${forward}/${growth} must reflect ${pair.sourcePartId} atomically`
      );
    }
  }
}
