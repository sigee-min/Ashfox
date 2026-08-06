import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  executeAgentCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import { inspectProject } from '../src/features/agent/inspect';
import { parseInspectRequest } from '../src/features/agent/parseInspectRequest';
import {
  createAuthoringProject
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
    id: 'archetype.pillar-stalker'
  }),
  {
    ok: true,
    request: {
      kind: 'authoring',
      id: 'archetype.pillar-stalker'
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
        attachmentPorts: readonly { id: string; type: string }[];
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
    [
      'archetype.mini-biped',
      'archetype.pillar-stalker',
      'archetype.quadruped',
      'archetype.compact-construct'
    ]
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
      'specialist.stalking-gait',
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
        Array.isArray(archetype.attachmentPorts)
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

const pillar = inspectProject(
  intended.document,
  null,
  report,
  { kind: 'authoring', id: 'archetype.pillar-stalker' }
);
assert.equal(pillar.ok, true);
if (pillar.ok) {
  const authority = (pillar.data as {
    authority: {
      type: string;
      definition: {
        evidenceCriteria: readonly {
          id: string;
          basis: string;
          required: boolean;
        }[];
        semanticSlots: readonly { id: string }[];
        attachmentPorts: readonly { id: string }[];
      };
    };
  }).authority;
  assert.equal(authority.type, 'archetype');
  assert.deepEqual(authority.definition.evidenceCriteria, [{
    id: 'criterion.body-plan',
    basis: 'either',
    required: true,
    instruction:
      'Ground the arm-free column and four-point footprint in a current request or reference observation.'
  }]);
  assert.deepEqual(
    authority.definition.semanticSlots.map((slot) => slot.id),
    [
      'body.column',
      'body.head',
      'body.foot-front-left',
      'body.foot-front-right',
      'body.foot-rear-left',
      'body.foot-rear-right',
      'body.face'
    ]
  );
  assert.deepEqual(
    authority.definition.attachmentPorts.map((port) => port.id),
    ['port.surface-cue', 'port.silhouette-cue']
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
  assert.match(schema, /archetype\.pillar-stalker/);
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
  assert.doesNotMatch(schema, /recipe/i);
  assert.doesNotMatch(schema, /assembly/i);
  assert.doesNotMatch(schema, /preset|identities|motions/i);
}

const configured = createAuthoringProject();
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
      profile: object;
      evidence: readonly {
        authority: { id: string };
        criterionId: string;
        basis: 'observed' | 'requested';
      }[];
      compatibility: { compatible: boolean };
      plan: { ready: boolean };
    };
  }).authority;
  assert.equal('recipe' in authority.profile, false);
  assert.deepEqual(
    [...new Set(authority.evidence.map((claim) => claim.basis))].sort(),
    ['observed', 'requested']
  );
  assert.ok(
    authority.evidence.every((claim) =>
      claim.authority.id.length > 0 && claim.criterionId.length > 0
    )
  );
  assert.equal(authority.compatibility.compatible, true);
  assert.equal(authority.plan.ready, true);
}
