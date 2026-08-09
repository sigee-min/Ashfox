import assert from 'node:assert/strict';

import { materializeIntentProgram } from '../../../../src/compiler/program';
import type { ProjectDocument } from '../../../../src/model';
import { createProjectDocument } from '../../../../src/project/create';
import { parseIntentProgram } from '../../../../src/project/program';
import {
  createSurfaceAppearanceCompiler,
  surfaceMarkingContains
} from '../../../../src/textures/appearance';
import {
  compileTextureSurfaceAuthority
} from '../../../../src/textures/textureRecipe/surfaceMetrics';

const appearanceSource = (input: {
  readonly seed: string;
  readonly palette: 'ocean' | 'ember';
  readonly textureContrast: 'subtle' | 'bold';
  readonly markingContrast: 'subtle' | 'bold';
  readonly reversed?: boolean;
}): string => {
  const markings = [
    `mark belly target body torso region ventral placement whole as wash tone lighter scale broad density sparse contrast ${input.markingContrast}`,
    `mark face-coat target face region full placement whole as wash tone accent scale broad density sparse contrast ${input.markingContrast}`,
    `mark fin-dots target surface fins region full placement whole as spots tone darker scale medium density balanced contrast ${input.markingContrast}`
  ];
  return [
    'metadata {',
    '  name "Semantic marks"',
    '  track hero',
    '  domain organism',
    '}',
    'model {',
    '  orientation forward south',
    '  symmetry bilateral',
    '  support none',
    '  body {',
    '    core torso',
    '    mass head single parent torso anchor front growth forward lane center',
    '  }',
    '  surface fins paired fin parent torso anchor sides growth outward lane center',
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
    `  palette ${input.palette}`,
    `  texture mottle scale broad density balanced contrast ${input.textureContrast}`,
    `  seed ${input.seed}`,
    ...(input.reversed ? [...markings].reverse() : markings).map(
      (line) => `  ${line}`
    ),
    '}'
  ].join('\n');
};

const materialized = (source: string, id: string): ProjectDocument => {
  const parsed = parseIntentProgram(source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.ok(parsed.hash);
  const result = materializeIntentProgram(createProjectDocument({
    id,
    name: id,
    revision: 'revision-1',
    createdAt: '2026-08-09T00:00:00.000Z'
  }), { source, hash: parsed.hash });
  if (!result.ok) throw new Error(result.error.message);
  return result.document;
};

const semanticMask = (document: ProjectDocument): readonly string[] => {
  const authority = compileTextureSurfaceAuthority(document);
  const selected: string[] = [];
  for (const [faceKey, face] of [...authority.faces].sort()) {
    const field = face.pattern?.toneField;
    if (!field) continue;
    for (const marking of field.appearance.markings ?? []) {
      for (
        let v = field.bounds.y;
        v < field.bounds.y + field.bounds.height;
        v += 1
      ) {
        for (
          let u = field.bounds.x;
          u < field.bounds.x + field.bounds.width;
          u += 1
        ) {
          if (surfaceMarkingContains(field.appearance, marking, u, v)) {
            selected.push(`${marking.id}:${faceKey}:${u},${v}`);
          }
        }
      }
    }
  }
  return selected.sort();
};

const baseDocument = materialized(appearanceSource({
  seed: 'reef-alpha',
  palette: 'ocean',
  textureContrast: 'subtle',
  markingContrast: 'subtle'
}), 'marks-base');
const repeatedMask = semanticMask(baseDocument);
assert.deepEqual(semanticMask(baseDocument), repeatedMask);
assert.ok(repeatedMask.length > 0, 'authored semantic marks must reach raster plans');

const styledDocument = materialized(appearanceSource({
  seed: 'reef-alpha',
  palette: 'ember',
  textureContrast: 'bold',
  markingContrast: 'bold'
}), 'marks-styled');
assert.deepEqual(
  semanticMask(styledDocument),
  repeatedMask,
  'palette and both contrast controls must be absent from semantic masks'
);

const automaticMask = semanticMask(materialized(appearanceSource({
  seed: 'auto',
  palette: 'ocean',
  textureContrast: 'subtle',
  markingContrast: 'subtle'
}), 'marks-auto-base'));
assert.deepEqual(
  semanticMask(materialized(appearanceSource({
    seed: 'auto',
    palette: 'ember',
    textureContrast: 'bold',
    markingContrast: 'bold'
  }), 'marks-auto-styled')),
  automaticMask,
  'automatic source seeds also exclude palette, contrast, and project identity'
);

const variedDocument = materialized(appearanceSource({
  seed: 'reef-beta',
  palette: 'ocean',
  textureContrast: 'subtle',
  markingContrast: 'subtle'
}), 'marks-varied');
assert.notDeepEqual(
  semanticMask(variedDocument),
  repeatedMask,
  'an explicit seed must deterministically select a different mask only'
);

const reorderedDocument = materialized(appearanceSource({
  seed: 'reef-alpha',
  palette: 'ocean',
  textureContrast: 'subtle',
  markingContrast: 'subtle',
  reversed: true
}), 'marks-reordered');
assert.deepEqual(
  semanticMask(reorderedDocument),
  repeatedMask,
  'source declaration order must not consume or move mark streams'
);

const baseAuthority = compileTextureSurfaceAuthority(baseDocument);
const bindings = new Map(baseDocument.intent?.appearanceBindings?.map((entry) => [
  entry.markingId,
  entry
]));
const seenMarks = new Set<string>();
for (const face of baseAuthority.faces.values()) {
  const appearance = face.pattern?.toneField.appearance;
  if (!appearance) continue;
  for (const marking of appearance.markings ?? []) {
    const binding = bindings.get(marking.id);
    assert.ok(binding?.partIds.includes(appearance.semanticOwnerKey));
    seenMarks.add(marking.id);
  }
}
assert.deepEqual([...seenMarks].sort(), ['belly', 'face-coat', 'fin-dots']);
const faceCoat = [...baseAuthority.faces.values()]
  .flatMap((face) => face.pattern?.toneField.appearance.markings ?? [])
  .find((marking) => marking.id === 'face-coat');
assert.equal(
  faceCoat?.accentColor,
  '#68B8C7',
  'accent tone must carry the compiler palette accent material'
);
const finDots = [...baseAuthority.faces.values()]
  .flatMap((face) => face.pattern?.toneField.appearance.markings ?? [])
  .find((marking) => marking.id === 'fin-dots');
assert.ok(finDots?.reflection, 'paired surface configuration owns reflection');

const withoutBindings: ProjectDocument = {
  ...baseDocument,
  intent: baseDocument.intent ? {
    ...baseDocument.intent,
    appearanceBindings: []
  } : undefined
};
const torsoPartId = bindings.get('belly')?.partIds[0];
assert.ok(torsoPartId);
const isolated = createSurfaceAppearanceCompiler(withoutBindings, {
  min: { x: -32, y: -32, z: -32 },
  max: { x: 32, y: 32, z: 32 }
}).appearanceFor(torsoPartId, 'mass', 'south', 0, 'regular');
assert.deepEqual(
  isolated.markings,
  [],
  'part IDs and names cannot activate a mark without an explicit binding'
);

const bodyBinding = bindings.get('belly');
assert.ok(bodyBinding);
const baseMark = baseDocument.intent?.appearance?.markings.find(
  (marking) => marking.id === 'belly'
);
assert.ok(baseMark);
const classDocument = (reversed: boolean): ProjectDocument => {
  const markings = [
    { ...baseMark, id: 'z-wash', motif: 'wash' as const },
    {
      ...baseMark,
      id: 'a-band',
      motif: 'band' as const,
      flow: 'longitudinal' as const
    },
    { ...baseMark, id: 'm-patch', motif: 'patch' as const }
  ];
  const ordered = reversed ? [...markings].reverse() : markings;
  return {
    ...baseDocument,
    intent: baseDocument.intent ? {
      ...baseDocument.intent,
      appearance: baseDocument.intent.appearance ? {
        ...baseDocument.intent.appearance,
        markings: ordered
      } : undefined,
      appearanceBindings: ordered.map((marking) => ({
        markingId: marking.id,
        partIds: bodyBinding.partIds,
        faceScope: 'full' as const
      }))
    } : undefined
  };
};
const classPlan = (document: ProjectDocument) =>
  createSurfaceAppearanceCompiler(document, {
    min: { x: -32, y: -32, z: -32 },
    max: { x: 32, y: 32, z: 32 }
  }).appearanceFor(torsoPartId, 'mass', 'south', 0, 'regular').markings;
assert.deepEqual(classPlan(classDocument(false))?.map((marking) => marking.id), [
  'z-wash',
  'a-band',
  'm-patch'
]);
assert.deepEqual(classPlan(classDocument(true)), classPlan(classDocument(false)));
