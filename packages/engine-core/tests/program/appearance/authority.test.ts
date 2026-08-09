import assert from 'node:assert/strict';

import {
  PROJECT_APPEARANCE_SPECIFICATION as specification,
  type ProjectAppearanceMarking,
  type ProjectAppearancePlacement,
  type ProjectAppearanceRegion
} from '../../../src/project/appearance/contract';
import { normalizeIntentProgramAppearance } from
  '../../../src/project/appearance/normalize';
import {
  normalizeProjectAppearanceIntent,
  type ProjectAppearanceIssue
} from '../../../src/project/appearance/reader';
import { PROJECT_SEMANTIC_IDENTIFIER_PATTERN } from
  '../../../src/project/identifier';
import { INTENT_PROGRAM_LANGUAGE_SPECIFICATION } from
  '../../../src/project/program/language';

assert.equal(
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION.appearance.specification,
  specification,
  'Intent Program publishes the exact Surface Appearance authority'
);
assert.deepEqual(specification.statements.mark.targetReferences, {
  body: { namespace: 'body', idCardinality: 1 },
  surface: { namespace: 'surfaces', idCardinality: 1 },
  face: { namespace: 'face', idCardinality: 0 },
  focal: { namespace: 'focal', idCardinality: 1 }
});
assert.deepEqual(specification.statements.mark.identity, {
  field: 'id', unique: true
});
assert.deepEqual(specification.statements.seed.forms, {
  automatic: {
    kind: 'auto', sentinel: 'auto', properties: ['kind']
  },
  explicit: {
    kind: 'explicit', properties: ['kind', 'value'],
    value: {
      format: 'lower-kebab-case',
      pattern: PROJECT_SEMANTIC_IDENTIFIER_PATTERN.source,
      maxLength: 'maxSeedLength'
    }
  }
});
assert.ok(Object.isFrozen(specification.statements.seed.forms));
assert.ok(Object.isFrozen(
  specification.statements.seed.forms.explicit.value
));
assert.ok(Object.isFrozen(specification.statements.mark.targetReferences));
assert.ok(Object.isFrozen(
  specification.statements.mark.targetReferences.surface
));
assert.ok(Object.isFrozen(specification.markingOverlap.regionAxes));
assert.ok(Object.isFrozen(
  specification.markingOverlap.regionAxes['posterior-flank']
));
assert.ok(Object.isFrozen(
  specification.markingOverlap.overlappingPlacements.edge
));

const texture = {
  kind: 'mottle' as const,
  scale: 'broad' as const,
  density: 'balanced' as const,
  contrast: 'subtle' as const
};
const seed = { kind: 'auto' as const };
const appearanceWithSeed = (value: unknown): {
  readonly result: ReturnType<typeof normalizeProjectAppearanceIntent>;
  readonly issues: readonly ProjectAppearanceIssue[];
} => {
  const issues: ProjectAppearanceIssue[] = [];
  const result = normalizeProjectAppearanceIntent({
    version: 1, seed: value, texture, markings: []
  }, issues);
  return { result, issues };
};
assert.deepEqual(appearanceWithSeed({ kind: 'auto' }).result?.seed, {
  kind: 'auto'
});
assert.deepEqual(appearanceWithSeed({
  kind: 'explicit', value: 'reef-17'
}).result?.seed, { kind: 'explicit', value: 'reef-17' });
for (const value of [
  { kind: 'explicit', value: 'BAD' },
  { kind: 'explicit', value: 'auto' },
  { kind: 'legacy', value: 'reef-17' }
]) {
  const invalid = appearanceWithSeed(value);
  assert.equal(invalid.result, null);
  assert.ok(invalid.issues.some((issue) =>
    issue.path === 'appearance.seed.value' ||
    issue.path === 'appearance.seed.kind'
  ));
}
const island = (
  id: string,
  region: ProjectAppearanceRegion,
  placement: ProjectAppearancePlacement
): ProjectAppearanceMarking => ({
  id,
  target: { kind: 'body', id: 'torso' },
  region,
  placement,
  motif: 'patch',
  tone: 'darker',
  scale: 'medium',
  density: 'sparse',
  contrast: 'subtle'
});

const normalized = (
  markings: readonly ProjectAppearanceMarking[]
): readonly ProjectAppearanceIssue[] => {
  const issues: ProjectAppearanceIssue[] = [];
  normalizeProjectAppearanceIntent({
    version: 1, seed, texture, markings
  }, issues);
  return issues;
};
const overlaps = (
  leftRegion: ProjectAppearanceRegion,
  leftPlacement: ProjectAppearancePlacement,
  rightRegion: ProjectAppearanceRegion,
  rightPlacement: ProjectAppearancePlacement
): boolean => normalized([
  island('first', leftRegion, leftPlacement),
  island('second', rightRegion, rightPlacement)
]).some((issue) => issue.message.includes('ambiguous same-class overlap'));

assert.equal(overlaps('dorsal', 'center', 'ventral', 'center'), false);
assert.equal(
  overlaps('anterior-flank', 'center', 'posterior-flank', 'center'),
  false
);
assert.equal(overlaps('dorsal', 'center', 'flank', 'center'), true);
assert.equal(overlaps('full', 'root', 'full', 'joint'), true);
assert.equal(overlaps('full', 'edge', 'full', 'tip'), true);
assert.equal(overlaps('full', 'root', 'full', 'tip'), false);

assert.ok(normalized([
  island('same', 'dorsal', 'root'),
  island('same', 'ventral', 'tip')
]).some((issue) => issue.message.includes('ID "same" is duplicated')));

const targetMarkings: readonly ProjectAppearanceMarking[] = [{
  id: 'body-mark',
  target: { kind: 'body', id: 'torso' },
  region: 'full', placement: 'whole', motif: 'wash', tone: 'lighter',
  scale: 'broad', density: 'sparse', contrast: 'subtle'
}, {
  id: 'surface-mark',
  target: { kind: 'surface', id: 'fins' },
  region: 'full', placement: 'tip', motif: 'patch', tone: 'accent',
  scale: 'medium', density: 'sparse', contrast: 'bold'
}, {
  id: 'face-mark',
  target: { kind: 'face' },
  region: 'dorsal', placement: 'center', motif: 'band', tone: 'darker',
  flow: 'transverse', scale: 'fine', density: 'sparse', contrast: 'medium'
}, {
  id: 'focal-mark',
  target: { kind: 'focal', id: 'beacon' },
  region: 'full', placement: 'center', motif: 'spots', tone: 'accent',
  scale: 'fine', density: 'sparse', contrast: 'bold'
}];
const reports: { readonly code: string; readonly path: string }[] = [];
const complete = normalizeIntentProgramAppearance(
  { palette: 'ocean', texture, seed, markings: targetMarkings },
  {
    references: {
      body: new Set(['torso']),
      surfaces: new Set(['fins']),
      face: true,
      focal: new Set(['beacon'])
    }
  },
  {
    reportPath: (code, _message, path) => reports.push({ code, path })
  }
);
assert.ok(complete);
assert.deepEqual(reports, []);

const missingReports: { readonly code: string; readonly path: string }[] = [];
normalizeIntentProgramAppearance(
  { palette: 'ocean', texture, seed, markings: targetMarkings },
  {
    references: {
      body: new Set(), surfaces: new Set(), face: false, focal: new Set()
    }
  },
  {
    reportPath: (code, _message, path) => missingReports.push({ code, path })
  }
);
assert.deepEqual(missingReports.map((report) => report.path), [
  'appearance.markings.body-mark.target.id',
  'appearance.markings.surface-mark.target.id',
  'appearance.markings.face-mark.target.kind',
  'appearance.markings.focal-mark.target.id'
]);
