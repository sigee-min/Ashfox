import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  authoringReviewChecks,
  createAuthoringProfile,
  createProjectFromInput,
  evaluateAuthoringCompatibility,
  evaluateAuthoringPlan,
  executeSystemCommandBatch,
  getAuthoringRecipe,
  getCommandDefinition,
  listArchetypes,
  listAuthoringRecipes,
  listSpecialists,
  normalizeAuthoringProfile,
  resolveArchetypeReference,
  resolveSpecialistReference,
  validateAuthoringCatalog,
  type ArchetypeDefinition,
  type AuthoringProfile,
  type AuthoringSelectionInput,
  type ProjectDocument,
  type SpecialistDefinition
} from '../src';

const catalogIssues = validateAuthoringCatalog(
  listArchetypes(),
  listSpecialists()
);
assert.deepEqual(catalogIssues, []);
assert.equal(listArchetypes().length, 4);
assert.equal(listSpecialists().length, 10);
assert.ok(listSpecialists().every((definition) =>
  !('kind' in definition) && !('attachmentPorts' in definition)
));
assert.equal(resolveArchetypeReference({
  id: 'archetype.mini-biped'
}), undefined);
assert.equal(resolveSpecialistReference({
  id: 'specialist.static-loop'
}), undefined);
assert.equal(resolveArchetypeReference({
  id: 'archetype.mini-biped',
  version: 2
}), undefined);

const cloneArchetypes = (): ArchetypeDefinition[] =>
  structuredClone(listArchetypes()) as ArchetypeDefinition[];
const cloneSpecialists = (): SpecialistDefinition[] =>
  structuredClone(listSpecialists()) as SpecialistDefinition[];

const cyclicArchetypes = cloneArchetypes();
const cyclic = cyclicArchetypes[0];
if (!cyclic) throw new Error('Expected archetype fixture.');
cyclicArchetypes[0] = {
  ...cyclic,
  semanticSlots: cyclic.semanticSlots.map((slot) => {
    if (slot.id === 'body.head') {
      return { ...slot, parentSlotIds: ['body.face'] };
    }
    if (slot.id === 'body.face') {
      return { ...slot, parentSlotIds: ['body.head'] };
    }
    return slot;
  })
};
assert.ok(validateAuthoringCatalog(
  cyclicArchetypes,
  listSpecialists()
).some((issue) => issue.code === 'authoring.catalog.slot_cycle'));

const nonFiniteArchetypes = cloneArchetypes();
const nonFinite = nonFiniteArchetypes[0];
if (!nonFinite) throw new Error('Expected archetype fixture.');
nonFiniteArchetypes[0] = {
  ...nonFinite,
  semanticSlots: nonFinite.semanticSlots.map((slot, index) =>
    index === 0 ? { ...slot, minParts: Number.NaN } : slot
  )
};
assert.ok(validateAuthoringCatalog(
  nonFiniteArchetypes,
  listSpecialists()
).some((issue) =>
  issue.code === 'authoring.catalog.slot_cardinality_invalid'
));

const topologySpecialists = cloneSpecialists();
const topology = topologySpecialists[0];
if (!topology) throw new Error('Expected specialist fixture.');
topologySpecialists[0] = {
  ...topology,
  contributions: topology.contributions.map((contribution, index) =>
    index === 0
      ? ({
          ...contribution,
          parentSlotIds: ['body.torso']
        } as unknown as typeof contribution)
      : contribution
  )
};
assert.ok(validateAuthoringCatalog(
  listArchetypes(),
  topologySpecialists
).some((issue) =>
  issue.code === 'authoring.catalog.contribution_shape_invalid'
));

const invalidClauseSpecialists = cloneSpecialists();
const invalidClause = invalidClauseSpecialists[0];
if (!invalidClause) throw new Error('Expected specialist fixture.');
invalidClauseSpecialists[0] = {
  ...invalidClause,
  compatibility: [{
    op: 'includes',
    path: 'selection.specialistIds',
    value: 'not-real'
  } as unknown as SpecialistDefinition['compatibility'][number]]
};
assert.ok(validateAuthoringCatalog(
  listArchetypes(),
  invalidClauseSpecialists
).some((issue) => issue.code === 'authoring.catalog.clause_invalid'));

const duplicateRequirementSpecialists = cloneSpecialists();
const attachmentSpecialist = duplicateRequirementSpecialists.find(
  (definition) => definition.attachmentRequirements.length > 0
);
if (!attachmentSpecialist) {
  throw new Error('Expected attachment specialist fixture.');
}
attachmentSpecialist.attachmentRequirements = [
  ...attachmentSpecialist.attachmentRequirements,
  attachmentSpecialist.attachmentRequirements[0]
];
assert.ok(validateAuthoringCatalog(
  listArchetypes(),
  duplicateRequirementSpecialists
).some((issue) =>
  issue.code === 'authoring.catalog.requirement_duplicated'
));

const duplicateMotionSpecialists = cloneSpecialists();
const motionSpecialist = duplicateMotionSpecialists.find(
  (definition) => definition.bindingRequirements.length > 0
);
if (!motionSpecialist) throw new Error('Expected motion specialist fixture.');
motionSpecialist.bindingRequirements = [
  ...motionSpecialist.bindingRequirements,
  motionSpecialist.bindingRequirements[0]
];
assert.ok(validateAuthoringCatalog(
  listArchetypes(),
  duplicateMotionSpecialists
).some((issue) =>
  issue.code === 'authoring.catalog.binding_requirement_duplicated'
));

assert.deepEqual(
  listAuthoringRecipes().map((recipe) => recipe.id),
  [
    'recipe.creeper',
    'recipe.mechanic',
    'recipe.quadruped-companion',
    'recipe.mechanical-quadruped',
    'recipe.compact-construct'
  ]
);
assert.ok(listAuthoringRecipes().every((recipe) =>
  recipe.role === 'non-authoritative'
));
assert.ok(Object.isFrozen(listAuthoringRecipes()));
assert.ok(Object.isFrozen(getAuthoringRecipe('recipe.mechanic')));
assert.ok(Object.isFrozen(
  getAuthoringRecipe('recipe.mechanic')?.bindingSuggestions
));
assert.doesNotThrow(() => validateAuthoringCatalog('malformed', []));
assert.ok(validateAuthoringCatalog('malformed', []).length > 0);
const malformedNested = cloneArchetypes();
malformedNested[0] = {
  ...malformedNested[0],
  semanticSlots: 'malformed'
} as unknown as ArchetypeDefinition;
assert.doesNotThrow(() => validateAuthoringCatalog(
  malformedNested,
  cloneSpecialists()
));
assert.ok(validateAuthoringCatalog(
  malformedNested,
  cloneSpecialists()
).length > 0);

const execute = (
  document: ProjectDocument,
  batchId: string,
  operations: Parameters<typeof executeSystemCommandBatch>[1]['operations']
): ProjectDocument => {
  const result = executeSystemCommandBatch(document, {
    batchId,
    baseProjectId: document.id,
    baseRevision: document.revision,
    operations
  });
  if (!result.ok) {
    throw new Error(
      `${result.error.code}: ${result.error.message} at ` +
      `${result.error.path ?? '-'}`
    );
  }
  return result.document;
};

const base = createProjectFromInput({
  id: 'authoring-authority-contract',
  name: 'Authoring authority contract',
  target: 'geckolib5',
  namespace: 'ashfox',
  modelPath: 'authoring_authority_contract',
  createdAt: '2026-08-06T00:00:00.000Z'
}, 'authoring-0001');
const intended = execute(base, 'authoring-intent', [{
  name: 'project.intent.set',
  payload: {
    subject: 'Compact workshop character',
    grounding: 'grounded',
    features: ['One practical tool'],
    references: [{
      id: 'reference.front',
      kind: 'image',
      description: 'Front reference',
      cues: ['large head', 'compact tool'],
      contentHash: 'sha256:reference-front'
    }]
  }
}]);
const recipe = getAuthoringRecipe('recipe.mechanic');
if (!recipe) throw new Error('Expected recipe fixture.');
const selection: AuthoringSelectionInput = {
  archetype: recipe.archetype,
  specialists: recipe.specialists,
  claims: recipe.claimSuggestions,
  slots: recipe.slotSuggestions,
  bindings: recipe.bindingSuggestions
};
const created = createAuthoringProfile(intended, selection);
assert.equal(created.ok, true);
if (!created.ok) throw new Error(created.issues[0]?.message);
assert.equal(evaluateAuthoringCompatibility(created.profile).compatible, true);

const configured = execute(intended, 'configure-authoring', [{
  name: 'project.authoring.configure',
  payload: selection
}]);
assert.deepEqual(configured.authoringProfile, created.profile);
const plan = evaluateAuthoringPlan(configured);
assert.equal(plan.profileValid, true);
assert.ok(plan.issues.some((issue) =>
  issue.code === 'authoring.plan.slot_incomplete'
));
assert.ok(plan.issues.some((issue) =>
  issue.code === 'authoring.plan.attachment_incomplete'
));
assert.ok(plan.issues.some((issue) =>
  issue.code === 'authoring.plan.motion_clip_missing'
));

const reversedProfile: AuthoringProfile = {
  ...created.profile,
  specialists: [...created.profile.specialists].reverse(),
  bindings: [...created.profile.bindings].reverse()
};
assert.deepEqual(
  evaluateAuthoringCompatibility(reversedProfile),
  evaluateAuthoringCompatibility(created.profile),
  'compatibility must not depend on specialist or binding order'
);

const missingVersion = structuredClone(created.profile) as unknown as {
  archetype: { id: string; version?: number };
};
delete missingVersion.archetype.version;
assert.equal(normalizeAuthoringProfile(missingVersion, intended).ok, false);

for (const collection of [
  'specialists',
  'claims',
  'slots',
  'bindings'
] as const) {
  const sparseProfile = structuredClone(created.profile) as unknown as Record<
    typeof collection,
    unknown
  >;
  sparseProfile[collection] = new Array(1);
  assert.equal(
    normalizeAuthoringProfile(sparseProfile, intended).ok,
    false,
    `${collection} must be a dense contract array`
  );
}

const invalidObserved = createAuthoringProfile(intended, {
  ...selection,
  claims: selection.claims.map((claim, index) =>
    index === 0
      ? {
          ...claim,
          basis: 'observed' as const,
          referenceIds: ['reference.missing']
        }
      : claim
  )
});
assert.equal(invalidObserved.ok, false);
if (!invalidObserved.ok) {
  assert.ok(invalidObserved.issues.some((issue) =>
    issue.path.endsWith('.referenceIds')
  ));
}

const invalidRequested = createAuthoringProfile(intended, {
  ...selection,
  claims: selection.claims.map((claim, index) =>
    index === 0
      ? { ...claim, referenceIds: ['intent.features.99'] }
      : claim
  )
});
assert.equal(invalidRequested.ok, false);

const wrongCriterion = createAuthoringProfile(intended, {
  ...selection,
  claims: selection.claims.map((claim) =>
    claim.authority.id === 'specialist.role-props'
      ? { ...claim, criterionId: 'criterion.body-plan' }
      : claim
  )
});
assert.equal(wrongCriterion.ok, false);
if (!wrongCriterion.ok) {
  assert.ok(wrongCriterion.issues.some((issue) =>
    issue.path.endsWith('.criterionId')
  ));
}

const missingCriterion = createAuthoringProfile(intended, {
  ...selection,
  claims: selection.claims.filter((claim) =>
    claim.authority.id !== 'specialist.role-props'
  )
});
assert.equal(missingCriterion.ok, false);

const invalidHost = createAuthoringProfile(intended, {
  ...selection,
  bindings: selection.bindings.map((binding) =>
    binding.type === 'attachment'
      ? { ...binding, hostSlotId: 'body.head' }
      : binding
  )
});
assert.equal(invalidHost.ok, false);

const command = getCommandDefinition('project.authoring.configure');
assert.ok(command);
assert.ok(command?.validate({
  ...selection,
  archetype: 'archetype.mini-biped'
}));

const idleChecks = authoringReviewChecks(
  created.profile,
  'perspective',
  { clipId: 'idle' }
);
assert.ok(idleChecks.some((check) =>
  check.authority.id === 'specialist.static-loop'
));
assert.ok(idleChecks.every((check) =>
  check.authority.id !== 'specialist.alternating-gait'
));

const sourceRoot = path.resolve(__dirname, '../src');
const sourceFiles = (directory: string): readonly string[] =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(absolute)
      : entry.isFile() && entry.name.endsWith('.ts')
        ? [absolute]
        : [];
  });
const compilerAndReadinessSources = sourceFiles(sourceRoot).filter((file) =>
  file.includes(`${path.sep}commands${path.sep}`) ||
  file.includes(`${path.sep}modeling${path.sep}`) ||
  file.includes(`${path.sep}productionReadiness${path.sep}`)
);
for (const file of compilerAndReadinessSources) {
  assert.doesNotMatch(
    fs.readFileSync(file, 'utf8'),
    /authoringRecipes/,
    `authoritative runtime must not import non-authoritative recipes: ${file}`
  );
}
const recipeSource = fs.readFileSync(
  path.join(sourceRoot, 'authoring', 'authoringRecipes.ts'),
  'utf8'
);
assert.doesNotMatch(
  recipeSource,
  /PartAuthoringSpec|ConstrainedModelRecipe/,
  'authoring recipes may suggest selections but may not generate model/compiler input'
);
assert.doesNotMatch(
  recipeSource,
  /version:\s*1\b/,
  'recipe references must use the central authoring profile version authority'
);
for (const file of [
  path.join(sourceRoot, 'model.ts'),
  ...sourceFiles(path.join(sourceRoot, 'commands')),
  ...sourceFiles(path.join(sourceRoot, 'authoring'))
]) {
  assert.doesNotMatch(
    fs.readFileSync(file, 'utf8'),
    /AuthoringAssembly|authoring\.assembly|project\.assembly/,
    `Assembly must remain outside the v1 runtime boundary: ${file}`
  );
}
for (const file of [
  path.join(sourceRoot, 'authoring', 'archetypeDefinitions.ts'),
  path.join(sourceRoot, 'authoring', 'specialistDefinitions.ts')
]) {
  assert.doesNotMatch(
    fs.readFileSync(file, 'utf8'),
    /creeper|mechanic|mechanical-quadruped/i,
    `concrete recipe names must not enter authority catalogs: ${file}`
  );
}
