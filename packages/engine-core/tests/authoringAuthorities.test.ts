import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  AUTHORING_PROFILE_SCHEMA_VERSION,
  AUTHORING_QUALITY_STAGES,
  AUTHORING_STRUCTURAL_ROLES,
  AUTHORING_TRACK_POLICIES,
  AUTHORING_TRACKS,
  authoringReviewChecks,
  createAuthoringProfile,
  createProjectFromInput,
  evaluateAuthoringCompatibility,
  evaluateIntentCoverage,
  evaluateAuthoringPlan,
  executeAgentCommandBatch,
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
  type PartSpec,
  type ProjectDocument,
  type SpecialistDefinition
} from '../src';

const catalogIssues = validateAuthoringCatalog(
  listArchetypes(),
  listSpecialists()
);
assert.deepEqual(catalogIssues, []);
assert.equal(listArchetypes().length, 1);
assert.equal(listSpecialists().length, 9);
assert.equal(AUTHORING_PROFILE_SCHEMA_VERSION, 1);
assert.deepEqual(AUTHORING_STRUCTURAL_ROLES, [
  'core',
  'axis',
  'articulated',
  'span',
  'focal-frame',
  'accent'
]);
assert.deepEqual(AUTHORING_QUALITY_STAGES, [
  'silhouette',
  'structure',
  'focal'
]);
assert.deepEqual(AUTHORING_TRACKS, ['essential', 'hero']);
assert.deepEqual(Object.keys(AUTHORING_TRACK_POLICIES), AUTHORING_TRACKS);
assert.deepEqual(
  AUTHORING_TRACK_POLICIES.essential.requiredQualityStages,
  ['silhouette', 'structure']
);
assert.equal(
  AUTHORING_TRACK_POLICIES.essential.requireExclusiveCoverageTarget,
  false
);
assert.deepEqual(
  AUTHORING_TRACK_POLICIES.hero.requiredQualityStages,
  ['silhouette', 'structure', 'focal']
);
assert.equal(
  AUTHORING_TRACK_POLICIES.hero.requireExclusiveCoverageTarget,
  true
);
assert.ok(listSpecialists().every((definition) =>
  !('kind' in definition) && !('attachmentPorts' in definition)
));
assert.equal(resolveArchetypeReference({
  id: 'archetype.composable-form'
}), undefined);
assert.equal(resolveSpecialistReference({
  id: 'specialist.static-loop'
}), undefined);
assert.equal(resolveArchetypeReference({
  id: 'archetype.composable-form',
  version: 2
}), undefined);
assert.ok(resolveArchetypeReference({
  id: 'archetype.composable-form',
  version: 1
}));

const composableForm = resolveArchetypeReference({
  id: 'archetype.composable-form',
  version: AUTHORING_PROFILE_SCHEMA_VERSION
});
if (!composableForm) throw new Error('Expected composable form archetype.');
assert.ok(!('semanticSlots' in composableForm));
assert.deepEqual(
  new Set(composableForm.structuralRolePolicies.map((policy) => policy.role)),
  new Set(AUTHORING_STRUCTURAL_ROLES)
);
assert.deepEqual(
  new Set(composableForm.structuralRolePolicies.flatMap(
    (policy) => policy.allowedQualityStages
  )),
  new Set(AUTHORING_QUALITY_STAGES)
);
const spanPolicy = composableForm.structuralRolePolicies.find(
  (policy) => policy.role === 'span'
);
if (!spanPolicy) throw new Error('Expected span role policy.');
assert.deepEqual(spanPolicy.acceptedPartKinds, ['segment', 'plate']);
assert.deepEqual(spanPolicy.allowedQualityStages, [
  'silhouette',
  'structure'
]);
assert.ok(composableForm.attachmentPorts.every((port) =>
  !('hostSlotIds' in port) && port.hostStructuralRoles.length > 0
));

const cloneArchetypes = (): ArchetypeDefinition[] =>
  structuredClone(listArchetypes()) as ArchetypeDefinition[];
const cloneSpecialists = (): SpecialistDefinition[] =>
  structuredClone(listSpecialists()) as SpecialistDefinition[];

const invalidStructuralRoleArchetypes = cloneArchetypes();
const invalidStructuralRole = invalidStructuralRoleArchetypes[0];
if (!invalidStructuralRole) throw new Error('Expected archetype fixture.');
invalidStructuralRoleArchetypes[0] = {
  ...invalidStructuralRole,
  structuralRolePolicies: invalidStructuralRole.structuralRolePolicies.map(
    (policy, index) =>
    index === 0
      ? ({ ...policy, role: 'subject-specific' } as unknown as typeof policy)
      : policy
  )
};
assert.ok(validateAuthoringCatalog(
  invalidStructuralRoleArchetypes,
  listSpecialists()
).some((issue) => issue.code === 'authoring.catalog.role_policy_value_invalid'));

const invalidQualityStageArchetypes = cloneArchetypes();
const invalidQualityStage = invalidQualityStageArchetypes[0];
if (!invalidQualityStage) throw new Error('Expected archetype fixture.');
invalidQualityStageArchetypes[0] = {
  ...invalidQualityStage,
  structuralRolePolicies: invalidQualityStage.structuralRolePolicies.map(
    (policy, index) =>
    index === 0
      ? ({
          ...policy,
          allowedQualityStages: ['surface']
        } as unknown as typeof policy)
      : policy
  )
};
assert.ok(validateAuthoringCatalog(
  invalidQualityStageArchetypes,
  listSpecialists()
).some((issue) => issue.code === 'authoring.catalog.role_policy_value_invalid'));

const topologySpecialists = cloneSpecialists();
const topology = topologySpecialists[0];
if (!topology) throw new Error('Expected specialist fixture.');
topologySpecialists[0] = {
  ...topology,
  contributions: topology.contributions.map((contribution, index) =>
    index === 0
      ? ({
          ...contribution,
          structuralRole: 'span'
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
    op: 'forbids',
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
  ['recipe.composable-form']
);
assert.ok(listAuthoringRecipes().every((recipe) =>
  recipe.role === 'non-authoritative'
));
assert.ok(Object.isFrozen(listAuthoringRecipes()));
assert.ok(Object.isFrozen(getAuthoringRecipe('recipe.composable-form')));
assert.ok(Object.isFrozen(
  getAuthoringRecipe('recipe.composable-form')?.bindingSuggestions
));
assert.doesNotThrow(() => validateAuthoringCatalog('malformed', []));
assert.ok(validateAuthoringCatalog('malformed', []).length > 0);
const malformedNested = cloneArchetypes();
malformedNested[0] = {
  ...malformedNested[0],
  structuralRolePolicies: 'malformed'
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
const recipe = getAuthoringRecipe('recipe.composable-form');
if (!recipe) throw new Error('Expected recipe fixture.');
const roleProps = {
  id: 'specialist.role-props',
  version: AUTHORING_PROFILE_SCHEMA_VERSION
} as const;
const staticLoop = {
  id: 'specialist.static-loop',
  version: AUTHORING_PROFILE_SCHEMA_VERSION
} as const;
const alternatingGait = {
  id: 'specialist.alternating-gait',
  version: AUTHORING_PROFILE_SCHEMA_VERSION
} as const;
const selection: AuthoringSelectionInput = {
  archetype: recipe.archetype,
  track: recipe.track,
  faceMode: recipe.faceMode,
  face: recipe.face,
  specialists: [roleProps, staticLoop, alternatingGait],
  claims: [
    ...recipe.claimSuggestions,
    {
      authority: roleProps,
      criterionId: 'criterion.role-cue',
      basis: 'requested',
      referenceIds: ['intent.features.0'],
      rationale: 'The request requires one practical role cue.'
    },
    {
      authority: staticLoop,
      criterionId: 'criterion.presentation-motion',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale: 'The delivery target requires a held presentation loop.'
    },
    {
      authority: alternatingGait,
      criterionId: 'criterion.paired-gait',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale: 'The requested form uses paired locomotion.'
    }
  ],
  slots: recipe.slotSuggestions,
  coverage: recipe.coverageSuggestions,
  bindings: [
    {
      type: 'attachment',
      contributionId: 'contribution.role-prop',
      portId: 'port.role-module',
      hostSlotId: 'core.primary',
      partIds: ['role_prop']
    },
    {
      type: 'motion',
      specialist: staticLoop,
      clipId: 'idle',
      role: 'idle'
    },
    {
      type: 'motion',
      specialist: alternatingGait,
      clipId: 'walk',
      role: 'loop'
    }
  ]
};
const created = createAuthoringProfile(intended, selection);
assert.equal(created.ok, true);
if (!created.ok) throw new Error(created.issues[0]?.message);
for (const retiredTrack of ['compact', 'showcase'] as const) {
  const retiredTrackResult = createAuthoringProfile(intended, {
    ...selection,
    track: retiredTrack
  } as unknown as AuthoringSelectionInput);
  assert.equal(
    retiredTrackResult.ok,
    false,
    `pre-release hardcut must not retain a ${retiredTrack} alias`
  );
}
assert.equal(evaluateAuthoringCompatibility(created.profile).compatible, true);
const staleArchetypeCompatibility = evaluateAuthoringCompatibility({
  ...created.profile,
  archetype: {
    ...created.profile.archetype,
    version: 2
  }
} as unknown as AuthoringProfile);
assert.equal(staleArchetypeCompatibility.compatible, false);
assert.equal(
  staleArchetypeCompatibility.issues[0]?.code,
  'authoring.compatibility.archetype_unknown',
  'compatibility authority resolution must use the same current-version gate as the registry'
);
const staleSpecialistCompatibility = evaluateAuthoringCompatibility({
  ...created.profile,
  specialists: created.profile.specialists.map((reference, index) =>
    index === 0 ? { ...reference, version: 2 } : reference
  )
} as unknown as AuthoringProfile);
assert.equal(staleSpecialistCompatibility.compatible, false);
assert.ok(staleSpecialistCompatibility.issues.some((issue) =>
  issue.code === 'authoring.compatibility.specialist_unknown'
));

const multiFeatureIntended = execute(base, 'multi-feature-intent', [{
  name: 'project.intent.set',
  payload: {
    subject: 'Integrated graphic form',
    grounding: 'free',
    features: ['Primary mark', 'Secondary mark'],
    references: []
  }
}]);
const sharedCoverage = [
  {
    featureRef: 'intent.features.0',
    slotIds: ['focal.glyph'],
    materialIds: []
  },
  {
    featureRef: 'intent.features.1',
    slotIds: ['focal.glyph'],
    materialIds: []
  }
] as const;
assert.equal(createAuthoringProfile(multiFeatureIntended, {
  ...selection,
  track: 'essential',
  coverage: sharedCoverage
}).ok, true, 'essential track may integrate features into one graphic target');
const sharedHeroCoverage = createAuthoringProfile(multiFeatureIntended, {
  ...selection,
  coverage: sharedCoverage
});
assert.equal(sharedHeroCoverage.ok, false);
if (!sharedHeroCoverage.ok) {
  assert.equal(sharedHeroCoverage.issues.filter((issue) =>
    issue.message.includes('has no exclusive realization target')
  ).length, 2);
}
const incompleteFeatureMap = createAuthoringProfile(multiFeatureIntended, {
  ...selection,
  track: 'essential',
  coverage: sharedCoverage.slice(0, 1)
});
assert.equal(incompleteFeatureMap.ok, false);
if (!incompleteFeatureMap.ok) {
  assert.ok(incompleteFeatureMap.issues.some((issue) =>
    issue.message.includes('must have exactly one coverage entry')
  ));
}
const rootOnlyEssential = createAuthoringProfile(intended, {
  ...selection,
  track: 'essential',
  slots: selection.slots.filter((slot) => slot.slotId === 'core.primary'),
  coverage: [{
    featureRef: 'intent.features.0',
    slotIds: ['core.primary'],
    materialIds: []
  }]
});
assert.equal(rootOnlyEssential.ok, false);
if (!rootOnlyEssential.ok) {
  assert.ok(rootOnlyEssential.issues.some((issue) =>
    issue.message.includes('requires a declared structure stage module')
  ));
}
const focalOptionalEssentialSelection: AuthoringSelectionInput = {
  ...selection,
  track: 'essential',
  slots: selection.slots.filter((slot) =>
    slot.slotId === 'core.primary' || slot.slotId === 'axis.primary'
  ),
  coverage: [{
    featureRef: 'intent.features.0',
    slotIds: ['axis.primary'],
    materialIds: []
  }]
};
assert.equal(
  createAuthoringProfile(intended, focalOptionalEssentialSelection).ok,
  true,
  'essential track may omit focal modules after declaring macro and meso stages'
);

const essentialFaceSlots: AuthoringSelectionInput['slots'] = [
  {
    slotId: 'core.primary',
    structuralRole: 'core',
    qualityStage: 'silhouette',
    partIds: ['core_primary'],
    parentSlotIds: [],
    spatialRelations: [],
    facing: null,
    pairId: null,
    contact: 'free'
  },
  {
    slotId: 'focal.host',
    structuralRole: 'focal-frame',
    qualityStage: 'structure',
    partIds: ['focal_host'],
    parentSlotIds: ['core.primary'],
    spatialRelations: [],
    facing: null,
    pairId: null,
    contact: 'free'
  },
  ...(['eye', 'nasal', 'oral'] as const).map((component) => ({
    slotId: `face.${component}`,
    structuralRole: 'focal-frame' as const,
    qualityStage: 'focal' as const,
    partIds: [`face_${component}`],
    parentSlotIds: ['focal.host'],
    spatialRelations: [],
    facing: null,
    pairId: null,
    contact: 'free' as const
  }))
];
const essentialFaceComponents = [
  {
    component: 'eye',
    form: 'eye',
    configuration: 'single',
    slotIds: ['face.eye'],
    materialIds: ['eye_dark']
  },
  {
    component: 'nasal',
    form: 'nose',
    configuration: null,
    slotIds: ['face.nasal'],
    materialIds: ['nose_tone']
  },
  {
    component: 'oral',
    form: 'mouth',
    configuration: null,
    slotIds: ['face.oral'],
    materialIds: ['mouth_tone']
  }
] as const;
const essentialFullFaceSelection: AuthoringSelectionInput = {
  archetype: recipe.archetype,
  track: 'essential',
  faceMode: 'full',
  face: {
    hostSlotId: 'focal.host',
    mouthState: 'closed',
    components: essentialFaceComponents,
    exceptions: []
  },
  specialists: [],
  claims: recipe.claimSuggestions,
  slots: essentialFaceSlots,
  coverage: [{
    featureRef: 'intent.features.0',
    slotIds: ['face.oral'],
    materialIds: []
  }],
  bindings: []
};
const essentialFullFace = createAuthoringProfile(
  intended,
  essentialFullFaceSelection
);
assert.equal(essentialFullFace.ok, true);
if (!essentialFullFace.ok) {
  throw new Error(essentialFullFace.issues[0]?.message);
}
const essentialNativeFaceChecks = authoringReviewChecks(
  essentialFullFace.profile,
  'native'
).map((check) => check.id);
assert.ok(essentialNativeFaceChecks.includes(
  'composable-form.face-native-read'
));
assert.ok(essentialNativeFaceChecks.includes(
  'composable-form.face-essential-budget'
));
assert.ok(essentialNativeFaceChecks.includes(
  'composable-form.face-surface-contrast'
));
assert.ok(essentialNativeFaceChecks.includes(
  'composable-form.track-essential-integrity'
));
const heroNativeChecks = authoringReviewChecks(
  created.profile,
  'native'
).map((check) => check.id);
assert.ok(!heroNativeChecks.some((id) =>
  id.startsWith('composable-form.face-')
));
assert.ok(heroNativeChecks.includes(
  'composable-form.track-hero-structure'
));
assert.ok(heroNativeChecks.includes(
  'composable-form.track-hero-material'
));
const missingNasalFace = createAuthoringProfile(intended, {
  ...essentialFullFaceSelection,
  face: {
    ...essentialFullFaceSelection.face as NonNullable<
      AuthoringSelectionInput['face']
    >,
    components: essentialFaceComponents.filter((entry) =>
      entry.component !== 'nasal'
    )
  }
});
assert.equal(missingNasalFace.ok, false);
const exceptedNasalFace = createAuthoringProfile(intended, {
  ...essentialFullFaceSelection,
  face: {
    ...essentialFullFaceSelection.face as NonNullable<
      AuthoringSelectionInput['face']
    >,
    components: essentialFaceComponents.filter((entry) =>
      entry.component !== 'nasal'
    ),
    exceptions: [{
      component: 'nasal',
      basis: 'requested',
      referenceIds: ['intent.subject'],
      rationale: 'The explicitly requested species has no nasal structure.'
    }]
  }
});
assert.equal(exceptedNasalFace.ok, true);

const heroFaceSlots: AuthoringSelectionInput['slots'] = [
  ...essentialFaceSlots,
  ...(['eye_frame', 'jaw', 'mouth_interior'] as const).map((component) => ({
    slotId: `face.${component}`,
    structuralRole: 'focal-frame' as const,
    qualityStage: 'focal' as const,
    partIds: [`face_${component}`],
    parentSlotIds: ['focal.host'],
    spatialRelations: [],
    facing: null,
    pairId: null,
    contact: 'free' as const
  }))
];
const heroClosedFaceSelection: AuthoringSelectionInput = {
  ...essentialFullFaceSelection,
  track: 'hero',
  slots: heroFaceSlots,
  face: {
    hostSlotId: 'focal.host',
    mouthState: 'closed',
    components: [
      ...essentialFaceComponents,
      {
        component: 'eye-frame',
        form: 'brow',
        configuration: null,
        slotIds: ['face.eye_frame'],
        materialIds: ['brow_tone']
      },
      {
        component: 'jaw',
        form: 'jaw',
        configuration: null,
        slotIds: ['face.jaw'],
        materialIds: ['jaw_tone']
      }
    ],
    exceptions: []
  }
};
const heroClosedFace = createAuthoringProfile(
  intended,
  heroClosedFaceSelection
);
assert.equal(
  heroClosedFace.ok,
  true,
  'hero accepts one orbital-or-brow eye frame and closed mouth without interior'
);
if (heroClosedFace.ok) {
  assert.ok(authoringReviewChecks(
    heroClosedFace.profile,
    'perspective'
  ).some((check) =>
    check.id === 'composable-form.face-hero-separation'
  ));
}
const openHeroWithoutInterior = createAuthoringProfile(intended, {
  ...heroClosedFaceSelection,
  face: {
    ...heroClosedFaceSelection.face as NonNullable<
      AuthoringSelectionInput['face']
    >,
    mouthState: 'open'
  }
});
assert.equal(openHeroWithoutInterior.ok, false);
if (!openHeroWithoutInterior.ok) {
  assert.ok(openHeroWithoutInterior.issues.some((issue) =>
    issue.message.includes('requires a separate mouth interior')
  ));
}
const openHeroWithInterior = createAuthoringProfile(intended, {
  ...heroClosedFaceSelection,
  face: {
    ...heroClosedFaceSelection.face as NonNullable<
      AuthoringSelectionInput['face']
    >,
    mouthState: 'open',
    components: [
      ...(heroClosedFaceSelection.face as NonNullable<
        AuthoringSelectionInput['face']
      >).components,
      {
        component: 'mouth-interior',
        form: 'mouth-interior',
        configuration: null,
        slotIds: ['face.mouth_interior'],
        materialIds: ['interior_tone']
      }
    ]
  }
});
assert.equal(openHeroWithInterior.ok, true);

const asymmetricPair = createAuthoringProfile(intended, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId === 'span.right'
      ? { ...slot, contact: 'grounded' as const }
      : slot
  )
});
assert.equal(asymmetricPair.ok, false);
if (!asymmetricPair.ok) {
  assert.ok(asymmetricPair.issues.some((issue) =>
    issue.message.includes('structurally symmetric')
  ));
}

const reversedStageEdge = createAuthoringProfile(intended, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId === 'focal.host'
      ? { ...slot, qualityStage: 'focal' as const }
      : slot.slotId === 'focal.glyph'
        ? {
            ...slot,
            qualityStage: 'structure' as const,
            parentSlotIds: ['focal.host']
          }
        : slot
  )
});
assert.equal(reversedStageEdge.ok, false);
if (!reversedStageEdge.ok) {
  assert.ok(reversedStageEdge.issues.some((issue) =>
    issue.message.includes('below later-stage parent')
  ));
}

const cyclicSlots = createAuthoringProfile(intended, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId === 'axis.primary'
      ? { ...slot, parentSlotIds: ['focal.host'] }
      : slot
  )
});
assert.equal(cyclicSlots.ok, false);
if (!cyclicSlots.ok) {
  assert.ok(cyclicSlots.issues.some((issue) =>
    issue.message.includes('must form a DAG')
  ));
}

const multipleRoots = createAuthoringProfile(intended, {
  ...selection,
  slots: selection.slots.map((slot) =>
    slot.slotId === 'axis.primary'
      ? { ...slot, parentSlotIds: [] }
      : slot
  )
});
assert.equal(multipleRoots.ok, false);
if (!multipleRoots.ok) {
  assert.ok(multipleRoots.issues.some((issue) =>
    issue.message.includes('exactly one root slot')
  ));
}

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
assert.ok(plan.issues.some((issue) =>
  issue.code === 'authoring.plan.intent_coverage_incomplete'
));
assert.ok(plan.issues.some((issue) =>
  issue.code === 'authoring.plan.track_stage_incomplete'
));
assert.equal(plan.assetQuality?.track, 'hero');
assert.equal(
  plan.assetQuality?.intentCoverage.features[0]?.state,
  'incomplete'
);

const fullFaceConfigured = execute(intended, 'configure-full-face', [{
  name: 'project.authoring.configure',
  payload: essentialFullFaceSelection
}]);
const emptyFullFacePlan = evaluateAuthoringPlan(fullFaceConfigured);
assert.equal(emptyFullFacePlan.assetQuality?.faceQuality.mode, 'full');
assert.equal(emptyFullFacePlan.assetQuality?.faceQuality.ready, false);
assert.ok(emptyFullFacePlan.issues.some((issue) =>
  issue.code === 'authoring.plan.face_host_incomplete'
));
assert.ok(emptyFullFacePlan.issues.some((issue) =>
  issue.code === 'authoring.plan.face_eye_unreadable'
));
const fullFaceAuthored = execute(fullFaceConfigured, 'author-full-face', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [
      {
        kind: 'mass',
        partId: 'core_primary',
        parentPartId: null,
        materialId: 'body',
        center: [0, 0, 0],
        radii: [2, 2, 2],
        profile: 'block'
      },
      {
        kind: 'mass',
        partId: 'focal_host',
        parentPartId: 'core_primary',
        materialId: 'face_base',
        center: [0, 5, 0],
        radii: [3, 3, 2],
        profile: 'block'
      },
      {
        kind: 'feature',
        partId: 'face_eye',
        parentPartId: 'focal_host',
        materialId: 'eye_dark',
        motif: 'eye',
        glyph: 'square',
        face: 'south',
        anchor: [0, 6, 2],
        size: [2, 2]
      },
      {
        kind: 'feature',
        partId: 'face_nasal',
        parentPartId: 'focal_host',
        materialId: 'nose_tone',
        motif: 'nose',
        glyph: 'snout',
        face: 'south',
        anchor: [0, 4, 2],
        size: [2, 2]
      },
      {
        kind: 'feature',
        partId: 'face_oral',
        parentPartId: 'focal_host',
        materialId: 'mouth_tone',
        motif: 'mouth',
        glyph: 'neutral',
        face: 'south',
        anchor: [0, 2, 2],
        size: [2, 1]
      }
    ],
    materials: [
      { id: 'body', baseColor: '#53677A' },
      { id: 'face_base', baseColor: '#B7C8D8' },
      { id: 'eye_dark', baseColor: '#111827' },
      { id: 'nose_tone', baseColor: '#76556A' },
      { id: 'mouth_tone', baseColor: '#512D3A' }
    ]
  }
}]);
const fullFacePlan = evaluateAuthoringPlan(fullFaceAuthored);
assert.equal(fullFacePlan.assetQuality?.faceQuality.hostReady, true);
assert.deepEqual(
  fullFacePlan.assetQuality?.faceQuality.components.map((component) => [
    component.component,
    component.state
  ]),
  [
    ['eye', 'complete'],
    ['nasal', 'complete'],
    ['oral', 'complete']
  ]
);
assert.equal(fullFacePlan.assetQuality?.faceQuality.ready, true);
assert.equal(fullFacePlan.assetQuality?.activeStage, 'complete');
assert.equal(fullFacePlan.ready, true);
const lowContrastFullFace = execute(
  fullFaceAuthored,
  'lower-full-face-contrast',
  [{
    name: 'model.parts.material',
    payload: {
      partIds: ['focal_host'],
      baseColor: '#111827'
    }
  }]
);
const lowContrastFacePlan = evaluateAuthoringPlan(lowContrastFullFace);
assert.equal(lowContrastFacePlan.assetQuality?.faceQuality.ready, false);
assert.ok(lowContrastFacePlan.issues.some((issue) =>
  issue.code === 'authoring.plan.face_eye_visibility_invalid' &&
  issue.partIds?.includes('face_eye')
));
const onePixelFullFace = execute(fullFaceAuthored, 'collapse-full-face-eye', [{
  name: 'model.parts.upsert',
  payload: {
    parts: [{
      kind: 'feature',
      partId: 'face_eye',
      glyph: 'dot',
      size: [1, 1]
    }]
  }
}]);
const onePixelFacePlan = evaluateAuthoringPlan(onePixelFullFace);
assert.equal(onePixelFacePlan.assetQuality?.faceQuality.ready, false);
assert.deepEqual(
  onePixelFacePlan.assetQuality?.faceQuality.components.find(
    (component) => component.component === 'eye'
  )?.readableEyePartIds,
  []
);
assert.ok(onePixelFacePlan.issues.some((issue) =>
  issue.code === 'authoring.plan.face_eye_unreadable'
));
const mislabeledNasalFace = execute(
  fullFaceAuthored,
  'replace-nasal-form-with-mouth',
  [{
    name: 'model.parts.upsert',
    payload: {
      parts: [{
        kind: 'feature',
        partId: 'face_nasal',
        motif: 'mouth',
        glyph: 'neutral'
      }]
    }
  }]
);
const mislabeledNasalPlan = evaluateAuthoringPlan(mislabeledNasalFace);
assert.equal(
  mislabeledNasalPlan.assetQuality?.faceQuality.components.find(
    (component) => component.component === 'nasal'
  )?.state,
  'incomplete',
  'renaming a component declaration cannot substitute a mismatched actual motif'
);
assert.ok(mislabeledNasalPlan.issues.some((issue) =>
  issue.code === 'authoring.plan.face_component_incomplete' &&
  issue.path.endsWith('.nasal')
));

const essentialConfigured = execute(intended, 'configure-essential-authoring', [{
  name: 'project.authoring.configure',
  payload: { ...selection, track: 'essential' }
}]);
const essentialPlan = evaluateAuthoringPlan(essentialConfigured);
assert.deepEqual(
  essentialPlan.assetQuality?.intentCoverage.stages.map((stage) => [
    stage.stage,
    stage.ready
  ]),
  [
    ['silhouette', false],
    ['structure', false],
    ['focal', false]
  ],
  'essential requires all declared stages to materialize'
);
assert.ok(essentialPlan.issues.some((issue) =>
  issue.code === 'authoring.plan.track_stage_incomplete'
));
const focalOptionalEssentialConfigured = execute(
  intended,
  'configure-focal-optional-essential-authoring',
  [{
    name: 'project.authoring.configure',
    payload: focalOptionalEssentialSelection
  }]
);
const focalOptionalEssentialPlan = evaluateAuthoringPlan(
  focalOptionalEssentialConfigured
);
assert.equal(
  focalOptionalEssentialPlan.assetQuality?.intentCoverage.stages.find(
    (stage) => stage.stage === 'focal'
  )?.ready,
  true,
  'essential focal stage remains optional when no focal module is declared'
);
assert.ok(focalOptionalEssentialPlan.issues.some((issue) =>
  issue.code === 'authoring.plan.track_stage_incomplete'
));
assert.ok(!focalOptionalEssentialPlan.issues.some((issue) =>
  issue.code === 'authoring.plan.track_stage_incomplete' &&
  issue.path.endsWith('.focal')
));

const explicitMaterialProfile = createAuthoringProfile(intended, {
  ...selection,
  coverage: [{
    featureRef: 'intent.features.0',
    slotIds: ['focal.glyph'],
    materialIds: ['tool_detail']
  }]
});
assert.equal(explicitMaterialProfile.ok, true);
if (!explicitMaterialProfile.ok) {
  throw new Error(explicitMaterialProfile.issues[0]?.message);
}
const completedSlots = plan.slots.map((slot) => ({
  ...slot,
  state: 'complete' as const,
  presentPartIds: slot.partIds,
  missingPartIds: [],
  invalidKindPartIds: [],
  invalidHierarchyPartIds: [],
  invalidSpatialPartIds: [],
  invalidFacingPartIds: []
}));
const focalPart: PartSpec = {
  kind: 'mass',
  partId: 'focal_glyph',
  parentPartId: null,
  materialId: 'tool_detail',
  joint: { kind: 'fixed' },
  attachment: null,
  center: [0, 0, 0],
  radii: [1, 1, 1],
  profile: 'hard'
};
const generatedOnlyCoverage = evaluateIntentCoverage(
  explicitMaterialProfile.profile,
  intended.intent as NonNullable<typeof intended.intent>,
  completedSlots,
  [focalPart],
  []
);
assert.equal(generatedOnlyCoverage.features[0]?.state, 'incomplete');
assert.deepEqual(
  generatedOnlyCoverage.features[0]?.missingMaterialIds,
  ['tool_detail'],
  'a material-like ID on a part does not replace an explicit recipe material'
);
const explicitCoverage = evaluateIntentCoverage(
  explicitMaterialProfile.profile,
  intended.intent as NonNullable<typeof intended.intent>,
  completedSlots,
  [focalPart],
  [{ id: 'tool_detail', baseColor: '#556677' }]
);
assert.equal(explicitCoverage.features[0]?.state, 'complete');
assert.deepEqual(explicitCoverage.features[0]?.realizedAspects, [
  'focal',
  'material'
]);

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
  'coverage',
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
assert.equal(command?.validate(selection), null);
assert.ok(command?.validate({
  ...selection,
  archetype: 'archetype.not-a-reference-object'
}));

const prematureStructure = executeAgentCommandBatch(configured, {
  batchId: 'premature-structure',
  baseProjectId: configured.id,
  baseRevision: configured.revision,
  operations: [{
    name: 'model.parts.upsert',
    payload: {
      parts: [
        {
          kind: 'mass',
          partId: 'core_primary',
          parentPartId: null,
          materialId: 'body',
          center: [0, 4, 0],
          radii: [2, 2, 2],
          profile: 'block'
        },
        {
          kind: 'mass',
          partId: 'axis_primary',
          parentPartId: 'core_primary',
          materialId: 'body',
          center: [0, 4, -4],
          radii: [1, 1, 2],
          profile: 'block'
        }
      ],
      materials: [{ id: 'body', baseColor: '#223344' }]
    }
  }]
});
assert.equal(prematureStructure.ok, false);
if (!prematureStructure.ok) {
  assert.equal(prematureStructure.error.code, 'invalid_state');
  assert.match(
    prematureStructure.error.message,
    /before earlier structural landmarks are complete/
  );
  assert.match(prematureStructure.error.expected ?? '', /span\.left/);
  assert.match(prematureStructure.error.expected ?? '', /span\.right/);
}

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
    `Assembly must remain outside the current runtime boundary: ${file}`
  );
}
for (const file of [
  path.join(sourceRoot, 'authoring', 'archetypeDefinitions.ts'),
  path.join(sourceRoot, 'authoring', 'specialistDefinitions.ts')
]) {
  assert.doesNotMatch(
    fs.readFileSync(file, 'utf8'),
    /creeper|mechanic|quadruped|dragon|four-point|body column/i,
    `concrete recipe names must not enter authority catalogs: ${file}`
  );
}
