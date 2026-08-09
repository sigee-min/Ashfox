import assert from 'node:assert/strict';

import { PROJECT_APPEARANCE_SPECIFICATION } from '../../../src/project/appearance/contract';
import { parseIntentProgram } from '../../../src/project/program';
import {
  assertStatementDiagnostics,
  schemaSource,
  shape,
  validSchemaSource,
  type ExpectedStatementDiagnostic
} from './source';

const assertNestedHeaderSpan = (
  original: string,
  replacement: string,
  token: string
): void => {
  const source = validSchemaSource().replace(original, replacement);
  const headerOffset = source.indexOf(replacement.trimStart());
  const tokenOffset = source.indexOf(token, headerOffset);
  const prefix = source.slice(0, tokenOffset);
  const line = prefix.split('\n').length;
  const column = tokenOffset - prefix.lastIndexOf('\n');
  const diagnostic = parseIntentProgram(source).diagnostics.find((entry) =>
    entry.code === 'intent.invalid_model_block'
  );
  assert.equal(diagnostic?.span.start.offset, tokenOffset);
  assert.equal(diagnostic?.span.end.offset, tokenOffset + token.length);
  assert.equal(diagnostic?.span.start.line, line);
  assert.equal(diagnostic?.span.end.line, line);
  assert.equal(diagnostic?.span.start.column, column);
  assert.equal(diagnostic?.span.end.column, column + token.length);
};

for (const header of [
  { original: 'body {', replacement: 'body extra {', token: 'extra' },
  { original: 'face {', replacement: 'face extra {', token: 'extra' },
  {
    original: 'shape belly {', replacement: 'shape belly extra {',
    token: 'extra'
  },
  { original: 'shape belly {', replacement: 'shape {', token: 'shape' }
] as const) {
  assertNestedHeaderSpan(header.original, header.replacement, header.token);
}

for (const malformed of [
  {
    valid: 'track hero',
    statement: 'track banana extra',
    expected: [
      { token: 'banana', code: 'intent.invalid_track', field: 'track' },
      { token: 'extra', code: 'intent.unexpected_track_value', field: 'track' }
    ]
  },
  {
    valid: 'domain organism',
    statement: 'domain wrong extra',
    expected: [
      { token: 'wrong', code: 'intent.invalid_domain', field: 'domain' },
      { token: 'extra', code: 'intent.unexpected_domain_value', field: 'domain' }
    ]
  },
  {
    valid: 'symmetry bilateral',
    statement: 'symmetry radial extra',
    expected: [
      { token: 'radial', code: 'intent.invalid_symmetry', field: 'symmetry' },
      {
        token: 'extra',
        code: 'intent.unexpected_symmetry_value',
        field: 'symmetry'
      }
    ]
  },
  {
    valid: 'name "Schema fixture"',
    statement: 'name bare extra',
    expected: [
      {
        token: 'bare',
        code: 'intent.name_requires_quoted_string',
        field: 'name'
      },
      { token: 'extra', code: 'intent.unexpected_name_value', field: 'name' }
    ]
  },
  {
    valid: 'seed auto',
    statement: 'seed BAD extra',
    expected: [
      {
        token: 'BAD', code: 'intent.invalid_appearance_seed', field: 'seed'
      },
      {
        token: 'extra',
        code: 'intent.unexpected_appearance_seed_value',
        field: 'seed'
      }
    ]
  },
  {
    valid: 'palette ocean',
    statement: 'palette ultraviolet extra',
    expected: [
      {
        token: 'ultraviolet',
        code: 'intent.invalid_appearance_palette',
        field: 'palette'
      },
      {
        token: 'extra',
        code: 'intent.unexpected_appearance_palette_value',
        field: 'palette'
      }
    ]
  }
] as const) {
  assertStatementDiagnostics(
    validSchemaSource().replace(malformed.valid, malformed.statement),
    malformed.statement,
    malformed.expected
  );
}

const malformedFocal = 'focal 9bad on bad.id extra';
assertStatementDiagnostics(
  validSchemaSource().replace('  face {', `  ${malformedFocal}\n  face {`),
  malformedFocal,
  [
    { token: '9bad', code: 'intent.invalid_identifier', field: 'focal' },
    { token: 'on', code: 'intent.invalid_focal', field: 'focal' },
    { token: 'bad.id', code: 'intent.invalid_identifier', field: 'focal' },
    {
      token: 'extra', code: 'intent.unexpected_focal_value', field: 'unexpected'
    }
  ]
);

const malformedSurface =
  'surface bad banana nope parent 9bad anchor nowhere growth diagonal lane nowhere';
assertStatementDiagnostics(
  validSchemaSource().replace(
    '  surface belly single fin',
    `  ${malformedSurface}\n  surface belly single fin`
  ),
  malformedSurface,
  [
    { token: 'banana', code: 'intent.invalid_surface', field: 'cardinality' },
    { token: 'nope', code: 'intent.invalid_surface', field: 'role' },
    { token: '9bad', code: 'intent.invalid_surface', field: 'parent' },
    { token: 'nowhere', code: 'intent.invalid_surface', field: 'anchor' },
    { token: 'diagonal', code: 'intent.invalid_surface', field: 'growth' },
    { token: 'nowhere', code: 'intent.invalid_surface', field: 'lane' }
  ]
);

const malformedOrientation = 'orientation backward diagonal extra';
assertStatementDiagnostics(
  validSchemaSource().replace('orientation forward north', malformedOrientation),
  malformedOrientation,
  [
    {
      token: 'backward', code: 'intent.invalid_orientation_axis', field: 'axis'
    },
    {
      token: 'diagonal',
      code: 'intent.invalid_orientation_direction',
      field: 'forward'
    },
    {
      token: 'extra',
      code: 'intent.unexpected_orientation_value',
      field: 'unexpected'
    }
  ]
);

const malformedSupport = 'support feet links 9bad bad.id';
assertStatementDiagnostics(
  validSchemaSource().replace('support none', malformedSupport),
  malformedSupport,
  [
    { token: 'links', code: 'intent.invalid_support', field: 'support' },
    { token: '9bad', code: 'intent.invalid_identifier', field: 'support contact' },
    { token: 'bad.id', code: 'intent.invalid_identifier', field: 'support contact' }
  ]
);

const malformedSupportKind = 'support hovering links 9bad';
assertStatementDiagnostics(
  validSchemaSource().replace('support none', malformedSupportKind),
  malformedSupportKind,
  [
    { token: 'hovering', code: 'intent.invalid_support', field: 'support' },
    { token: 'links', code: 'intent.invalid_support', field: 'support' },
    {
      token: '9bad', code: 'intent.invalid_identifier',
      field: 'support contact'
    }
  ]
);

const malformedEyes = 'eyes triple look sideways extra';
assertStatementDiagnostics(
  schemaSource([
    'full parent head',
    malformedEyes,
    'nose absent',
    'mouth neutral'
  ], shape),
  malformedEyes,
  [
    {
      token: 'triple',
      code: 'intent.invalid_eye_configuration',
      field: 'configuration'
    },
    { token: 'look', code: 'intent.invalid_gaze_marker', field: 'gaze' },
    { token: 'sideways', code: 'intent.invalid_gaze', field: 'gaze' },
    {
      token: 'extra', code: 'intent.unexpected_eyes_value', field: 'unexpected'
    }
  ]
);

const malformedIdle = 'idle dance on 9bad extra';
assertStatementDiagnostics(
  validSchemaSource().replace('idle breathe target head', malformedIdle),
  malformedIdle,
  [
    { token: 'dance', code: 'intent.invalid_idle', field: 'mode' },
    {
      token: 'on', code: 'intent.invalid_idle_target_marker', field: 'target'
    },
    { token: '9bad', code: 'intent.invalid_identifier', field: 'target' },
    {
      token: 'extra', code: 'intent.unexpected_idle_value', field: 'unexpected'
    }
  ]
);

const malformedBody =
  'mass bad banana parent 9bad anchor nowhere growth diagonal lane nowhere';
assertStatementDiagnostics(
  validSchemaSource().replace(
    '    core torso',
    `    core torso\n    ${malformedBody}`
  ),
  malformedBody,
  [
    {
      token: 'banana',
      code: 'intent.invalid_body_relation',
      field: 'cardinality'
    },
    { token: '9bad', code: 'intent.invalid_body_relation', field: 'parent' },
    { token: 'nowhere', code: 'intent.invalid_body_relation', field: 'anchor' },
    { token: 'diagonal', code: 'intent.invalid_body_relation', field: 'growth' },
    { token: 'nowhere', code: 'intent.invalid_body_relation', field: 'lane' }
  ]
);

for (const relation of [
  {
    statement:
      'mass head paired parent torso anchor front growth forward lane center',
    token: 'paired', field: 'cardinality'
  },
  {
    statement:
      'mass head single parent torso anchor rear growth forward lane center',
    token: 'rear', field: 'anchor'
  },
  {
    statement:
      'mass head single parent torso anchor front growth rearward lane center',
    token: 'rearward', field: 'growth'
  }
] as const) {
  assertStatementDiagnostics(
    validSchemaSource().replace(
      'mass head single parent torso anchor front growth forward lane center',
      relation.statement
    ),
    relation.statement,
    [{
      token: relation.token,
      code: 'intent.invalid_body_attachment',
      field: relation.field
    }]
  );
}

for (const relation of [
  {
    statement:
      'surface belly paired fin parent torso anchor bottom growth down lane center',
    token: 'paired', field: 'cardinality'
  },
  {
    statement:
      'surface belly single fin parent torso anchor rear growth forward lane center',
    token: 'rear', field: 'anchor'
  },
  {
    statement:
      'surface belly single fin parent torso anchor front growth rearward lane upper',
    token: 'rearward', field: 'growth'
  }
] as const) {
  assertStatementDiagnostics(
    validSchemaSource().replace(
      'surface belly single fin parent torso anchor bottom growth down lane center',
      relation.statement
    ),
    relation.statement,
    [{
      token: relation.token,
      code: 'intent.invalid_surface_attachment',
      field: relation.field
    }]
  );
}

const excessSupport = 'support base contacts torso pedestal';
const excessSupportSource = validSchemaSource()
  .replace('domain organism', 'domain constructed')
  .replace('support none', excessSupport);
const excessContact = excessSupportSource.indexOf('pedestal');
const excessCardinality = parseIntentProgram(excessSupportSource)
  .diagnostics.find((entry) => entry.code === 'intent.invalid_support_cardinality');
assert.equal(excessCardinality?.span.start.offset, excessContact);
assert.equal(excessCardinality?.span.end.offset, excessContact + 'pedestal'.length);

const markingLimit = PROJECT_APPEARANCE_SPECIFICATION[
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.cardinality.maximum
];
const boundedMarkings = Array.from({ length: markingLimit + 1 }, (_, index) =>
  `mark mark-${index} target body torso region full placement whole ` +
  'as wash tone darker scale fine density sparse contrast subtle'
);
const boundedSource = validSchemaSource().replace(
  '  seed auto',
  ['  seed auto', ...boundedMarkings.map((entry) => `  ${entry}`)].join('\n')
);
const firstExcessId = `mark-${markingLimit}`;
const boundedDiagnostic = parseIntentProgram(boundedSource).diagnostics.find(
  (entry) => entry.code === 'intent.too_many_appearance_marks'
);
assert.equal(
  boundedDiagnostic?.span.start.offset,
  boundedSource.indexOf(firstExcessId)
);

const malformedTexture =
  'texture neon scale huge density packed contrast loud';
const textureDiagnostics: readonly ExpectedStatementDiagnostic[] = [
  {
    token: 'neon', code: 'intent.invalid_appearance_texture', field: 'kind'
  },
  {
    token: 'huge', code: 'intent.invalid_appearance_texture', field: 'scale'
  },
  {
    token: 'packed', code: 'intent.invalid_appearance_texture', field: 'density'
  },
  {
    token: 'loud', code: 'intent.invalid_appearance_texture', field: 'contrast'
  }
];
assert.deepEqual(
  textureDiagnostics.map((entry) => entry.schemaField ?? entry.field),
  PROJECT_APPEARANCE_SPECIFICATION.statements.texture.order
);
assertStatementDiagnostics(
  validSchemaSource().replace(
    '  texture mottle scale broad density balanced contrast subtle',
    `  texture mottle scale broad density balanced contrast subtle\n  ${malformedTexture}`
  ),
  malformedTexture,
  textureDiagnostics
);

const malformedMark = [
  'mark 9mark target body 9torso region nowhere placement nowhere',
  'as nope tone nope flow diagonal variant 9bad',
  'scale huge density packed contrast loud'
].join(' ');
const markDiagnostics: readonly ExpectedStatementDiagnostic[] = [
  {
    token: '9mark', code: 'intent.invalid_identifier', field: 'mark ID',
    schemaField: 'id'
  },
  {
    token: '9torso', code: 'intent.invalid_identifier', field: 'target ID',
    schemaField: 'target'
  },
  {
    token: 'nowhere', code: 'intent.invalid_appearance_mark', field: 'region'
  },
  {
    token: 'nowhere', code: 'intent.invalid_appearance_mark', field: 'placement'
  },
  { token: 'nope', code: 'intent.invalid_appearance_mark', field: 'motif' },
  { token: 'nope', code: 'intent.invalid_appearance_mark', field: 'tone' },
  {
    token: 'diagonal', code: 'intent.invalid_appearance_mark', field: 'flow'
  },
  { token: '9bad', code: 'intent.invalid_identifier', field: 'variant' },
  { token: 'huge', code: 'intent.invalid_appearance_mark', field: 'scale' },
  {
    token: 'packed', code: 'intent.invalid_appearance_mark', field: 'density'
  },
  {
    token: 'loud', code: 'intent.invalid_appearance_mark', field: 'contrast'
  }
];
assert.deepEqual(
  markDiagnostics.map((entry) => entry.schemaField ?? entry.field),
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.order
);
assertStatementDiagnostics(
  validSchemaSource().replace('  seed auto', `  seed auto\n  ${malformedMark}`),
  malformedMark,
  markDiagnostics
);
