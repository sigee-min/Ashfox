import assert from 'node:assert/strict';

import {
  createProjectFromInput,
  evaluateProductionReadiness,
  executeCommandBatch,
  validateProjectDocument
} from '@ashfox/engine-core';

import {
  createGltfProject
} from '../../../packages/engine-core/tests/helpers';
import {
  deriveInspectWorkflow
} from '../src/features/agent/inspectWorkflow';
import { inspectProject } from '../src/features/agent/inspect';
import {
  WORKBENCH_PLACEHOLDER_PROJECT_ID
} from '../src/application/projectIdentity';
import type {
  VisualReviewReceipt
} from '../src/features/agent/presentationReview';

const readyProject = structuredClone(createGltfProject());
readyProject.intent = {
  subject: 'wooden crate',
  forward: 'north',
  grounding: 'free',
  features: ['readable crate silhouette']
};
const idle = readyProject.animations['clip-idle'];
const idleChannel = idle.channels['channel-root-rotation'];
readyProject.animations = {
  idle: {
    ...idle,
    id: 'idle',
    channels: {
      ...idle.channels,
      'channel-root-rotation': {
        ...idleChannel,
        keys: idleChannel.keys.map((key, index) =>
          index === idleChannel.keys.length - 1
            ? { ...key, value: [0, 0, 0] }
            : key
        )
      }
    }
  }
};

const readyReport = validateProjectDocument(readyProject);
const readyReadiness = evaluateProductionReadiness(
  readyProject,
  readyReport
);
assert.equal(readyReadiness.mechanicallyReady, true);

const assertOpenLoopRecovery = (
  target: 'glb' | 'geckolib5'
): void => {
  const source = structuredClone(readyProject);
  const converted =
    target === 'glb'
      ? { ok: true as const, document: source }
      : executeCommandBatch(
          source,
          {
            batchId: 'workflow-open-loop-target-gecko',
            baseProjectId: source.id,
            baseRevision: source.revision,
            operations: [{
              name: 'project.target.set',
              payload: { target: 'geckolib5' }
            }]
          },
          { source: 'agent' }
        );
  assert.equal(converted.ok, true);
  if (!converted.ok) throw new Error(converted.error.message);
  const document = converted.document;
  const sourceChannel =
    document.animations.idle.channels[
      'channel-root-rotation'
    ];
  const openChannel = {
    ...sourceChannel,
    id: `channel-${target}-open-loop`,
    keys: sourceChannel.keys.map((key, index) => ({
      ...key,
      id: `key-${target}-open-loop-${index}`,
      ...(index === sourceChannel.keys.length - 1
        ? { value: [0, 15, 0] as const }
        : {})
    }))
  };
  document.animations.walk = {
    ...document.animations.idle,
    id: 'walk',
    name: 'animation.crate.walk',
    channels: {
      [openChannel.id]: openChannel
    },
    triggers: {}
  };

  const report = validateProjectDocument(document);
  assert.equal(report.valid, true);
  const guidance = deriveInspectWorkflow(
    document,
    report,
    evaluateProductionReadiness(document, report)
  );
  assert.equal(
    guidance.blocker?.code,
    'production.animation_loop_invalid'
  );
  assert.deepEqual(guidance.nextActions, [{
    kind: 'operation',
    operation: {
      name: 'animation.clip.delete',
      payload: { clipId: 'walk' }
    }
  }]);

  const recovered = executeCommandBatch(
    document,
    {
      batchId: `workflow-open-loop-delete-${target}`,
      baseProjectId: document.id,
      baseRevision: document.revision,
      operations: [{
        name: 'animation.clip.delete',
        payload: { clipId: 'walk' }
      }]
    },
    { source: 'agent' }
  );
  assert.equal(recovered.ok, true);
  if (!recovered.ok) throw new Error(recovered.error.message);
  assert.equal(recovered.document.animations.walk, undefined);

  if (target === 'geckolib5') {
    const empty = executeCommandBatch(
      recovered.document,
      {
        batchId: 'workflow-delete-last-gecko-clip',
        baseProjectId: recovered.document.id,
        baseRevision: recovered.document.revision,
        operations: [{
          name: 'animation.clip.delete',
          payload: { clipId: 'idle' }
        }]
      },
      { source: 'agent' }
    );
    assert.equal(
      empty.ok,
      true,
      'a Gecko intermediate project may delete its last clip'
    );
    if (!empty.ok) throw new Error(empty.error.message);
    assert.deepEqual(empty.document.animations, {});
    assert.equal(
      validateProjectDocument(empty.document).valid,
      true
    );
  }
};

assertOpenLoopRecovery('glb');
assertOpenLoopRecovery('geckolib5');

const unreviewed = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness
);
assert.deepEqual(unreviewed, {
  stage: 'review',
  blocker: null,
  nextActions: [{
    kind: 'present',
    request: { review: 'next' }
  }],
  remainingVisualReviews: [
    'frame:perspective',
    'frame:front',
    'frame:side',
    'frame:top',
    'cycle:perspective:idle'
  ],
  remainingVisualReviewCount: 5,
  visualReviewsTruncated: false
});

const receipt = (
  mode: 'frame' | 'cycle',
  camera: 'perspective' | 'front' | 'side' | 'top',
  clipId: string | null,
  revision = readyProject.revision
): VisualReviewReceipt => ({
  projectId: readyProject.id,
  revision,
  mode,
  camera,
  clipId,
  observedTimeSeconds: 1,
  completedCycles: mode === 'cycle' ? 1 : 0,
  frameNonce: 1,
  verdict: 'accepted',
  issues: []
});

const completeReceipts = [
  receipt('frame', 'perspective', null),
  receipt('frame', 'front', null),
  receipt('frame', 'side', null),
  receipt('frame', 'top', null),
  receipt('cycle', 'perspective', 'idle')
];
const reviewed = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness,
  completeReceipts
);
assert.equal(reviewed.stage, 'deliver');
assert.deepEqual(reviewed.remainingVisualReviews, []);
assert.equal(reviewed.remainingVisualReviewCount, 0);

const staticJavaResult = executeCommandBatch(
  readyProject,
  {
    batchId: 'workflow-java-static',
    baseProjectId: readyProject.id,
    baseRevision: readyProject.revision,
    operations: [{
      name: 'project.target.set',
      payload: {
        target: 'java_block',
        gameVersion: '1.21.11'
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(staticJavaResult.ok, true);
if (!staticJavaResult.ok) {
  throw new Error(staticJavaResult.error.message);
}
const staticJava = staticJavaResult.document;
const staticJavaReport = validateProjectDocument(staticJava);
const staticJavaReadiness = evaluateProductionReadiness(
  staticJava,
  staticJavaReport
);
assert.equal(staticJavaReadiness.mechanicallyReady, true);
assert.deepEqual(
  staticJava.animations,
  readyProject.animations,
  'a static delivery profile must preserve canonical clips'
);

const incompatibleJava = structuredClone(staticJava);
if (incompatibleJava.formatProfile.id !== 'minecraft.java_block') {
  throw new Error('Expected a Java block project.');
}
incompatibleJava.formatProfile.resourcePackFormat = 55;
const incompatibleJavaReport = validateProjectDocument(incompatibleJava);
const incompatibleJavaGuidance = deriveInspectWorkflow(
  incompatibleJava,
  incompatibleJavaReport,
  evaluateProductionReadiness(
    incompatibleJava,
    incompatibleJavaReport
  )
);
assert.equal(incompatibleJavaGuidance.stage, 'start');
assert.equal(
  incompatibleJavaGuidance.blocker?.code,
  'format.unsupported_data'
);
assert.deepEqual(incompatibleJavaGuidance.nextActions, [{
  kind: 'command',
  name: 'project.target.set'
}]);
const staticJavaUnreviewed = deriveInspectWorkflow(
  staticJava,
  staticJavaReport,
  staticJavaReadiness
);
assert.equal(staticJavaUnreviewed.stage, 'review');
assert.deepEqual(staticJavaUnreviewed.remainingVisualReviews, [
  'frame:perspective',
  'frame:front',
  'frame:side',
  'frame:top'
]);
const staticJavaReviewed = deriveInspectWorkflow(
  staticJava,
  staticJavaReport,
  staticJavaReadiness,
  completeReceipts.slice(0, 4)
);
assert.equal(staticJavaReviewed.stage, 'deliver');
assert.deepEqual(staticJavaReviewed.remainingVisualReviews, []);

const defaultInspect = inspectProject(
  readyProject,
  null,
  readyReport,
  undefined,
  [],
  {},
  completeReceipts
);
assert.equal(defaultInspect.ok, true);
if (defaultInspect.ok) {
  const workflow = (defaultInspect.data as {
    workflow: {
      stage: string;
      remainingVisualReviews: readonly string[];
    };
  }).workflow;
  assert.equal(workflow.stage, 'deliver');
  assert.deepEqual(workflow.remainingVisualReviews, []);
}

const targetInspect = inspectProject(
  readyProject,
  null,
  readyReport,
  { kind: 'target' },
  [],
  {},
  completeReceipts
);
assert.equal(targetInspect.ok, true);
if (targetInspect.ok) {
  const workflow = (targetInspect.data as {
    workflow: {
      stage: string;
      remainingVisualReviews: readonly string[];
    };
  }).workflow;
  assert.equal(workflow.stage, 'deliver');
  assert.deepEqual(workflow.remainingVisualReviews, []);
}

const staleReview = deriveInspectWorkflow(
  readyProject,
  readyReport,
  readyReadiness,
  completeReceipts.map((item) => ({
    ...item,
    revision: 'stale-revision'
  }))
);
assert.equal(staleReview.stage, 'review');
assert.equal(staleReview.remainingVisualReviews.length, 5);
assert.equal(staleReview.remainingVisualReviewCount, 5);

const unspecified = structuredClone(createGltfProject());
const unspecifiedReport = validateProjectDocument(unspecified);
const unspecifiedGuidance = deriveInspectWorkflow(
  unspecified,
  unspecifiedReport,
  evaluateProductionReadiness(unspecified, unspecifiedReport)
);
assert.equal(unspecifiedGuidance.stage, 'plan');
assert.equal(
  unspecifiedGuidance.blocker?.code,
  'production.intent_missing'
);
assert.ok(unspecifiedGuidance.blocker?.fix);
assert.deepEqual(
  unspecifiedGuidance.nextActions,
  [{ kind: 'command', name: 'project.intent.set' }]
);

const placeholder = {
  ...structuredClone(unspecified),
  id: WORKBENCH_PLACEHOLDER_PROJECT_ID
};
const placeholderReport = validateProjectDocument(placeholder);
const placeholderGuidance = deriveInspectWorkflow(
  placeholder,
  placeholderReport,
  evaluateProductionReadiness(placeholder, placeholderReport)
);
assert.equal(placeholderGuidance.stage, 'start');
assert.equal(
  placeholderGuidance.blocker?.code,
  'workflow.project_not_initialized'
);
assert.deepEqual(
  placeholderGuidance.nextActions,
  [{ kind: 'command', name: 'project.create' }]
);

const locatorProject = structuredClone(readyProject);
locatorProject.scene.nodes['locator-broken'] = {
  id: 'locator-broken',
  kind: 'locator',
  name: 'broken',
  parentId: 'bone-missing',
  transform: structuredClone(
    locatorProject.scene.nodes['bone-root'].transform
  ),
  visible: true
};
const locatorReport = validateProjectDocument(locatorProject);
const locatorGuidance = deriveInspectWorkflow(
  locatorProject,
  locatorReport,
  evaluateProductionReadiness(locatorProject, locatorReport)
);
assert.equal(locatorGuidance.stage, 'model');
assert.equal(
  locatorGuidance.blocker?.code,
  'scene.parent_missing'
);
assert.deepEqual(
  locatorGuidance.nextActions,
  [{
    kind: 'operation',
    operation: {
      name: 'scene.locators.delete',
      payload: { locatorIds: ['locator-broken'] }
    }
  }]
);

const invalidAnimation = structuredClone(readyProject);
invalidAnimation.animations.idle.name = '';
const invalidAnimationReport =
  validateProjectDocument(invalidAnimation);
const invalidAnimationGuidance = deriveInspectWorkflow(
  invalidAnimation,
  invalidAnimationReport,
  evaluateProductionReadiness(
    invalidAnimation,
    invalidAnimationReport
  )
);
assert.equal(invalidAnimationGuidance.stage, 'animate');
assert.equal(
  invalidAnimationGuidance.blocker?.path,
  'animations.idle.name'
);
assert.ok(
  invalidAnimationGuidance.nextActions.some(
    (action) =>
      action.kind === 'command' &&
      action.name === 'animation.motion.upsert'
  )
);

const untextured = structuredClone(readyProject);
for (const node of Object.values(untextured.scene.nodes)) {
  if (node.kind !== 'cube') continue;
  for (const face of Object.values(node.faces)) {
    face.textureId = null;
  }
}
untextured.textures = {};
const untexturedReport = validateProjectDocument(untextured);
const untexturedGuidance = deriveInspectWorkflow(
  untextured,
  untexturedReport,
  evaluateProductionReadiness(untextured, untexturedReport)
);
assert.equal(untexturedGuidance.stage, 'model');
assert.match(
  untexturedGuidance.blocker?.code ?? '',
  /^(cube\.texture_missing|production\.texture_coverage_incomplete)$/
);
assert.ok(
  untexturedGuidance.nextActions.some(
    (action) =>
      action.kind === 'command' &&
      action.name === 'model.parts.upsert'
  )
);

const geometryMissing = structuredClone(readyProject);
geometryMissing.scene = { roots: [], nodes: {} };
geometryMissing.textures = {};
geometryMissing.animations = {};
const geometryReport = validateProjectDocument(geometryMissing);
const geometryGuidance = deriveInspectWorkflow(
  geometryMissing,
  geometryReport,
  evaluateProductionReadiness(geometryMissing, geometryReport)
);
assert.equal(geometryGuidance.stage, 'model');
assert.equal(
  geometryGuidance.blocker?.code,
  'production.geometry_missing'
);
assert.deepEqual(
  geometryGuidance.nextActions,
  [{ kind: 'command', name: 'model.parts.upsert' }]
);

const idleBase = createProjectFromInput(
  {
    id: 'workflow-idle',
    name: 'Workflow idle',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'workflow_idle',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'idle-0001'
);
const idleAuthored = executeCommandBatch(
  idleBase,
  {
    batchId: 'workflow-idle-author',
    baseProjectId: idleBase.id,
    baseRevision: idleBase.revision,
    operations: [
      {
        name: 'project.intent.set',
        payload: {
          subject: 'workflow cube',
          forward: 'north',
          grounding: 'free',
          features: ['readable cube']
        }
      },
      {
        name: 'model.parts.upsert',
        payload: {
          parts: [{
            kind: 'mass',
            partId: 'body',
            parentPartId: null,
            materialId: 'stone',
            joint: { kind: 'fixed' },
            center: [0, 1, 0],
            radii: [1, 1, 1],
            profile: 'hard'
          }],
          materials: [{
            id: 'stone',
            baseColor: '#777777'
          }]
        }
      }
    ]
  },
  { source: 'agent' }
);
assert.equal(idleAuthored.ok, true);
if (!idleAuthored.ok) {
  throw new Error(idleAuthored.error.message);
}
const idleReport = validateProjectDocument(
  idleAuthored.document
);
const idleGuidance = deriveInspectWorkflow(
  idleAuthored.document,
  idleReport,
  evaluateProductionReadiness(
    idleAuthored.document,
    idleReport
  )
);
assert.equal(idleGuidance.stage, 'animate');
assert.deepEqual(
  idleGuidance.nextActions,
  [{
    kind: 'operation',
    operation: {
      name: 'animation.motion.upsert',
      payload: {
        clipId: 'idle',
        role: 'idle',
        durationFrames: 20,
        static: true
      }
    }
  }]
);
assert.match(
  idleGuidance.blocker?.fix ?? '',
  /returned animation\.motion\.upsert operation/
);

const incompatibleIdle = executeCommandBatch(
  idleAuthored.document,
  {
    batchId: 'workflow-invalid-idle',
    baseProjectId: idleAuthored.document.id,
    baseRevision: idleAuthored.document.revision,
    operations: [
      {
        name: 'animation.clip.upsert',
        payload: {
          id: 'idle',
          name: 'animation.workflow_idle.idle',
          durationSeconds: 1,
          fps: 20,
          loop: 'loop'
        }
      },
      {
        name: 'animation.channels.upsert',
        payload: {
          clipId: 'idle',
          channels: [{
            id: 'idle-root-position',
            targetNodeId: 'bone:body',
            property: 'position',
            keys: [
              {
                id: 'idle-root-position-start',
                timeSeconds: 0,
                value: [0, 0, 0]
              },
              {
                id: 'idle-root-position-end',
                timeSeconds: 1,
                value: [1, 0, 0]
              }
            ]
          }]
        }
      }
    ]
  },
  { source: 'system' }
);
assert.equal(incompatibleIdle.ok, true);
if (!incompatibleIdle.ok) {
  throw new Error(incompatibleIdle.error.message);
}
const incompatibleIdleReport = validateProjectDocument(
  incompatibleIdle.document
);
const incompatibleIdleGuidance = deriveInspectWorkflow(
  incompatibleIdle.document,
  incompatibleIdleReport,
  evaluateProductionReadiness(
    incompatibleIdle.document,
    incompatibleIdleReport
  )
);
assert.equal(
  incompatibleIdleGuidance.blocker?.code,
  'production.idle_loop_invalid'
);
assert.deepEqual(
  incompatibleIdleGuidance.nextActions,
  [{
    kind: 'operation',
    operation: {
      name: 'animation.clip.delete',
      payload: { clipId: 'idle' }
    }
  }]
);
assert.match(
  incompatibleIdleGuidance.blocker?.fix ?? '',
  /returned animation\.clip\.delete operation/
);

const groundingBase = createProjectFromInput(
  {
    id: 'workflow-grounding',
    name: 'Workflow grounding',
    target: 'glb',
    namespace: 'ashfox',
    modelPath: 'workflow_grounding',
    createdAt: '2026-07-31T00:00:00.000Z'
  },
  'grounding-0001'
);
const groundingResult = executeCommandBatch(
  groundingBase,
  {
    batchId: 'workflow-grounding-author',
    baseProjectId: groundingBase.id,
    baseRevision: groundingBase.revision,
    operations: [{
      name: 'project.intent.set',
      payload: {
        subject: 'grounded crate',
        grounding: 'grounded'
      }
    }, {
      name: 'model.parts.upsert',
      payload: {
        parts: [{
          kind: 'mass',
          partId: 'body',
          materialId: 'wood',
          center: [0, 4, 0],
          radii: [2, 2, 2]
        }],
        materials: [{
          id: 'wood',
          baseColor: '#8A5A32'
        }]
      }
    }]
  },
  { source: 'agent' }
);
assert.equal(groundingResult.ok, true);
if (!groundingResult.ok) {
  throw new Error(groundingResult.error.message);
}
const groundingReport =
  validateProjectDocument(groundingResult.document);
const groundingGuidance = deriveInspectWorkflow(
  groundingResult.document,
  groundingReport,
  evaluateProductionReadiness(
    groundingResult.document,
    groundingReport
  )
);
assert.equal(
  groundingGuidance.blocker?.code,
  'production.intent_grounding_mismatch'
);
assert.equal(
  groundingGuidance.nextActions[0]?.kind,
  'operation'
);
if (groundingGuidance.nextActions[0]?.kind === 'operation') {
  assert.equal(
    groundingGuidance.nextActions[0].operation.name,
    'model.parts.transform'
  );
  const by = (
    groundingGuidance.nextActions[0].operation.payload as {
      by: readonly [number, number, number];
    }
  ).by;
  assert.ok(by[1] < 0);
}
