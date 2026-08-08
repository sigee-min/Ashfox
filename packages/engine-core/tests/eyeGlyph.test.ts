import assert from 'node:assert/strict';

import {
  eyeGlyphPixelRole,
  type EyeGlyphPixelRole,
  type EyePupilBias
} from '../src/modeling/eyeGlyph';
import {
  paintEyeMotifPixel,
  paintFeatureMotifPixel
} from '../src';
import type { ModelEyeGlyph } from '../src/model';

const roles = (
  glyph: ModelEyeGlyph,
  width: number,
  height: number,
  bias: EyePupilBias
): readonly (EyeGlyphPixelRole | null)[] =>
  Array.from({ length: width * height }, (_, index) =>
    eyeGlyphPixelRole(
      glyph,
      index % width,
      Math.floor(index / width),
      width,
      height,
      bias
    )
  );

const pupilColumns = (
  glyph: ModelEyeGlyph,
  width: number,
  height: number,
  bias: EyePupilBias
): readonly number[] => [
  ...new Set(roles(glyph, width, height, bias).flatMap((role, index) =>
    role === 'pupil' ? [index % width] : []
  ))
];

for (const glyph of ['square', 'slit'] as const) {
  assert.deepEqual(
    roles(glyph, 3, 3, -1),
    roles(glyph, 3, 3, 0),
    `${glyph} must ignore horizontal bias when an odd width has one exact center`
  );
  assert.deepEqual(
    roles(glyph, 3, 3, 1),
    roles(glyph, 3, 3, 0),
    `${glyph} must keep the same exact center for either odd-width bias`
  );
  assert.deepEqual(pupilColumns(glyph, 3, 3, -1), [1]);
  assert.deepEqual(pupilColumns(glyph, 3, 3, 1), [1]);

  assert.deepEqual(pupilColumns(glyph, 4, 3, -1), [1]);
  assert.deepEqual(pupilColumns(glyph, 4, 3, 1), [2]);
  assert.deepEqual(
    pupilColumns(glyph, 4, 3, 0),
    [1, 2],
    `${glyph} must keep both central columns for an unbiased even-width eye`
  );

  const left = roles(glyph, 4, 3, -1);
  const right = roles(glyph, 4, 3, 1);
  const unbiased = roles(glyph, 4, 3, 0);
  for (let y = 0; y < 3; y += 1) {
    for (let x = 0; x < 4; x += 1) {
      assert.equal(
        left[y * 4 + x],
        right[y * 4 + (3 - x)],
        `${glyph} negative and positive bias templates must be exact mirrors`
      );
      assert.equal(
        unbiased[y * 4 + x],
        unbiased[y * 4 + (3 - x)],
        `${glyph} unbiased even-width template must be self-symmetric`
      );
    }
  }

  const minimumRoles = new Set(roles(glyph, 3, 3, 0));
  assert.ok(minimumRoles.has('sclera'));
  assert.ok(minimumRoles.has('iris'));
  assert.ok(minimumRoles.has('pupil'));
}

assert.ok(
  new Set(roles('square', 5, 3, 0)).has('outline'),
  'a wide eye must reserve an explicit outline role'
);

for (const extreme of [{
  name: 'black',
  color: { r: 0, g: 0, b: 0 }
}, {
  name: 'white',
  color: { r: 255, g: 255, b: 255 }
}] as const) {
  const sclera = paintEyeMotifPixel(
    extreme.color,
    0,
    0,
    3,
    3,
    'square'
  );
  const iris = paintEyeMotifPixel(
    extreme.color,
    0,
    1,
    3,
    3,
    'square'
  );
  const pupil = paintEyeMotifPixel(
    extreme.color,
    1,
    1,
    3,
    3,
    'square'
  );
  assert.ok(sclera && iris && pupil);
  assert.ok(
    sclera.r > 220 && sclera.g > 220 && sclera.b > 220,
    `sclera must remain white-ish for an authored ${extreme.name} iris`
  );
  assert.ok(
    iris.r > pupil.r && iris.g > pupil.g && iris.b > pupil.b,
    `${extreme.name} iris and pupil must retain luminance contrast`
  );
  assert.ok(
    sclera.r - iris.r >= 50 &&
    sclera.g - iris.g >= 50 &&
    sclera.b - iris.b >= 50,
    `${extreme.name} iris and sclera must retain compiler-owned contrast`
  );
  assert.notDeepEqual(sclera, iris);
  assert.notDeepEqual(iris, pupil);
}

const blackIris = { r: 0, g: 0, b: 0 };
assert.deepEqual(
  paintEyeMotifPixel(blackIris, 0, 1, 5, 3, 'square'),
  paintEyeMotifPixel(blackIris, 2, 1, 5, 3, 'square'),
  'outline and pupil must share the deliberately dark focal tone'
);

const gold = { r: 230, g: 167, b: 47 };
assert.deepEqual(
  paintEyeMotifPixel(gold, 1, 1, 4, 3, 'square', -1),
  paintFeatureMotifPixel(
    'eye',
    gold,
    1,
    1,
    4,
    3,
    'square',
    -1
  ),
  'the generic focal painter must forward eye pupil bias unchanged'
);
assert.notDeepEqual(
  paintFeatureMotifPixel('eye', gold, 1, 1, 4, 3, 'square', -1),
  paintFeatureMotifPixel('eye', gold, 1, 1, 4, 3, 'square', 1),
  'opposite even-width biases must move the dark pupil between center columns'
);
