import assert from 'node:assert/strict';

import {
  PART_CONTRACT_LIMITS,
  type FeaturePartSpec,
  type PartSpec
} from '../../../src/modeling/part';
import {
  projectCompiledFeaturesMeasured
} from '../../../src/modeling/part/projection';

const root: PartSpec = {
  kind: 'mass',
  partId: 'root',
  parentPartId: null,
  materialId: 'base',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [0, 0, 0],
  radii: [1, 1, 1],
  profile: 'block'
};
const featureCount = PART_CONTRACT_LIMITS.maxPartsPerDocument - 1;
const authored: readonly FeaturePartSpec[] = Array.from(
  { length: featureCount },
  (_, index): FeaturePartSpec => ({
    kind: 'feature',
    partId: `patch.${index}`,
    parentPartId: 'root',
    materialId: 'accent',
    joint: { kind: 'fixed' },
    attachment: null,
    motif: 'patch',
    face: 'south',
    anchor: [index, 0, 1],
    size: [1, 1]
  })
);
const projected = [...authored].reverse().map((part) => ({
  ...part,
  anchor: [part.anchor[0], 1, part.anchor[2]] as const
}));
const input: readonly PartSpec[] = [root, ...authored];
const snapshot = JSON.stringify({ input, projected });

const measured = projectCompiledFeaturesMeasured(input, projected);
const repeated = projectCompiledFeaturesMeasured(input, projected);
let referenceComparisons = 0;
const reference = input.map((part) => part.kind !== 'feature'
  ? part
  : projected.find((feature) => {
      referenceComparisons += 1;
      return feature.partId === part.partId;
    }) ?? part
);

assert.deepEqual(measured, repeated, 'projection is deterministic');
assert.deepEqual(measured.parts, reference, 'indexed projection retains exact output');
assert.equal(JSON.stringify({ input, projected }), snapshot, 'inputs stay immutable');
assert.deepEqual(measured.metric, {
  indexedFeatures: featureCount,
  featureLookups: featureCount
}, 'maximum-size reverse order remains linear in parts plus features');
assert.equal(
  referenceComparisons,
  featureCount * (featureCount + 1) / 2,
  'the replaced reverse-order scan is measurably quadratic'
);
assert.equal(measured.parts[0], root, 'geometry retains its input identity');

const duplicateFirst = { ...authored[0], anchor: [1, 1, 1] as const };
const duplicateSecond = { ...authored[0], anchor: [2, 2, 2] as const };
const duplicate = projectCompiledFeaturesMeasured(
  [authored[0]],
  [duplicateFirst, duplicateSecond]
);
assert.equal(
  duplicate.parts[0],
  duplicateFirst,
  'the first duplicate retains the previous Array.find behavior'
);
