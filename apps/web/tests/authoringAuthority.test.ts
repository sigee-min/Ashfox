import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeAgentCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import { inspectProject } from '../src/features/agent/inspect';
import { parseInspectRequest } from '../src/features/agent/parseInspectRequest';
import {
  authoringSelectionFor,
  createAuthoringProject,
  createCompactFullFaceProject
} from './fixtures/authoringProject';

const empty = createProjectFromInput(
  {
    id: 'web-authoring-authority',
    name: 'Web authoring authority',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'web_authoring_authority',
    createdAt: '2026-08-06T00:00:00.000Z'
  },
  'web-authoring-0001'
);
const intended = executeAgentCommandBatch(
  empty,
  {
    batchId: 'web-authoring-intent',
    baseProjectId: empty.id,
    baseRevision: empty.revision,
    operations: [{
      name: 'project.intent.set',
      payload: {
        subject: 'Mossy pillar mob',
        forward: 'north',
        grounding: 'grounded',
        features: ['Graphic face', 'One top sprout'],
        references: [{
          id: 'reference.pillar',
          kind: 'image',
          description:
            'A mossy upright pillar creature with a graphic face.',
          cues: ['tall column', 'four short feet', 'front face']
        }]
      }
    }]
  }
);
assert.equal(intended.ok, true);
if (!intended.ok) throw new Error(intended.error.message);

assert.deepEqual(parseInspectRequest({ kind: 'authoring' }), {
  ok: true,
  request: { kind: 'authoring' }
});
assert.deepEqual(
  parseInspectRequest({
    kind: 'authoring',
    id: 'archetype.composable-form'
  }),
  {
    ok: true,
    request: {
      kind: 'authoring',
      id: 'archetype.composable-form'
    }
  }
);
assert.equal(
  parseInspectRequest({ kind: 'authoring', id: 3 }).ok,
  false
);
const report = validateProjectDocument(intended.document);
const overview = inspectProject(intended.document, null, report);
assert.equal(overview.ok, true);
if (overview.ok) {
  const workflow = (overview.data as {
    workflow: {
      stage: string;
      blocker: { code: string } | null;
      nextActions: readonly { kind: string; name?: string }[];
    };
  }).workflow;
  assert.equal(workflow.stage, 'plan');
  assert.match(
    workflow.blocker?.code ?? '',
    /^production\.authoring_/
  );
  assert.deepEqual(workflow.nextActions, [{
    kind: 'command',
    name: 'project.authoring.configure'
  }]);
}

let recipeId: string | null = null;
const catalog = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'authoring' }
);
assert.equal(catalog.ok, true);
if (catalog.ok) {
  const data = catalog.data as {
    authority: {
      profile: unknown;
      evidence: readonly unknown[];
      compatibility: unknown;
      plan: { ready: boolean };
    };
    catalog: {
      archetypes: readonly {
        id: string;
        facets: readonly string[];
        capabilities: readonly string[];
        evidenceCriteria: readonly {
          id: string;
          basis: string;
          required: boolean;
        }[];
        structuralRolePolicies: readonly {
          role: string;
          acceptedPartKinds: readonly string[];
          allowedQualityStages: readonly string[];
        }[];
        attachmentPorts: readonly {
          id: string;
          type: string;
          hostStructuralRoles: readonly string[];
        }[];
      }[];
      specialists: readonly {
        id: string;
        facets: readonly string[];
        capabilities: readonly string[];
        evidenceCriteria: readonly {
          id: string;
          basis: string;
          required: boolean;
        }[];
        attachmentRequirements: readonly { op: string }[];
        bindingRequirements: readonly { type: string }[];
      }[];
    };
    guidance: {
      authoritative: boolean;
      role: string;
      recipes: readonly { id: string; role: string }[];
    };
  };
  assert.equal(data.authority.profile, null);
  assert.deepEqual(data.authority.evidence, []);
  assert.equal(data.authority.compatibility, null);
  assert.deepEqual(
    data.catalog.archetypes.map((archetype) => archetype.id),
    ['archetype.composable-form']
  );
  assert.deepEqual(
    data.catalog.specialists.map((specialist) => specialist.id),
    [
      'specialist.role-props',
      'specialist.hard-surface',
      'specialist.decay-cues',
      'specialist.arcane-cues',
      'specialist.organic-cues',
      'specialist.protective-shell',
      'specialist.static-loop',
      'specialist.alternating-gait',
      'specialist.rotary-cycle'
    ]
  );
  assert.ok(
    data.catalog.archetypes.every(
      (archetype) =>
        archetype.facets.length > 0 &&
        archetype.capabilities.length > 0 &&
        archetype.evidenceCriteria.length > 0 &&
        archetype.evidenceCriteria.every(
          (criterion) => criterion.id.length > 0 &&
            ['observed', 'requested', 'either'].includes(criterion.basis)
        ) &&
        archetype.structuralRolePolicies.length === 6 &&
        archetype.structuralRolePolicies.every(
          (policy) =>
            policy.acceptedPartKinds.length > 0 &&
            policy.allowedQualityStages.length > 0
        ) &&
        archetype.attachmentPorts.every(
          (port) => port.hostStructuralRoles.length > 0
        )
    )
  );
  assert.ok(
    data.catalog.specialists.every(
      (specialist) =>
        specialist.facets.length > 0 &&
        specialist.capabilities.length > 0 &&
        specialist.evidenceCriteria.length > 0 &&
        specialist.evidenceCriteria.every(
          (criterion) => criterion.id.length > 0 &&
            ['observed', 'requested', 'either'].includes(criterion.basis)
        ) &&
        Array.isArray(specialist.attachmentRequirements) &&
        Array.isArray(specialist.bindingRequirements)
    )
  );
  assert.equal(data.guidance.authoritative, false);
  assert.equal(data.guidance.role, 'non-authoritative');
  assert.ok(data.guidance.recipes.length > 0);
  recipeId = data.guidance.recipes[0]?.id ?? null;
  assert.ok(
    data.guidance.recipes.every(
      (recipe) => recipe.role === 'non-authoritative'
    )
  );
}

assert.ok(recipeId);
const recipeInspect = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'authoring', id: recipeId ?? '' }
);
assert.equal(recipeInspect.ok, true);
if (recipeInspect.ok) {
  const guidance = (recipeInspect.data as {
    guidance: {
      authoritative: boolean;
      role: string;
      recipe: {
        role: string;
        claimSuggestions: readonly { criterionId: string }[];
      };
    };
  }).guidance;
  assert.equal(guidance.authoritative, false);
  assert.equal(guidance.role, 'non-authoritative');
  assert.equal(guidance.recipe.role, 'non-authoritative');
  assert.ok(
    guidance.recipe.claimSuggestions.every(
      (claim) => claim.criterionId.startsWith('criterion.')
    ),
    'recipe suggestions may name criteria but remain non-authoritative guidance'
  );
  assert.equal('authority' in (recipeInspect.data as object), false);
}

const composable = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'authoring', id: 'archetype.composable-form' }
);
assert.equal(composable.ok, true);
if (composable.ok) {
  const authority = (composable.data as {
    authority: {
      type: string;
      definition: {
        evidenceCriteria: readonly {
          id: string;
          basis: string;
          required: boolean;
        }[];
        structuralRolePolicies: readonly {
          role: string;
          acceptedPartKinds: readonly string[];
          allowedQualityStages: readonly string[];
        }[];
        attachmentPorts: readonly {
          id: string;
          hostStructuralRoles: readonly string[];
        }[];
      };
    };
  }).authority;
  assert.equal(authority.type, 'archetype');
  assert.deepEqual(
    authority.definition.structuralRolePolicies.map((policy) => policy.role),
    ['core', 'axis', 'articulated', 'span', 'focal-frame', 'accent']
  );
  assert.ok(
    authority.definition.structuralRolePolicies.every(
      (policy) =>
        policy.acceptedPartKinds.length > 0 &&
        policy.allowedQualityStages.every((stage) =>
          ['silhouette', 'structure', 'focal'].includes(stage)
        )
    )
  );
  assert.ok(
    authority.definition.attachmentPorts.every(
      (port) => port.hostStructuralRoles.length > 0
    )
  );
}

const missing = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'authoring', id: 'archetype.unknown' }
);
assert.equal(missing.ok, false);
if (!missing.ok) assert.equal(missing.error.code, 'not_found');

const command = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'command', name: 'project.authoring.configure' }
);
assert.equal(command.ok, true);
if (command.ok) {
  const schema = JSON.stringify(
    (command.data as { inputSchema: unknown }).inputSchema
  );
  assert.match(schema, /archetype\.composable-form/);
  assert.match(schema, /specialists/);
  assert.match(schema, /claims/);
  assert.match(schema, /criterionId/);
  assert.match(schema, /observed/);
  assert.match(schema, /requested/);
  assert.match(schema, /referenceIds/);
  assert.match(schema, /bindings/);
  assert.match(schema, /attachment/);
  assert.match(schema, /motion/);
  assert.match(schema, /hostSlotId/);
  assert.match(schema, /clipId/);
  assert.match(schema, /slotId/);
  assert.match(schema, /structuralRole/);
  assert.match(schema, /qualityStage/);
  assert.match(schema, /parentSlotIds/);
  assert.match(schema, /spatialRelations/);
  assert.match(schema, /facing/);
  assert.match(schema, /pairId/);
  assert.match(schema, /contact/);
  assert.match(schema, /track/);
  assert.match(schema, /compact/);
  assert.match(schema, /showcase/);
  assert.match(schema, /coverage/);
  assert.match(schema, /featureRef/);
  assert.match(schema, /materialIds/);
  assert.match(schema, /faceMode/);
  assert.match(schema, /full/);
  assert.match(schema, /mouthState/);
  assert.match(schema, /components/);
  assert.match(schema, /configuration/);
  assert.match(schema, /eye-frame/);
  assert.match(schema, /mouth-interior/);
  assert.match(schema, /exceptions/);
  assert.doesNotMatch(schema, /recipe/i);
  assert.doesNotMatch(schema, /assembly/i);
  assert.doesNotMatch(schema, /preset|identities|motions/i);
}

const configured = createAuthoringProject();
const configuredOverview = inspectProject(
  configured,
  null,
  validateProjectDocument(configured)
);
assert.equal(configuredOverview.ok, true);
if (configuredOverview.ok) {
  const authoring = (configuredOverview.data as {
    project: {
      authoring: {
        track: string;
        faceMode: string;
        structuralQuality: {
          activeStage: string;
          ready: boolean;
        };
        intentCoverage: {
          ready: boolean;
          incompleteFeatureCount: number;
        };
        faceQuality: {
          mode: string;
          ready: boolean;
        };
      };
    };
  }).project.authoring;
  assert.equal(authoring.track, 'showcase');
  assert.equal(authoring.faceMode, 'none');
  assert.deepEqual(authoring.structuralQuality, {
    activeStage: 'complete',
    ready: true
  });
  assert.deepEqual(authoring.intentCoverage, {
    ready: true,
    incompleteFeatureCount: 0
  });
  assert.deepEqual(authoring.faceQuality, {
    mode: 'none',
    ready: true
  });
}
const configuredInspect = inspectProject(
  configured,
  null,
  validateProjectDocument(configured),
  { kind: 'authoring' }
);
assert.equal(configuredInspect.ok, true);
if (configuredInspect.ok) {
  const authority = (configuredInspect.data as {
    authority: {
      profile: {
        track: string;
        faceMode: string;
        face: unknown;
        structuralModuleCount: number;
        coverageCount: number;
      };
      evidence: readonly {
        authority: { id: string };
        criterionId: string;
        basis: 'observed' | 'requested';
      }[];
      compatibility: { compatible: boolean };
      plan: {
        ready: boolean;
        structuralQuality: {
          activeStage: string;
          ready: boolean;
          gates: readonly {
            stage: string;
            state: string;
            structuralRoles: readonly string[];
          }[];
        };
        intentCoverage: {
          track: string;
          ready: boolean;
          featureCount: number;
          incompleteFeatureCount: number;
          features: readonly {
            featureRef: string;
            state: string;
            slotIds: readonly string[];
            materialIds: readonly string[];
            realizedAspects: readonly string[];
          }[];
          truncatedFeatureCount: number;
          stages: readonly {
            stage: string;
            ready: boolean;
            slotCount: number;
            completeSlotCount: number;
          }[];
        };
        faceQuality: {
          mode: string;
          ready: boolean;
          incompleteComponentCount: number;
          components: readonly unknown[];
          exceptions: readonly unknown[];
        };
        slots: readonly {
          structuralRole: string | null;
          qualityStage: string | null;
          parentSlotIds: readonly string[];
          spatialRelations: readonly string[];
          facing: string | null;
          pairId: string | null;
          contact: string | null;
        }[];
      };
    };
  }).authority;
  assert.equal('recipe' in authority.profile, false);
  assert.equal('routing' in authority.profile, false);
  assert.equal('slots' in authority.profile, false);
  assert.equal('bindings' in authority.profile, false);
  assert.equal(authority.profile.track, 'showcase');
  assert.equal(authority.profile.faceMode, 'none');
  assert.equal(authority.profile.face, null);
  assert.equal(authority.profile.structuralModuleCount, 7);
  assert.equal(authority.profile.coverageCount, 3);
  assert.deepEqual(
    [...new Set(authority.evidence.map((claim) => claim.basis))].sort(),
    ['observed', 'requested']
  );
  assert.deepEqual(authority.plan.faceQuality, {
    mode: 'none',
    hostSlotId: null,
    mouthState: null,
    hostReady: true,
    ready: true,
    incompleteComponentCount: 0,
    components: [],
    exceptions: []
  });
  assert.ok(
    authority.evidence.every((claim) =>
      claim.authority.id.length > 0 && claim.criterionId.length > 0
    )
  );
  assert.equal(authority.compatibility.compatible, true);
  assert.equal(authority.plan.ready, true);
  assert.equal(authority.plan.structuralQuality.activeStage, 'complete');
  assert.equal(authority.plan.structuralQuality.ready, true);
  assert.deepEqual(
    authority.plan.structuralQuality.gates.map((gate) => gate.stage),
    ['silhouette', 'structure', 'focal']
  );
  assert.equal(authority.plan.intentCoverage.track, 'showcase');
  assert.equal(authority.plan.intentCoverage.ready, true);
  assert.equal(authority.plan.intentCoverage.featureCount, 3);
  assert.equal(authority.plan.intentCoverage.incompleteFeatureCount, 0);
  assert.equal(authority.plan.intentCoverage.truncatedFeatureCount, 0);
  assert.deepEqual(
    authority.plan.intentCoverage.features.map((feature) => ({
      featureRef: feature.featureRef,
      state: feature.state
    })),
    [
      { featureRef: 'intent.features.0', state: 'complete' },
      { featureRef: 'intent.features.1', state: 'complete' },
      { featureRef: 'intent.features.2', state: 'complete' }
    ]
  );
  assert.deepEqual(
    authority.plan.intentCoverage.stages.map((stage) => ({
      stage: stage.stage,
      ready: stage.ready
    })),
    [
      { stage: 'silhouette', ready: true },
      { stage: 'structure', ready: true },
      { stage: 'focal', ready: true }
    ]
  );
  assert.ok(
    authority.plan.slots.every(
      (slot) =>
        (slot.structuralRole === null ||
          ['core', 'axis', 'articulated', 'span', 'focal-frame', 'accent']
            .includes(slot.structuralRole)) &&
        Array.isArray(slot.parentSlotIds) &&
        Array.isArray(slot.spatialRelations) &&
        (slot.facing === null || slot.facing === 'forward') &&
        (slot.pairId === null || slot.pairId.length > 0) &&
        (slot.contact === null || ['grounded', 'free'].includes(slot.contact))
    )
  );
}

const compactFullFace = createCompactFullFaceProject();
const compactFullFaceOverview = inspectProject(
  compactFullFace,
  null,
  validateProjectDocument(compactFullFace)
);
assert.equal(compactFullFaceOverview.ok, true);
assert.ok(
  Buffer.byteLength(JSON.stringify(compactFullFaceOverview)) <= 2_048,
  'full-face status must remain visible in bounded overview inspect'
);
if (compactFullFaceOverview.ok) {
  const authoring = (compactFullFaceOverview.data as {
    project: {
      authoring: {
        track: string;
        faceMode: string;
        faceQuality: { mode: string; ready: boolean };
      };
    };
  }).project.authoring;
  assert.equal(authoring.track, 'compact');
  assert.equal(authoring.faceMode, 'full');
  assert.deepEqual(authoring.faceQuality, {
    mode: 'full',
    ready: true
  });
}
const compactFullFaceInspect = inspectProject(
  compactFullFace,
  null,
  validateProjectDocument(compactFullFace),
  { kind: 'authoring' }
);
assert.equal(compactFullFaceInspect.ok, true);
assert.ok(
  Buffer.byteLength(JSON.stringify(compactFullFaceInspect)) <= 16_384,
  'a complete explicit full-face plan must fit detail inspect'
);
if (compactFullFaceInspect.ok) {
  const authority = (compactFullFaceInspect.data as {
    authority: {
      profile: {
        track: string;
        faceMode: string;
        face: {
          hostSlotId: string;
          mouthState: string;
          components: readonly {
            component: string;
            form: string;
            configuration: string | null;
          }[];
          exceptionCount: number;
        };
      };
      plan: {
        ready: boolean;
        faceQuality: {
          mode: string;
          hostSlotId: string;
          mouthState: string;
          hostReady: boolean;
          ready: boolean;
          incompleteComponentCount: number;
          components: readonly {
            component: string;
            form: string;
            state: string;
            slotIds: readonly string[];
            materialIds: readonly string[];
            readableEyePartIds?: readonly string[];
          }[];
          exceptions: readonly unknown[];
        };
      };
    };
  }).authority;
  assert.equal(authority.profile.track, 'compact');
  assert.equal(authority.profile.faceMode, 'full');
  assert.equal(authority.profile.face.hostSlotId, 'focal.host');
  assert.equal(authority.profile.face.mouthState, 'closed');
  assert.deepEqual(
    authority.profile.face.components.map((component) => [
      component.component,
      component.form,
      component.configuration
    ]),
    [
      ['eye', 'eye', 'single'],
      ['nasal', 'nose', null],
      ['oral', 'mouth', null]
    ]
  );
  assert.equal(authority.profile.face.exceptionCount, 0);
  assert.equal(authority.plan.ready, true);
  assert.equal(authority.plan.faceQuality.mode, 'full');
  assert.equal(authority.plan.faceQuality.hostSlotId, 'focal.host');
  assert.equal(authority.plan.faceQuality.mouthState, 'closed');
  assert.equal(authority.plan.faceQuality.hostReady, true);
  assert.equal(authority.plan.faceQuality.ready, true);
  assert.equal(authority.plan.faceQuality.incompleteComponentCount, 0);
  assert.deepEqual(
    authority.plan.faceQuality.components.map((component) => [
      component.component,
      component.form,
      component.state
    ]),
    [
      ['eye', 'eye', 'complete'],
      ['nasal', 'nose', 'complete'],
      ['oral', 'mouth', 'complete']
    ]
  );
  assert.deepEqual(
    authority.plan.faceQuality.components.find(
      (component) => component.component === 'eye'
    )?.readableEyePartIds,
    ['face_eye']
  );
}

const collapsedFullFaceEye = executeAgentCommandBatch(
  compactFullFace,
  {
    batchId: 'web-authoring-collapse-full-face-eye',
    baseProjectId: compactFullFace.id,
    baseRevision: compactFullFace.revision,
    operations: [{
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'feature',
          partId: 'face_eye',
          glyph: 'dot',
          size: [1, 1]
        }]
      }
    }]
  }
);
assert.equal(collapsedFullFaceEye.ok, true);
if (!collapsedFullFaceEye.ok) {
  throw new Error(collapsedFullFaceEye.error.message);
}
const collapsedFullFaceInspect = inspectProject(
  collapsedFullFaceEye.document,
  null,
  validateProjectDocument(collapsedFullFaceEye.document),
  { kind: 'authoring' }
);
assert.equal(collapsedFullFaceInspect.ok, true);
if (collapsedFullFaceInspect.ok) {
  const faceQuality = (collapsedFullFaceInspect.data as {
    authority: {
      plan: {
        faceQuality: {
          ready: boolean;
          incompleteComponentCount: number;
          components: readonly {
            component: string;
            state: string;
            readableEyePartIds?: readonly string[];
          }[];
        };
      };
    };
  }).authority.plan.faceQuality;
  assert.equal(faceQuality.ready, false);
  assert.equal(faceQuality.incompleteComponentCount, 1);
  const eye = faceQuality.components.find(
    (component) => component.component === 'eye'
  );
  assert.equal(eye?.state, 'incomplete');
  assert.equal(eye?.readableEyePartIds, undefined);
}

const baseSelection = authoringSelectionFor(configured);
const additionalModules = Array.from({ length: 9 }, (_, index) => ({
  slotId: `detail.accent.${index}`,
  structuralRole: 'accent',
  qualityStage: 'structure',
  partIds: [`missing.accent.${index}`],
  parentSlotIds: ['body.torso'],
  spatialRelations: [],
  facing: null,
  pairId: null,
  contact: 'free'
}));
const expanded = executeAgentCommandBatch(
  configured,
  {
    batchId: 'web-authoring-expanded-modules',
    baseProjectId: configured.id,
    baseRevision: configured.revision,
    operations: [{
      name: 'project.authoring.configure',
      payload: {
        ...baseSelection,
        slots: [...baseSelection.slots, ...additionalModules]
      }
    }]
  }
);
assert.equal(expanded.ok, true);
if (!expanded.ok) throw new Error(expanded.error.message);
const expandedInspect = inspectProject(
  expanded.document,
  null,
  validateProjectDocument(expanded.document),
  { kind: 'authoring' }
);
assert.equal(expandedInspect.ok, true);
assert.ok(
  Buffer.byteLength(JSON.stringify(expandedInspect)) <= 16_384,
  'a selected 16-module authoring plan must fit the detail inspect contract'
);
if (expandedInspect.ok) {
  const data = expandedInspect.data as {
    authority: {
      profile: { structuralModuleCount: number };
      plan: { slots: readonly unknown[] };
    };
    catalog: {
      archetypes: readonly object[];
      specialists: readonly object[];
      detail: string;
    };
  };
  assert.equal(data.authority.profile.structuralModuleCount, 16);
  assert.equal(
    data.authority.plan.slots.length,
    17,
    'the plan adds one bound specialist contribution to 16 structural modules'
  );
  assert.ok(data.catalog.detail.length > 0);
  assert.ok(
    data.catalog.archetypes.every(
      (entry) => !('structuralRolePolicies' in entry)
    ) &&
    data.catalog.specialists.every(
      (entry) => !('evidenceCriteria' in entry)
    ),
    'selected authority inspect must use the compact catalog projection'
  );
}

const compactFeatures = Array.from(
  { length: 32 },
  (_, index) => `Compact semantic cue ${index}`
);
const compactCoverage = compactFeatures.map((_, index) => ({
  featureRef: `intent.features.${index}`,
  slotIds: ['body.torso'],
  materialIds: []
}));
const compactConfigured = executeAgentCommandBatch(
  configured,
  {
    batchId: 'web-authoring-compact-coverage',
    baseProjectId: configured.id,
    baseRevision: configured.revision,
    operations: [{
      name: 'project.intent.set',
      payload: {
        subject: configured.intent?.subject ?? 'Compact semantic asset',
        forward: configured.intent?.forward ?? 'north',
        grounding: configured.intent?.grounding ?? 'free',
        features: compactFeatures,
        references: configured.intent?.references ?? []
      }
    }, {
      name: 'project.authoring.configure',
      payload: {
        ...baseSelection,
        track: 'compact',
        coverage: compactCoverage
      }
    }]
  }
);
assert.equal(compactConfigured.ok, true);
if (!compactConfigured.ok) {
  throw new Error(compactConfigured.error.message);
}
const compactInspect = inspectProject(
  compactConfigured.document,
  null,
  validateProjectDocument(compactConfigured.document),
  { kind: 'authoring' }
);
assert.equal(compactInspect.ok, true);
assert.ok(
  Buffer.byteLength(JSON.stringify(compactInspect)) <= 16_384,
  'the maximum 32-feature coverage plan must fit detail inspect'
);
if (compactInspect.ok) {
  const authority = (compactInspect.data as {
    authority: {
      profile: { track: string; coverageCount: number };
      plan: {
        intentCoverage: {
          track: string;
          ready: boolean;
          featureCount: number;
          incompleteFeatureCount: number;
          features: readonly { state: string }[];
          truncatedFeatureCount: number;
        };
      };
    };
  }).authority;
  assert.equal(authority.profile.track, 'compact');
  assert.equal(authority.profile.coverageCount, 32);
  assert.equal(authority.plan.intentCoverage.track, 'compact');
  assert.equal(authority.plan.intentCoverage.ready, true);
  assert.equal(authority.plan.intentCoverage.featureCount, 32);
  assert.equal(authority.plan.intentCoverage.incompleteFeatureCount, 0);
  assert.equal(authority.plan.intentCoverage.features.length, 12);
  assert.equal(authority.plan.intentCoverage.truncatedFeatureCount, 20);
  assert.ok(
    authority.plan.intentCoverage.features.every(
      (feature) => feature.state === 'complete'
    )
  );
}
