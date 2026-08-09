import assert from 'node:assert/strict';

import { archetypeDefinitions } from '../../../src/authoring/catalog/archetype/definitions';
import { validateAuthoringCatalog } from '../../../src/authoring/catalog';
import { specialistDefinitions } from '../../../src/authoring/catalog/specialist/definitions';

const validBefore = JSON.stringify({
  archetypes: archetypeDefinitions,
  specialists: specialistDefinitions
});
assert.deepEqual(
  validateAuthoringCatalog(archetypeDefinitions, specialistDefinitions),
  [],
  'the registered immutable catalog passes every validation stage'
);
assert.equal(
  JSON.stringify({
    archetypes: archetypeDefinitions,
    specialists: specialistDefinitions
  }),
  validBefore,
  'catalog validation does not mutate its inputs'
);

const first = archetypeDefinitions[0];
assert.ok(first);
const invalidArchetypes = archetypeDefinitions.map((definition, index) =>
  index === 0
    ? {
        ...definition,
        version: 'invalid-version',
        label: '',
        facets: [...definition.facets, definition.facets[0]]
      }
    : definition
);
const invalidBefore = JSON.stringify(invalidArchetypes);
const firstIssues = validateAuthoringCatalog(
  invalidArchetypes,
  specialistDefinitions
);
const secondIssues = validateAuthoringCatalog(
  invalidArchetypes,
  specialistDefinitions
);
assert.deepEqual(secondIssues, firstIssues, 'validation stages are deterministic');
assert.deepEqual(
  firstIssues.map((issue) => [issue.code, issue.path]),
  [[
    'authoring.catalog.version_invalid',
    'archetypes[0].version'
  ], [
    'authoring.catalog.text_invalid',
    'archetypes[0]'
  ], [
    'authoring.catalog.taxonomy_duplicated',
    'archetypes[0]'
  ]],
  'definition diagnostics preserve their established stage and field order'
);
assert.equal(
  JSON.stringify(invalidArchetypes),
  invalidBefore,
  'invalid catalog inputs are not normalized or mutated while reading'
);

assert.deepEqual(
  validateAuthoringCatalog(null, specialistDefinitions),
  [{
    code: 'authoring.catalog.root_shape_invalid',
    path: 'catalog',
    message: 'Authoring catalog roots must both be arrays.'
  }]
);
assert.equal(
  validateAuthoringCatalog([null], specialistDefinitions)[0]?.code,
  'authoring.catalog.malformed_value',
  'malformed nested values stay contained at the public reader boundary'
);
