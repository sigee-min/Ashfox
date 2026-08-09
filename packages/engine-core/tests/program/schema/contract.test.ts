import assert from 'node:assert/strict';

import { PROJECT_APPEARANCE_SPECIFICATION } from '../../../src/project/appearance/contract';
import {
  INTENT_PROGRAM_LANGUAGE_SPECIFICATION as language,
  parseIntentProgram
} from '../../../src/project/program';
import {
  intentProgramCardinalityBounds,
  normalizeIntentProgramName,
  resolveIntentProgramSpecificationPointer,
  resolveIntentProgramVocabulary
} from '../../../src/project/program/schema';
import { INTENT_PROGRAM_PRESENTATION_SLOT } from
  '../../../src/project/program/constraints/relations';
import { INTENT_PROGRAM_RELATION_SPECIFICATION } from
  '../../../src/project/program/constraints/matrix';
import { INTENT_PROGRAM_INVARIANTS } from
  '../../../src/project/program/constraints/policy';
import {
  claimIntentProgramAttachmentSlot,
  INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY,
  type IntentProgramAttachmentClaims
} from '../../../src/project/program/constraints/slots';
import {
  INTENT_PROGRAM_TARGET_REFERENCE_POLICY,
  INTENT_PROGRAM_TRACK_PRESENTATION_POLICY
} from '../../../src/project/program/constraints/targets';
import { schemaSource, shape, validSchemaSource } from './source';

assert.deepEqual(language.rootBlocks, [
  'metadata', 'model', 'animation', 'appearance'
]);
assert.deepEqual(language.statements.metadata.name.sourceTokens, [
  'name', 'text'
]);
assert.deepEqual(language.statements.metadata.track.sourceTokens, [
  'track', 'value'
]);
assert.deepEqual(language.statements.metadata.domain.sourceTokens, [
  'domain', 'value'
]);
assert.deepEqual(language.statements.model.orientation.sourceTokens, [
  'orientation', 'forward', 'direction'
]);
assert.deepEqual(language.statements.model.symmetry.sourceTokens, [
  'symmetry', 'value'
]);
assert.deepEqual(language.statements.model.support.sourceTokensByKind, {
  none: ['support', 'kind'],
  contacts: ['support', 'kind', 'contacts', 'contactIds']
});
assert.deepEqual(language.statements.model.body.sourceTokensByKind.attached, [
  'kind', 'id', 'cardinality', 'parent', 'parentId', 'anchor',
  'anchorValue', 'growth', 'growthValue', 'lane', 'laneValue'
]);
assert.deepEqual(language.statements.model.body.sourceHeader, ['body']);
assert.deepEqual(language.statements.model.surface.sourceTokens, [
  'surface', 'id', 'cardinality', 'role', 'parent', 'parentId',
  'anchor', 'anchorValue', 'growth', 'growthValue', 'lane', 'laneValue'
]);
assert.deepEqual(language.statements.model.face.sourceTokensByProperty, {
  none: ['none'],
  full: ['full', 'parent', 'parentId'],
  eyes: ['eyes', 'configuration', 'gaze', 'gazeMode'],
  nose: ['nose', 'mode'],
  mouth: ['mouth', 'mode']
});
assert.deepEqual(language.statements.model.face.sourceHeader, ['face']);
assert.deepEqual(language.statements.model.shape.sourceHeader, [
  'shape', 'surfaceId'
]);
assert.deepEqual(language.statements.model.focal.sourceTokens, [
  'focal', 'id', 'parent', 'parentId'
]);
assert.deepEqual(language.statements.animation.idle.sourceTokensByTarget, {
  absent: ['idle', 'mode'],
  present: ['idle', 'mode', 'target', 'targetId']
});
assert.deepEqual(language.statements.appearance.palette.sourceTokens, [
  'palette', 'value'
]);
assert.deepEqual(
  Object.keys(language.statements.model.shape.fields),
  ['axis', 'span', 'chord', 'tip', 'offset', 'edge']
);
assert.equal(
  resolveIntentProgramSpecificationPointer('surfaceShapes.compatibility'),
  language.surfaceShapes.compatibility,
  'shape compatibility resolves to the exact frozen language authority'
);
assert.ok(Object.isFrozen(language.surfaceShapes.compatibility));
assert.ok(Object.isFrozen(
  language.surfaceShapes.compatibility.parallelGrowthByAxis
));
assert.ok(Object.isFrozen(
  language.surfaceShapes.compatibility.parallelGrowthByAxis.vertical
));
assert.ok(Object.isFrozen(
  language.surfaceShapes.compatibility.allowedOffsetsByAxis.longitudinal
));
assert.equal(language.appearance.specification, PROJECT_APPEARANCE_SPECIFICATION);
assert.equal(
  language.statements.appearance.texture.schema,
  PROJECT_APPEARANCE_SPECIFICATION.statements.texture
);
assert.equal(
  language.statements.appearance.seed.schema,
  PROJECT_APPEARANCE_SPECIFICATION.statements.seed
);
assert.equal(
  language.statements.appearance.mark.schema,
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark
);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.statements.texture.order, [
  'kind', 'scale', 'density', 'contrast'
]);
assert.equal(
  PROJECT_APPEARANCE_SPECIFICATION.statements.texture.cardinality,
  'exactly-one'
);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.statements.texture.markers, {
  scale: 'scale', density: 'density', contrast: 'contrast'
});
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.statements.mark.order, [
  'id', 'target', 'region', 'placement', 'motif', 'tone', 'flow',
  'variant', 'scale', 'density', 'contrast'
]);
assert.deepEqual(
  PROJECT_APPEARANCE_SPECIFICATION.statements.mark.optional,
  ['flow', 'variant']
);
assert.deepEqual(PROJECT_APPEARANCE_SPECIFICATION.statements.mark.markers, {
  target: 'target', region: 'region', placement: 'placement', motif: 'as',
  tone: 'tone', flow: 'flow', variant: 'variant', scale: 'scale',
  density: 'density', contrast: 'contrast'
});
assert.deepEqual(
  language.statements.model.support.fields.contacts.cardinalityByKind,
  {
    none: { min: 0, max: 0 }, feet: { min: 1, max: null },
    base: { min: 1, max: 1 }, wheels: { min: 1, max: null }
  }
);
assert.deepEqual(
  intentProgramCardinalityBounds(language.statements.model.face.cardinality),
  { min: 1, max: 1 }
);
assert.equal(
  resolveIntentProgramVocabulary(language.statements.root.allowed),
  language.rootBlocks
);
assert.equal(
  resolveIntentProgramVocabulary(language.statements.root.required),
  language.rootBlocks
);
const enumPointers = (value: unknown): readonly string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const entries = Object.entries(value);
  const own = entries.find(([key]) => key === 'enum');
  return [
    ...(typeof own?.[1] === 'string' ? [own[1]] : []),
    ...entries.flatMap(([key, child]) => key === 'enum'
      ? []
      : enumPointers(child))
  ];
};
for (const pointer of enumPointers(language.statements)) {
  assert.equal(
    resolveIntentProgramVocabulary(pointer),
    resolveIntentProgramSpecificationPointer(pointer),
    `${pointer} resolves to the exact frozen vocabulary authority`
  );
}
assert.equal(
  intentProgramCardinalityBounds(language.statements.model.body.cardinality),
  language.statements.model.body.cardinality,
  'bounded statement cardinality is consumed by identity'
);
for (const cardinality of [
  language.statements.root.cardinalityPerBlock,
  language.statements.model.surface.cardinality,
  language.statements.model.shape.cardinality,
  language.statements.model.focal.cardinality
]) {
  assert.equal(
    intentProgramCardinalityBounds(cardinality),
    cardinality,
    'bounded descriptor identity survives generic cardinality consumption'
  );
}
assert.ok(language.relations.moduleTuples.some((entry) =>
  entry.join('/') === 'wheel/paired/sides/down'
));
assert.ok(language.relations.surfaceTuples.some((entry) =>
  entry.join('/') === 'paired/sides/down'
));
assert.deepEqual(language.relations.lanesByAnchor.front, [
  'center', 'upper', 'lower'
]);
assert.equal(
  language.supportCompatibility.contactRequirementsByKind.base.moduleKinds,
  language.relations.structuralHostKinds,
  'base support consumes the exact structural-host kind authority'
);
assert.equal(
  resolveIntentProgramSpecificationPointer('supportCompatibility'),
  language.supportCompatibility,
  'support compatibility resolves to the exact frozen language authority'
);
assert.deepEqual(
  language.supportCompatibility.contactRequirementsByKind,
  {
    feet: {
      supportKind: 'feet', moduleKinds: ['limb'], requiredGrowth: 'down'
    },
    wheels: {
      supportKind: 'wheels', moduleKinds: ['wheel'], requiredGrowth: 'down'
    },
    base: {
      supportKind: 'base',
      moduleKinds: ['core', 'mass', 'chain', 'radial'],
      requiredGrowth: null
    }
  }
);
assert.deepEqual(language.supportCompatibility.requiredModuleContacts, [
  { moduleKind: 'wheel', supportKind: 'wheels' }
]);
assert.ok(Object.isFrozen(
  language.supportCompatibility.contactRequirementsByKind.feet.moduleKinds
));
assert.equal(
  resolveIntentProgramSpecificationPointer('symmetryCompatibility'),
  language.symmetryCompatibility,
  'symmetry compatibility resolves to the exact frozen language authority'
);
assert.deepEqual(language.symmetryCompatibility.singleLateralAttachment, {
  whenSymmetry: 'bilateral', cardinality: 'single',
  appliesTo: ['body', 'surface'],
  anchors: ['left', 'right'], requiredSymmetry: 'asymmetric'
});
assert.ok(Object.isFrozen(
  language.symmetryCompatibility.singleLateralAttachment.anchors
));
assert.equal(
  resolveIntentProgramSpecificationPointer('invariants'),
  language.invariants,
  'generic semantic invariants resolve to the exact frozen authority'
);
assert.equal(INTENT_PROGRAM_INVARIANTS, language.invariants);
assert.equal(
  INTENT_PROGRAM_ATTACHMENT_SLOT_POLICY,
  language.invariants.attachmentSlots
);
assert.equal(
  INTENT_PROGRAM_TARGET_REFERENCE_POLICY,
  language.invariants.references
);
assert.equal(
  INTENT_PROGRAM_TRACK_PRESENTATION_POLICY,
  language.invariants.presentationByTrack
);
assert.equal(
  resolveIntentProgramVocabulary(
    language.invariants.references.faceParent.allowedKinds
  ),
  language.relations.structuralHostKinds
);
assert.equal(
  language.supportCompatibility.contactCardinalityByKind,
  language.statements.model.support.fields.contacts.cardinalityByKind
);
assert.deepEqual(language.supportCompatibility.kindsByDomain, {
  organism: ['none', 'feet'],
  constructed: ['none', 'feet', 'base', 'wheels']
});
assert.deepEqual(language.supportCompatibility.contactReference, {
  namespace: 'body'
});
assert.equal(language.supportCompatibility.contactsUnique, true);
assert.deepEqual(language.invariants.body.core, {
  kind: 'core', cardinality: 'single', exactCount: 1
});
assert.deepEqual(
  language.invariants.identifiers.uniqueWithinNamespaces,
  ['body', 'surfaces']
);
assert.deepEqual(language.invariants.references, {
  bodyParent: {
    namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
  },
  surfaceParent: {
    namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
  },
  surfaceShape: { namespace: 'surfaces' },
  faceParent: {
    namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
  },
  focalParent: {
    namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
  },
  animationTarget: {
    namespace: 'body', allowedKinds: 'relations.structuralHostKinds'
  }
});
assert.deepEqual(language.invariants.attachmentSlots, {
  keyFields: ['parent', 'anchor', 'lane'],
  capacityByClaimKind: { body: 1, surface: 2 },
  mutuallyExclusiveClaimKinds: [['body', 'surface']],
  presentation: {
    slot: { anchor: 'front', lane: 'center' },
    claimKinds: ['body', 'surface', 'face', 'focal'],
    exclusiveClaimKinds: ['face', 'focal']
  }
});
assert.equal(normalizeIntentProgramName('  Fin\tHero  '), 'Fin Hero');
assert.ok(Object.isFrozen(language.invariants.attachmentSlots.presentation));
assert.deepEqual(language.invariants.presentationByTrack, {
  hero: {
    exactClaimCount: 1, claimKinds: ['face', 'focal'],
    forbiddenClaimKinds: []
  },
  essential: {
    exactClaimCount: null, claimKinds: ['face', 'focal'],
    forbiddenClaimKinds: ['focal']
  }
});
const slotClaims = new Map<string, IntentProgramAttachmentClaims>();
const surfaceClaim = (owner: string) => ({
  kind: 'surface' as const,
  parent: 'torso', anchor: 'top', lane: 'center', owner
});
assert.equal(claimIntentProgramAttachmentSlot(
  slotClaims, surfaceClaim('surface one')
), undefined);
assert.equal(claimIntentProgramAttachmentSlot(
  slotClaims, surfaceClaim('surface two')
), undefined);
assert.equal(claimIntentProgramAttachmentSlot(
  slotClaims, surfaceClaim('surface three')
), 'surface two');
assert.equal(claimIntentProgramAttachmentSlot(slotClaims, {
  kind: 'body', parent: 'torso', anchor: 'top', lane: 'center',
  owner: 'body one'
}), 'surface one');
assert.equal(
  INTENT_PROGRAM_PRESENTATION_SLOT,
  language.invariants.attachmentSlots.presentation.slot,
  'presentation conflict resolution consumes the exact frozen slot descriptor'
);
assert.equal(
  INTENT_PROGRAM_RELATION_SPECIFICATION,
  language.relations,
  'semantic relation validation consumes the exact frozen tuple authority'
);

const canonical = parseIntentProgram(validSchemaSource());
const permuted = parseIntentProgram(schemaSource([
  'mouth neutral',
  'eyes paired gaze center',
  'nose absent',
  'full parent head'
], [...shape].reverse()));
assert.deepEqual(canonical.diagnostics, []);
assert.deepEqual(permuted.diagnostics, []);
assert.equal(permuted.canonical, canonical.canonical);

const swappedSurface = validSchemaSource().replace(
  'surface belly single fin',
  'surface belly fin single'
);
assert.ok(parseIntentProgram(swappedSurface).diagnostics.some((entry) =>
  entry.code === 'intent.invalid_surface'
));

const noneWithContacts = validSchemaSource().replace(
  'support none',
  'support none contacts torso'
);
assert.ok(parseIntentProgram(noneWithContacts).diagnostics.some((entry) =>
  entry.code === 'intent.unexpected_support_contact'
));

const duplicateTrack = validSchemaSource().replace(
  '  track hero',
  '  track hero\n  track essential'
);
assert.ok(parseIntentProgram(duplicateTrack).diagnostics.some((entry) =>
  entry.code === 'intent.duplicate_declaration'
));

const emptyBody = validSchemaSource().replace(
  '  body {\n    core torso\n    mass head single parent torso anchor front growth forward lane center\n  }',
  '  body { }'
);
assert.ok(parseIntentProgram(emptyBody).diagnostics.some((entry) =>
  entry.code === 'intent.invalid_body_cardinality'
));

const incompleteFace = validSchemaSource().replace('    nose absent\n', '');
assert.ok(parseIntentProgram(incompleteFace).diagnostics.some((entry) =>
  entry.code === 'intent.incomplete_face' && /nose/.test(entry.message)
));
