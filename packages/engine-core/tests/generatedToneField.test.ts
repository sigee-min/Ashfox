import assert from 'node:assert/strict';

import {
  generatedToneRole,
  generatedToneScore,
  type PixelToneRole
} from '../src';
import {
  buildGeneratedSurfaceToneField,
  type GeneratedSurfaceTonePolicy
} from '../src/textures/generatedToneField';
import {
  buildSurfacePatternComponents,
  type SurfacePatternComponent,
  type SurfacePatternDraft
} from '../src/textures/surfacePatternComponents';

interface SurfaceCell {
  x: number;
  y: number;
}

const cellDrafts = (
  cells: readonly SurfaceCell[],
  groupKey: string
): SurfacePatternDraft[] => cells.map((cell, index) => ({
  id: `cell-${index}`,
  groupKey,
  x: cell.x,
  y: cell.y,
  width: 1,
  height: 1
}));

const oneComponent = (
  drafts: readonly SurfacePatternDraft[]
): SurfacePatternComponent => {
  const components = buildSurfacePatternComponents(drafts);
  const unique = [...new Set(components.values())];
  assert.equal(unique.length, 1, 'shape must form one surface component');
  const component = unique[0];
  if (!component) throw new Error('Surface component is missing.');
  return component;
};

const roleCounts = (
  component: SurfacePatternComponent,
  policy: GeneratedSurfaceTonePolicy
): Record<PixelToneRole, number> => {
  const field = buildGeneratedSurfaceToneField(component, policy);
  const counts: Record<PixelToneRole, number> = {
    shadow: 0,
    base: 0,
    light: 0
  };
  for (const span of component.occupiedSpans) {
    for (let x = span.x; x < span.x + span.width; x += 1) {
      const score = generatedToneScore(
        x - component.bounds.x,
        span.y - component.bounds.y,
        field.rect,
        field.config
      );
      counts[generatedToneRole(score, field.cutoffs)] += 1;
    }
  }
  return counts;
};

const cellsIn = (
  width: number,
  height: number,
  include: (x: number, y: number) => boolean
): SurfaceCell[] => {
  const cells: SurfaceCell[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (include(x, y)) cells.push({ x, y });
    }
  }
  return cells;
};

const size = 33;
const shapes = new Map<string, readonly SurfaceCell[]>([
  ['anti-diagonal', cellsIn(size, size, (x, y) =>
    Math.abs(x + y - (size - 1)) <= 1
  )],
  ['l-shape', cellsIn(size, size, (x, y) => x === 0 || y === 0)],
  ['u-shape', cellsIn(size, size, (x, y) =>
    x === 0 || x === size - 1 || y === size - 1
  )],
  ['ring', cellsIn(size, size, (x, y) =>
    x === 0 || x === size - 1 || y === 0 || y === size - 1
  )],
  ['staircase', cellsIn(size, 18, (x, y) =>
    Math.abs(y - Math.floor(x / 2)) <= 1
  )]
]);

for (const [shapeName, cells] of shapes) {
  for (const policy of ['regular', 'focal'] as const) {
    for (let seedIndex = 0; seedIndex < 4; seedIndex += 1) {
      const component = oneComponent(cellDrafts(
        cells,
        `tone:${shapeName}:${policy}:${seedIndex}`
      ));
      assert.ok(component.texelCount >= 64);
      const counts = roleCounts(component, policy);
      assert.ok(
        counts.base / component.texelCount <= 0.5,
        `${shapeName} ${policy} surface must not collapse to base`
      );
      assert.ok(
        counts.shadow / component.texelCount >= 0.12 &&
        counts.light / component.texelCount >= 0.12,
        `${shapeName} ${policy} surface must preserve both shade roles`
      );
    }
  }
}

const wholeRectangle = oneComponent([{
  id: 'whole',
  groupKey: 'tone:partition:regular',
  x: 0,
  y: 0,
  width: 32,
  height: 32
}]);
const splitRectangle = oneComponent([
  { id: 'nw', x: 0, y: 0, width: 16, height: 16 },
  { id: 'ne', x: 16, y: 0, width: 16, height: 16 },
  { id: 'sw', x: 0, y: 16, width: 16, height: 16 },
  { id: 'se', x: 16, y: 16, width: 16, height: 16 }
].map((draft) => ({
  ...draft,
  groupKey: 'tone:partition:regular'
})));
assert.deepEqual(
  splitRectangle,
  wholeRectangle,
  'component mask authority must be invariant to cuboid partitioning'
);
assert.deepEqual(
  buildGeneratedSurfaceToneField(splitRectangle, 'regular'),
  buildGeneratedSurfaceToneField(wholeRectangle, 'regular'),
  'tone cutoffs must be invariant to cuboid partitioning'
);

const staircase = shapes.get('staircase') ?? [];
const orderedStaircase = oneComponent(cellDrafts(
  staircase,
  'tone:order:focal'
));
const reversedStaircase = oneComponent(cellDrafts(
  [...staircase].reverse(),
  'tone:order:focal'
));
assert.deepEqual(
  reversedStaircase,
  orderedStaircase,
  'component mask authority must ignore input member order'
);
assert.deepEqual(
  buildGeneratedSurfaceToneField(reversedStaircase, 'focal'),
  buildGeneratedSurfaceToneField(orderedStaircase, 'focal'),
  'tone cutoffs must ignore input member order'
);
